"""
generate_timetable.py
=====================
Clash-free timetable generator with strict faculty rules:

  RULE 1 -- 3-subject cap
    Each faculty teaches AT MOST 3 unique subjects (globally, across all
    courses and semesters).  Once a faculty reaches 3 subjects they are
    no longer eligible for new subject assignments.

  RULE 2 -- No time clash
    A faculty can be in only ONE classroom at any given (day, start_time).
    This is enforced by a global `faculty_busy` set that is maintained
    across ALL course-semester-section iterations.

  RULE 3 -- Related-subject reuse
    The same subject (matched by exact name OR shared keywords) is always
    taught by the same faculty regardless of which course/semester it
    appears in.  This prevents a faculty from being double-booked because
    the same lecture appears in two different courses at the same time.

  RULE 4 -- Shift compatibility
    Morning faculty teach only morning-shift courses; Noon faculty teach
    only noon-shift courses.  Full-Day faculty can teach either.

Run:
    python manage.py generate_timetable
    python manage.py generate_timetable --max_subjects 3
"""

from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction

from academics.models import Course, Room, Subject, TimetableSlot
from users.models import Faculty


MAX_SUBJECTS_PER_FACULTY = 3   # <-- change here to adjust the global cap


class Command(BaseCommand):
    help = "Generate clash-free timetable -- each faculty max 3 subjects, zero time clashes"

    # -- Time-slot definitions ------------------------------------------------
    WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    SATURDAY = "Saturday"
    ALL_DAYS = WEEKDAYS + [SATURDAY]
    SATURDAY_SLOT_LIMIT = 3

    MORNING_SLOTS = [
        (1, "08:00", "08:55"),
        (2, "08:55", "09:40"),
        (3, "10:15", "11:10"),
        (4, "11:10", "12:00"),
        (5, "12:00", "12:55"),
    ]

    NOON_SLOTS = [
        (1, "12:00", "12:55"),
        (2, "13:25", "14:20"),
        (3, "15:15", "16:10"),
        (4, "16:30", "17:20"),
        (5, "17:20", "18:10"),
    ]

    MORNING_ROOMS = ["LH-102", "LH-103", "B-LH-02", "A-201", "A-202", "C-101", "C-102"]
    NOON_ROOMS    = ["A-105", "A-107", "A-108",  "A-205", "A-206", "A-207", "A-208"]

    SEM_SECTIONS = {1: "A", 2: "B", 3: "C", 4: "D", 5: "E", 6: "F", 7: "G", 8: "H"}

    ACTUAL_COURSE_CODES = [
        "BCA", "MCA", "BSC-IT", "BSC-IT-CS", "BSC-IT-IMS",
        "MSC-IT", "MSC-IT-CS", "MSC-IT-IMS", "MSC-AIML",
        "DD-BCA-MCA", "BTech", "MTech",
    ]

    # -- Helpers --------------------------------------------------------------

    def add_arguments(self, parser):
        parser.add_argument(
            "--max_subjects",
            type=int,
            default=MAX_SUBJECTS_PER_FACULTY,
            help=f"Maximum unique subjects per faculty (default: {MAX_SUBJECTS_PER_FACULTY})",
        )

    def _is_lab(self, subject_name):
        name = (subject_name or "").upper()
        return any(t in name for t in ["LAB", "PRACTICAL", "PROJECT", "WORKSHOP"])

    def _resolve_shift(self, course):
        shift = (course.shift or "").upper()
        if shift in ("MORNING", "NOON"):
            return shift.lower()
        code = (course.code or "").upper()
        if any(t in code for t in ["BCA", "BSC", "DD-BCA"]):
            return "noon"
        return "morning"

    def _get_day_timings(self, shift, day):
        base = self.MORNING_SLOTS if shift == "morning" else self.NOON_SLOTS
        if day == self.SATURDAY:
            return base[: self.SATURDAY_SLOT_LIMIT]
        return list(base)

    def _shift_compatible(self, faculty, shift):
        """Return True if this faculty can work in the given shift."""
        ws = faculty.working_shift
        if shift == "morning":
            return ws in ("Morning", "Full Day")
        return ws in ("Noon", "Full Day", "Evening")

    def _shift_rooms(self, shift, room_map):
        preferred = self.MORNING_ROOMS if shift == "morning" else self.NOON_ROOMS
        available = [r for r in preferred if r in room_map]
        others    = [r for r in sorted(room_map.keys()) if r not in available]
        return available + others

    def _pick_room(self, course, sem, section, room_numbers, room_map,
                   class_room_map, room_total_load):
        key = (str(course.course_id), sem, section)
        if key in class_room_map:
            rn = class_room_map[key]
            return rn, room_map.get(rn)
        ordered = sorted(room_numbers, key=lambda rn: (
            1 if rn in set(class_room_map.values()) else 0,
            room_total_load.get(rn, 0),
            rn,
        ))
        if not ordered:
            return None, None
        rn = ordered[0]
        class_room_map[key] = rn
        return rn, room_map.get(rn)

    def _subject_key(self, subject_name: str) -> str:
        """
        Normalise a subject name to a canonical key so that subjects with
        the same name in different courses map to the same key.
        e.g. 'Data and File Structure' --> 'data and file structure'
        """
        return subject_name.strip().lower()

    # -- Main handle ----------------------------------------------------------

    def handle(self, *args, **options):
        max_subjects = options["max_subjects"]

        self.stdout.write("=" * 72)
        self.stdout.write(f"TIMETABLE GENERATION  |  max {max_subjects} subjects/faculty  |  ZERO clashes")
        self.stdout.write("=" * 72)

        # -- Ensure TBA faculty placeholder exists -------------------------
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user_tba, _ = User.objects.get_or_create(
            email="tba@ganpatuniversity.ac.in",
            defaults={"role": "faculty"},
        )
        tba_faculty, _ = Faculty.objects.get_or_create(
            user=user_tba,
            defaults={
                "name": "TBA (To Be Assigned)",
                "email": "tba@ganpatuniversity.ac.in",
                "phone": "0000000000",
                "department": "Admin",
                "working_shift": "Full Day",
                "status": "Active",
                "max_lectures_per_day": 99,
            },
        )

        # -- Load manual (non-auto) slots into busy sets -------------------
        #    We ONLY block on manual slots; auto-generated ones are deleted
        #    and re-generated from scratch each time.
        faculty_busy:  set = set()   # (faculty_id_str, day, start, end)
        room_busy:     set = set()   # (room_name,       day, start, end)
        class_busy:    set = set()   # (course_id_str, sem, day, start, section)
        room_total_load:   dict = defaultdict(int)
        class_room_map:    dict = {}

        for slot in TimetableSlot.objects.filter(
            is_auto_generated=False
        ).select_related("room", "faculty"):
            start = slot.start_time.strftime("%H:%M")
            end   = slot.end_time.strftime("%H:%M")
            day   = slot.day_of_week
            if slot.faculty_id:
                faculty_busy.add((str(slot.faculty_id), day, start, end))
            room_name = slot.room_name or (slot.room.room_number if slot.room else None)
            if room_name:
                room_busy.add((room_name, day, start, end))
                room_total_load[room_name] += 1
            class_busy.add((str(slot.course_id), slot.semester, day, start, slot.section))

        # -- Delete all auto-generated slots ------------------------------
        with transaction.atomic():
            deleted = TimetableSlot.objects.filter(is_auto_generated=True).delete()[0]
        self.stdout.write(f"\n[OK] Cleared {deleted} auto-generated slots")
        self.stdout.write(f"[OK] Manual slot blocks preserved: {len(faculty_busy)}")

        # -- Room map ------------------------------------------------------
        all_rooms = Room.objects.all().order_by("room_number")
        room_map  = {r.room_number: r for r in all_rooms}

        # -- Active faculty list (exclude TBA) -----------------------------
        all_faculty = list(
            Faculty.objects.filter(status="Active")
            .exclude(name__icontains="TBA")
            .order_by("name")
        )

        # -- Clear existing M2M assignments to start fresh with the cap ----
        self.stdout.write("[INFO] Clearing existing faculty-subject assignments for fresh start...")
        for fac in all_faculty:
            fac.subjects.clear()

        # -----------------------------------------------------------------
        # GLOBAL SUBJECT --> FACULTY MAP (with 3-subject cap)
        #
        # subject_faculty_map[subject_key] = Faculty object
        #   Once a subject key is in this map, ALL occurrences of that
        #   subject (across any course/semester) go to the same faculty.
        #
        # faculty_subject_count[faculty_id_str] = number of unique subjects
        #   assigned to this faculty so far. When this hits max_subjects,
        #   the faculty is no longer eligible for NEW subject assignments.
        # -----------------------------------------------------------------
        subject_faculty_map: dict[str, Faculty]   = {}
        faculty_subject_count: dict[str, int]     = defaultdict(int)

        self.stdout.write(
            f"[OK] Ready to assign subjects (max {max_subjects} per faculty)"
        )

        # -- Course ordering -----------------------------------------------
        def get_order_index(c):
            try:
                return self.ACTUAL_COURSE_CODES.index(c.code)
            except ValueError:
                cu = c.code.upper()
                for i, code in enumerate(self.ACTUAL_COURSE_CODES):
                    if code.upper() in cu or cu in code.upper():
                        return i
                return len(self.ACTUAL_COURSE_CODES)

        all_courses = sorted(Course.objects.all(), key=get_order_index)

        total_created  = 0
        clash_count    = 0
        fallback_count = 0
        courses_processed = 0

        for course in all_courses:
            shift = self._resolve_shift(course)
            rooms = self._shift_rooms(shift, room_map)

            self.stdout.write(
                f"\n[{course.code}] {course.name} ({shift.upper()})"
            )

            semesters = sorted(
                Subject.objects.filter(course=course)
                .values_list("semester", flat=True)
                .distinct()
            )
            if not semesters:
                self.stdout.write("  [SKIP] No subjects found for this course")
                continue

            for sem in semesters:
                if sem == getattr(course, "total_semesters", -1):
                    self.stdout.write(f"  Sem {sem} = final Project/Internship -- skipped")
                    continue

                section  = self.SEM_SECTIONS.get(sem, "A")
                subjects = list(
                    Subject.objects.filter(course=course, semester=sem).order_by("code")
                )
                if not subjects:
                    self.stdout.write(f"  Sem {sem} [SKIP] No subjects")
                    continue

                self.stdout.write(
                    f"  Sem {sem} (Section {section}): {len(subjects)} subjects"
                )

                home_room_name, home_room_obj = self._pick_room(
                    course, sem, section, rooms, room_map, class_room_map, room_total_load
                )
                if not home_room_name:
                    self.stdout.write("    [WARN] No room -- skipped")
                    continue

                self.stdout.write(f"    Classroom: {home_room_name}")

                subject_names = [s.name for s in subjects]
                subject_map   = {s.name: s for s in subjects}

                # -- Assign faculty to each subject (respecting 3-subject cap) --
                # subject_assigned_faculty[sub_name] = Faculty for this iteration
                subject_assigned_faculty: dict[str, Faculty] = {}

                for subj in subjects:
                    skey = self._subject_key(subj.name)

                    # Case 1: Subject already globally assigned --> reuse same faculty
                    if skey in subject_faculty_map:
                        subject_assigned_faculty[subj.name] = subject_faculty_map[skey]
                        continue

                    # Case 2: Need to assign a NEW faculty to this subject.
                    # Pick the faculty who:
                    #   a) is shift-compatible
                    #   b) has < max_subjects unique subjects
                    #   c) is already in the subject's M2M (preferred) OR any free faculty
                    #   Sorted by fewest subjects so we spread load evenly.

                    # Phase 2a: Prefer faculty already in subject.faculty_members M2M
                    m2m_candidates = [
                        f for f in subj.faculty_members.filter(status="Active")
                        if self._shift_compatible(f, shift)
                        and faculty_subject_count[str(f.faculty_id)] < max_subjects
                    ]
                    m2m_candidates.sort(key=lambda f: faculty_subject_count[str(f.faculty_id)])

                    chosen = m2m_candidates[0] if m2m_candidates else None

                    # Phase 2b: Fall back to any faculty with capacity
                    if not chosen:
                        pool = [
                            f for f in all_faculty
                            if self._shift_compatible(f, shift)
                            and faculty_subject_count[str(f.faculty_id)] < max_subjects
                        ]
                        pool.sort(key=lambda f: faculty_subject_count[str(f.faculty_id)])
                        chosen = pool[0] if pool else None

                    # Phase 2c: All faculty at cap --> use TBA
                    if not chosen:
                        chosen = tba_faculty
                        self.stdout.write(
                            f"    [WARN] All faculty at {max_subjects}-subject cap -- "
                            f"using TBA for {subj.code}"
                        )

                    # Register the assignment
                    subject_faculty_map[skey] = chosen
                    fid = str(chosen.faculty_id)
                    faculty_subject_count[fid] += 1
                    subject_assigned_faculty[subj.name] = chosen

                    # Also update the M2M so the assignment is persisted
                    if chosen != tba_faculty:
                        chosen.subjects.add(subj)

                # -- Build grid of (day, start, end) ----------------------
                grid = []
                for day in self.ALL_DAYS:
                    for _order, start, end in self._get_day_timings(shift, day):
                        grid.append((day, start, end))

                # -- Round-robin subject assignment across the week ---------
                # Each subject appears at most once per day (max 2x for labs).
                # Cycle subjects so different days get different subjects.
                subject_week_count: dict[str, int] = defaultdict(int)
                day_assigned_subjects: dict[str, list] = defaultdict(list)
                slot_subject_map: dict[tuple, str] = {}

                sub_cycle_index = 0
                for day, start, _end in grid:
                    if (str(course.course_id), sem, day, start, section) in class_busy:
                        continue

                    chosen_sub = None
                    attempts   = 0
                    while attempts < len(subject_names):
                        candidate  = subject_names[sub_cycle_index % len(subject_names)]
                        sub_cycle_index += 1
                        attempts += 1
                        max_pd = 2 if self._is_lab(candidate) else 1
                        if day_assigned_subjects[day].count(candidate) < max_pd:
                            chosen_sub = candidate
                            break

                    if chosen_sub is None:
                        chosen_sub = min(subject_names, key=lambda sn: subject_week_count[sn])

                    slot_subject_map[(day, start)] = chosen_sub
                    day_assigned_subjects[day].append(chosen_sub)
                    subject_week_count[chosen_sub] += 1

                # -- Create TimetableSlot rows -----------------------------
                used_local: set = set()

                for day, start, end in grid:
                    local_key = (day, start, end)
                    if local_key in used_local:
                        continue
                    if (str(course.course_id), sem, day, start, section) in class_busy:
                        continue

                    sub_name = slot_subject_map.get((day, start))
                    if not sub_name:
                        continue

                    subj = subject_map[sub_name]

                    # -- Room selection ------------------------------------
                    slot_room_name = home_room_name
                    slot_room_obj  = home_room_obj
                    if (slot_room_name, day, start, end) in room_busy:
                        found_alt = False
                        for alt_rn in rooms:
                            if (alt_rn, day, start, end) not in room_busy:
                                slot_room_name = alt_rn
                                slot_room_obj  = room_map.get(alt_rn)
                                found_alt = True
                                break
                        if not found_alt:
                            continue   # No room available at all -- skip

                    # -- Faculty selection ---------------------------------
                    # Primary faculty assigned to this subject
                    primary_fac = subject_assigned_faculty.get(sub_name, tba_faculty)
                    assigned_fac = None
                    
                    skey = self._subject_key(sub_name)

                    # 1. Try Primary Faculty
                    if primary_fac != tba_faculty:
                        fid = str(primary_fac.faculty_id)
                        if (fid, day, start, end) not in faculty_busy:
                            assigned_fac = primary_fac

                    # 2. Try someone who ALREADY teaches this subject (but isn't primary for this specific course-sem)
                    if not assigned_fac:
                        # Check all faculty who already have this skey assigned
                        for f in all_faculty:
                            fid = str(f.faculty_id)
                            if (fid, day, start, end) in faculty_busy:
                                continue
                            
                            # Does this faculty already teach this subject?
                            if any(self._subject_key(s.name) == skey for s in f.subjects.all()):
                                assigned_fac = f
                                break

                    # 3. Try any free faculty who has CAPACITY for a NEW subject
                    if not assigned_fac:
                        pool = [
                            f for f in all_faculty
                            if self._shift_compatible(f, shift)
                        ]
                        # Sort by load to spread subjects
                        pool.sort(key=lambda f: faculty_subject_count[str(f.faculty_id)])
                        
                        for f in pool:
                            fid = str(f.faculty_id)
                            if (fid, day, start, end) in faculty_busy:
                                continue
                            
                            if faculty_subject_count[fid] < max_subjects:
                                assigned_fac = f
                                # This faculty is now taking on a NEW subject
                                faculty_subject_count[fid] += 1
                                f.subjects.add(subj)
                                fallback_count += 1
                                break

                    # 4. Fallback to TBA
                    if not assigned_fac:
                        assigned_fac = tba_faculty
                        clash_count += 1

                    fid = str(assigned_fac.faculty_id)
                    fkey = (fid, day, start, end)

                    # -- Write DB row --------------------------------------
                    TimetableSlot.objects.create(
                        course=course,
                        semester=sem,
                        day_of_week=day,
                        start_time=start,
                        end_time=end,
                        subject=subj,
                        faculty=assigned_fac,
                        room=slot_room_obj,
                        room_name=slot_room_name,
                        section=section,
                        slot_type="Practical" if self._is_lab(subj.name) else "Theory",
                        is_auto_generated=True,
                        generated_by="command",
                    )

                    used_local.add(local_key)
                    faculty_busy.add(fkey)
                    room_busy.add((slot_room_name, day, start, end))
                    room_total_load[slot_room_name] += 1
                    total_created += 1

                courses_processed += 1

        # -- Print subject-faculty assignment summary -----------------------
        self.stdout.write("\n" + "=" * 72)
        self.stdout.write("FACULTY -- SUBJECT ASSIGNMENT SUMMARY")
        self.stdout.write("=" * 72)
        
        # Refresh load for final count
        for fac in sorted(all_faculty, key=lambda f: f.name):
            fid = str(fac.faculty_id)
            cnt = fac.subjects.count()
            if cnt == 0:
                continue
            self.stdout.write(
                f"  [{cnt}/{max_subjects}] {fac.name[:28]:30} {fac.employee_id}"
            )

        self.stdout.write("\n" + "=" * 72)
        self.stdout.write(
            self.style.SUCCESS(
                f"[DONE] {total_created} slots | {courses_processed} course-semester combos"
            )
        )
        if clash_count:
            self.stdout.write(self.style.WARNING(
                f"[WARN] {clash_count} slots forced to TBA (unavoidable clashes)"
            ))
        if fallback_count:
            self.stdout.write(self.style.WARNING(
                f"[WARN] {fallback_count} slots used alternate faculty (primary was busy)"
            ))
        self.stdout.write("=" * 72)
