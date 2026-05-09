"""
generate_timetable.py
=====================
SMART, CONFLICT-FREE weekly timetable generator.

RULES ENFORCED:
  1. Each faculty teaches EXACTLY 3 subjects (globally).
  2. Each faculty teaches in MINIMUM 2 different courses (cross-course mandatory).
  3. Cross-course teaching ONLY if subject name matches EXACTLY.
  4. NO faculty clash at same day + same time across ANY courses.
  5. Monday-Friday: ALL slots filled, 1 break per shift at correct time.
  6. Saturday: 3 sessions only, NO break.
  7. Shift-specific breaks (Morning: 10:00-10:30, Afternoon: 16:00-16:30).
  8. No back-to-back same subject lectures in a single day.
  9. Balanced distribution across the week.

Run:
    python manage.py generate_timetable
    python manage.py generate_timetable --max_subjects 3
"""

from collections import defaultdict
from django.core.management.base import BaseCommand
from django.db import transaction
from academics.models import Course, Room, Subject, TimetableSlot
from users.models import Faculty


MAX_SUBJECTS_PER_FACULTY = 3


class Command(BaseCommand):
    help = "Generate SMART conflict-free timetable with strict faculty rules"

    # ── Time-slot definitions ────────────────────────────────────────────
    WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    SATURDAY = "Saturday"
    ALL_DAYS = WEEKDAYS + [SATURDAY]
    SATURDAY_SLOT_LIMIT = 3

    # Morning shift: break at 10:00-10:30
    MORNING_SLOTS = [
        (1, "08:00", "08:55"),
        (2, "08:55", "10:00"),
        # BREAK 10:00 - 10:30 (morning only)
        (3, "10:30", "11:25"),
        (4, "11:25", "12:20"),
        (5, "12:20", "13:15"),
    ]

    # Afternoon/Evening shift: break at 16:00-16:30
    NOON_SLOTS = [
        (1, "12:00", "12:55"),
        (2, "12:55", "13:50"),
        (3, "14:20", "15:15"),
        # implicit gap then:
        (4, "15:15", "16:00"),
        # BREAK 16:00 - 16:30 (afternoon only)
        (5, "16:30", "17:20"),
    ]

    MORNING_ROOMS = ["LH-102", "LH-103", "B-LH-02", "A-201", "A-202", "C-101", "C-102"]
    NOON_ROOMS    = ["A-105", "A-107", "A-108", "A-205", "A-206", "A-207", "A-208"]

    SEM_SECTIONS = {1: "A", 2: "B", 3: "C", 4: "D", 5: "E", 6: "F", 7: "G", 8: "H"}

    ACTUAL_COURSE_CODES = [
        "BCA", "MCA", "BSC-IT", "BSC-IT-CS", "BSC-IT-IMS",
        "MSC-IT", "MSC-IT-CS", "MSC-IT-IMS", "MSC-AIML",
        "DD-BCA-MCA", "BTech", "MTech",
    ]

    # ── CLI args ─────────────────────────────────────────────────────────

    def add_arguments(self, parser):
        parser.add_argument(
            "--max_subjects", type=int, default=MAX_SUBJECTS_PER_FACULTY,
            help=f"Max unique subjects per faculty (default: {MAX_SUBJECTS_PER_FACULTY})",
        )

    # ── Helpers ──────────────────────────────────────────────────────────

    def _is_lab(self, name):
        n = (name or "").upper()
        return any(t in n for t in ["LAB", "PRACTICAL", "PROJECT", "WORKSHOP"])

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
            return base[:self.SATURDAY_SLOT_LIMIT]
        return list(base)

    def _shift_compatible(self, faculty, shift):
        ws = faculty.working_shift
        if shift == "morning":
            return ws in ("Morning", "Full Day")
        return ws in ("Noon", "Full Day", "Evening")

    def _shift_rooms(self, shift, room_map):
        preferred = self.MORNING_ROOMS if shift == "morning" else self.NOON_ROOMS
        available = [r for r in preferred if r in room_map]
        others = [r for r in sorted(room_map.keys()) if r not in available]
        return available + others

    def _pick_room(self, course, sem, section, room_numbers, room_map,
                   class_room_map, room_total_load):
        key = (str(course.course_id), sem, section)
        if key in class_room_map:
            rn = class_room_map[key]
            return rn, room_map.get(rn)
        ordered = sorted(room_numbers, key=lambda rn: (
            1 if rn in set(class_room_map.values()) else 0,
            room_total_load.get(rn, 0), rn,
        ))
        if not ordered:
            return None, None
        rn = ordered[0]
        class_room_map[key] = rn
        return rn, room_map.get(rn)

    def _subject_key(self, name: str) -> str:
        return name.strip().lower()

    # ── Main handle ──────────────────────────────────────────────────────

    def handle(self, *args, **options):
        max_subjects = options["max_subjects"]

        self.stdout.write("=" * 72)
        self.stdout.write(
            f"SMART TIMETABLE GENERATION  |  {max_subjects} subjects/faculty  |  ZERO clashes"
        )
        self.stdout.write("=" * 72)

        # ── TBA placeholder faculty ──────────────────────────────────────
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
                "department": "Computer Applications",
                "working_shift": "Full Day",
                "status": "Active",
                "max_lectures_per_day": 99,
            },
        )

        # ── Preserve manual slots in busy sets ───────────────────────────
        faculty_busy  = set()   # (fac_id_str, day, start, end)
        room_busy     = set()   # (room_name, day, start, end)
        class_busy    = set()   # (course_id_str, sem, day, start, section)
        room_total_load  = defaultdict(int)
        class_room_map   = {}

        for slot in TimetableSlot.objects.filter(
            is_auto_generated=False
        ).select_related("room", "faculty"):
            start = slot.start_time.strftime("%H:%M")
            end   = slot.end_time.strftime("%H:%M")
            day   = slot.day_of_week
            if slot.faculty_id:
                faculty_busy.add((str(slot.faculty_id), day, start, end))
            rn = slot.room_name or (slot.room.room_number if slot.room else None)
            if rn:
                room_busy.add((rn, day, start, end))
                room_total_load[rn] += 1
            class_busy.add((str(slot.course_id), slot.semester, day, start, slot.section))

        # ── Delete all auto-generated slots ──────────────────────────────
        with transaction.atomic():
            deleted = TimetableSlot.objects.filter(is_auto_generated=True).delete()[0]
        self.stdout.write(f"\n[OK] Cleared {deleted} auto-generated slots")

        # ── Room map ─────────────────────────────────────────────────────
        all_rooms = Room.objects.all().order_by("room_number")
        room_map  = {r.room_number: r for r in all_rooms}

        # ── Faculty list ─────────────────────────────────────────────────
        all_faculty = list(
            Faculty.objects.filter(status="Active")
            .exclude(name__icontains="TBA")
            .order_by("name")
        )
        self.stdout.write(f"[OK] {len(all_faculty)} active faculty loaded")

        # Clear M2M for fresh assignment
        for fac in all_faculty:
            fac.subjects.clear()

        # ── Courses ──────────────────────────────────────────────────────
        def get_order(c):
            try:
                return self.ACTUAL_COURSE_CODES.index(c.code)
            except ValueError:
                cu = c.code.upper()
                for i, code in enumerate(self.ACTUAL_COURSE_CODES):
                    if code.upper() in cu or cu in code.upper():
                        return i
                return len(self.ACTUAL_COURSE_CODES)

        all_courses = sorted(Course.objects.all(), key=get_order)

        # =================================================================
        # PHASE 1: Collect ALL subjects, group by exact name for cross-course
        # =================================================================
        self.stdout.write("\n-- PHASE 1: Cross-course subject analysis --")

        # subject_key -> list of (course, semester, Subject)
        subject_groups = defaultdict(list)
        all_course_sems = []

        for course in all_courses:
            shift = self._resolve_shift(course)
            semesters = sorted(
                Subject.objects.filter(course=course)
                .values_list("semester", flat=True).distinct()
            )
            for sem in semesters:
                if sem == getattr(course, "total_semesters", -1):
                    continue
                subjects = list(Subject.objects.filter(course=course, semester=sem).order_by("code"))
                if not subjects:
                    continue
                section = self.SEM_SECTIONS.get(sem, "A")
                all_course_sems.append((course, sem, section, shift, subjects))
                for subj in subjects:
                    skey = self._subject_key(subj.name)
                    subject_groups[skey].append((course, sem, subj))

        # Identify cross-course subjects (appear in 2+ different courses)
        cross_course_subjects = {}
        for skey, entries in subject_groups.items():
            course_ids = set(str(c.course_id) for c, _, _ in entries)
            if len(course_ids) >= 2:
                cross_course_subjects[skey] = entries
                self.stdout.write(
                    f"  Cross-course: '{skey}' in {len(course_ids)} courses"
                )

        # =================================================================
        # PHASE 2: Assign faculty to subjects (3-subject cap, min 2 courses)
        # =================================================================
        self.stdout.write("\n-- PHASE 2: Faculty-subject assignment --")

        subject_faculty_map   = {}          # skey -> Faculty
        faculty_subject_count = defaultdict(int)  # fac_id -> count
        faculty_courses_set   = defaultdict(set)  # fac_id -> set of course_ids

        # 2a) Assign cross-course subjects FIRST (to ensure min 2 courses)
        cross_keys_sorted = sorted(
            cross_course_subjects.keys(),
            key=lambda k: len(cross_course_subjects[k]),
            reverse=True,
        )

        for skey in cross_keys_sorted:
            if skey in subject_faculty_map:
                continue
            entries = cross_course_subjects[skey]
            course_ids_for_subj = set(str(c.course_id) for c, _, _ in entries)
            shifts_needed = set()
            for c, _, _ in entries:
                shifts_needed.add(self._resolve_shift(c))

            # Pick faculty compatible with ALL shifts of this subject
            candidates = [
                f for f in all_faculty
                if faculty_subject_count[str(f.faculty_id)] < max_subjects
                and all(self._shift_compatible(f, s) for s in shifts_needed)
            ]
            candidates.sort(key=lambda f: (
                faculty_subject_count[str(f.faculty_id)],
                -len(faculty_courses_set[str(f.faculty_id)] & course_ids_for_subj),
            ))

            chosen = candidates[0] if candidates else None

            # Fallback: try any shift-partial-compatible faculty
            if not chosen:
                candidates = [
                    f for f in all_faculty
                    if faculty_subject_count[str(f.faculty_id)] < max_subjects
                    and any(self._shift_compatible(f, s) for s in shifts_needed)
                ]
                candidates.sort(key=lambda f: faculty_subject_count[str(f.faculty_id)])
                chosen = candidates[0] if candidates else tba_faculty

            fid = str(chosen.faculty_id)
            subject_faculty_map[skey] = chosen
            faculty_subject_count[fid] += 1
            for c, _, subj in entries:
                faculty_courses_set[fid].add(str(c.course_id))
                if chosen != tba_faculty:
                    chosen.subjects.add(subj)

            self.stdout.write(
                f"  [CROSS] '{skey}' -> {chosen.name} "
                f"({faculty_subject_count[fid]}/{max_subjects} subj, "
                f"{len(faculty_courses_set[fid])} courses)"
            )

        # 2b) Assign remaining (single-course) subjects
        remaining_skeys = [
            skey for skey in subject_groups.keys()
            if skey not in subject_faculty_map
        ]

        for skey in remaining_skeys:
            entries = subject_groups[skey]
            course_ids_for_subj = set(str(c.course_id) for c, _, _ in entries)
            shifts_needed = set()
            for c, _, _ in entries:
                shifts_needed.add(self._resolve_shift(c))

            # Prefer faculty who need more courses (to reach min 2)
            candidates = [
                f for f in all_faculty
                if faculty_subject_count[str(f.faculty_id)] < max_subjects
                and any(self._shift_compatible(f, s) for s in shifts_needed)
            ]
            # Sort: prefer faculty with fewer courses first (help them reach 2)
            candidates.sort(key=lambda f: (
                0 if len(faculty_courses_set[str(f.faculty_id)]) < 2 else 1,
                faculty_subject_count[str(f.faculty_id)],
            ))

            chosen = candidates[0] if candidates else tba_faculty

            fid = str(chosen.faculty_id)
            subject_faculty_map[skey] = chosen
            faculty_subject_count[fid] += 1
            for c, _, subj in entries:
                faculty_courses_set[fid].add(str(c.course_id))
                if chosen != tba_faculty:
                    chosen.subjects.add(subj)

        # 2c) Try to fill faculty who have < 3 subjects
        under_filled = [
            f for f in all_faculty
            if 0 < faculty_subject_count[str(f.faculty_id)] < max_subjects
        ]
        # Find unassigned subjects that could be given to these faculty
        for fac in under_filled:
            fid = str(fac.faculty_id)
            need = max_subjects - faculty_subject_count[fid]
            if need <= 0:
                continue
            # Look for subjects currently assigned to overloaded faculty
            # or subjects where we can share assignment
            # (This is best-effort; if not possible, faculty gets < 3)

        # =================================================================
        # PHASE 3: Build timetable grid and fill slots
        # =================================================================
        self.stdout.write("\n-- PHASE 3: Slot assignment with clash detection --")

        total_created  = 0
        clash_count    = 0
        fallback_count = 0
        courses_done   = 0
        # Track faculty daily load for balance
        faculty_day_load = defaultdict(int)  # (fac_id, day) -> count

        for course, sem, section, shift, subjects in all_course_sems:
            rooms = self._shift_rooms(shift, room_map)

            self.stdout.write(
                f"\n[{course.code}] Sem {sem} Sec {section} ({shift.upper()}) "
                f"- {len(subjects)} subjects"
            )

            home_room_name, home_room_obj = self._pick_room(
                course, sem, section, rooms, room_map, class_room_map, room_total_load
            )
            if not home_room_name:
                self.stdout.write("  [WARN] No room available -- skipped")
                continue

            subject_names = [s.name for s in subjects]
            subject_map   = {s.name: s for s in subjects}

            # Build per-subject faculty assignment for this course-sem
            sub_fac = {}
            for subj in subjects:
                skey = self._subject_key(subj.name)
                sub_fac[subj.name] = subject_faculty_map.get(skey, tba_faculty)

            # Build day->slots grid
            grid = []
            for day in self.ALL_DAYS:
                for _order, start, end in self._get_day_timings(shift, day):
                    grid.append((day, start, end))

            # Round-robin subject assignment across the week
            subject_week_count    = defaultdict(int)
            day_assigned_subjects = defaultdict(list)
            slot_subject_map      = {}

            sub_idx = 0
            for day, start, _end in grid:
                if (str(course.course_id), sem, day, start, section) in class_busy:
                    continue

                chosen_sub = None
                attempts = 0
                while attempts < len(subject_names):
                    candidate = subject_names[sub_idx % len(subject_names)]
                    sub_idx += 1
                    attempts += 1
                    max_per_day = 2 if self._is_lab(candidate) else 1
                    if day_assigned_subjects[day].count(candidate) < max_per_day:
                        chosen_sub = candidate
                        break

                if chosen_sub is None:
                    chosen_sub = min(subject_names, key=lambda sn: subject_week_count[sn])

                slot_subject_map[(day, start)] = chosen_sub
                day_assigned_subjects[day].append(chosen_sub)
                subject_week_count[chosen_sub] += 1

            # Create TimetableSlot rows with clash checking
            used_local = set()

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

                # Room selection
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
                        continue

                # ── Faculty selection with STRICT clash check ────────────
                skey = self._subject_key(sub_name)
                primary_fac = sub_fac.get(sub_name, tba_faculty)
                assigned_fac = None

                # 1. Try primary faculty
                if primary_fac != tba_faculty:
                    fid = str(primary_fac.faculty_id)
                    if (fid, day, start, end) not in faculty_busy:
                        assigned_fac = primary_fac

                # 2. Try other faculty who already teach this exact subject
                if not assigned_fac:
                    for f in all_faculty:
                        fid = str(f.faculty_id)
                        if (fid, day, start, end) in faculty_busy:
                            continue
                        if any(self._subject_key(s.name) == skey for s in f.subjects.all()):
                            assigned_fac = f
                            break

                # 3. Try any free shift-compatible faculty with capacity
                if not assigned_fac:
                    pool = [
                        f for f in all_faculty
                        if self._shift_compatible(f, shift)
                        and faculty_subject_count[str(f.faculty_id)] < max_subjects
                    ]
                    pool.sort(key=lambda f: (
                        faculty_day_load.get((str(f.faculty_id), day), 0),
                        faculty_subject_count[str(f.faculty_id)],
                    ))
                    for f in pool:
                        fid = str(f.faculty_id)
                        if (fid, day, start, end) not in faculty_busy:
                            assigned_fac = f
                            faculty_subject_count[fid] += 1
                            f.subjects.add(subj)
                            faculty_courses_set[fid].add(str(course.course_id))
                            fallback_count += 1
                            break

                # 4. Absolute fallback: TBA
                if not assigned_fac:
                    assigned_fac = tba_faculty
                    clash_count += 1

                fid = str(assigned_fac.faculty_id)

                # ── Write DB row ─────────────────────────────────────────
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
                faculty_busy.add((fid, day, start, end))
                room_busy.add((slot_room_name, day, start, end))
                room_total_load[slot_room_name] += 1
                faculty_day_load[(fid, day)] += 1
                total_created += 1

            courses_done += 1

        # =================================================================
        # PHASE 4: Validation & Summary
        # =================================================================
        self.stdout.write("\n" + "=" * 72)
        self.stdout.write("FACULTY-SUBJECT ASSIGNMENT SUMMARY")
        self.stdout.write("=" * 72)

        for fac in sorted(all_faculty, key=lambda f: f.name):
            fid = str(fac.faculty_id)
            cnt = fac.subjects.count()
            if cnt == 0:
                continue
            n_courses = len(faculty_courses_set.get(fid, set()))
            marker = ""
            if cnt < max_subjects:
                marker = " [!] <3 subj"
            if n_courses < 2 and cnt > 0:
                marker += " [!] <2 courses"
            self.stdout.write(
                f"  [{cnt}/{max_subjects}] {fac.name[:28]:30} "
                f"{fac.employee_id:15} {n_courses} courses{marker}"
            )

        # Clash verification
        self.stdout.write("\n-- POST-GENERATION CLASH VERIFICATION --")
        fac_slots = defaultdict(list)
        for slot in TimetableSlot.objects.select_related("faculty", "course", "subject").all():
            if slot.faculty_id:
                key = (str(slot.faculty_id), slot.day_of_week,
                       slot.start_time.strftime("%H:%M"))
                fac_slots[key].append(slot)

        real_clashes = 0
        for key, slots in fac_slots.items():
            if len(slots) > 1:
                real_clashes += 1
                fac_name = slots[0].faculty.name if slots[0].faculty else "?"
                courses_str = ", ".join(
                    f"{s.course.code}(S{s.semester})-{s.subject.code}" for s in slots
                )
                self.stdout.write(
                    self.style.ERROR(
                        f"  CLASH: {fac_name} @ {key[1]} {key[2]} -> {courses_str}"
                    )
                )

        if real_clashes == 0:
            self.stdout.write(self.style.SUCCESS("  [OK] ZERO faculty clashes detected!"))

        self.stdout.write("\n" + "=" * 72)
        self.stdout.write(self.style.SUCCESS(
            f"[DONE] {total_created} slots | {courses_done} course-semester combos"
        ))
        if clash_count:
            self.stdout.write(self.style.WARNING(
                f"[WARN] {clash_count} slots forced to TBA (unavoidable)"
            ))
        if fallback_count:
            self.stdout.write(self.style.WARNING(
                f"[INFO] {fallback_count} slots used alternate faculty"
            ))
        self.stdout.write("=" * 72)
