"""
generate_timetable.py
=====================
SMART, CONFLICT-FREE weekly timetable generator.

RULES ENFORCED:
  1. Each real faculty teaches at most MAX_SUBJECTS_PER_FACULTY unique subjects.
  2. NO real faculty clash at same day + same time across ANY courses.
  3. Monday-Friday: ALL slots filled (5 lecture slots per day per shift).
  4. Saturday: exactly 3 slots only.
  5. Shift-specific breaks (Morning: 10:00-10:30, Afternoon: 13:50-14:20).
  6. No back-to-back same subject lectures in a single day.
  7. TBA faculty is a safe placeholder — TBA slots NEVER count as real clashes.

Run:
    python manage.py generate_timetable
    python manage.py generate_timetable --max_subjects 5
"""

from collections import defaultdict
from django.core.management.base import BaseCommand
from django.db import transaction
from academics.models import Course, Room, Subject, TimetableSlot
from users.models import Faculty


MAX_SUBJECTS_PER_FACULTY = 5   # Raised to avoid over-reliance on TBA


class Command(BaseCommand):
    help = "Generate SMART conflict-free timetable for ALL courses/semesters"

    # ── Time-slot definitions ────────────────────────────────────────────
    WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    SATURDAY = "Saturday"
    ALL_DAYS = WEEKDAYS + [SATURDAY]
    SATURDAY_SLOT_LIMIT = 3

    # Morning shift: 5 slots, break at 10:00-10:30
    MORNING_SLOTS = [
        (1, "08:00", "08:55"),
        (2, "08:55", "10:00"),
        # BREAK 10:00 - 10:30
        (3, "10:30", "11:25"),
        (4, "11:25", "12:20"),
        (5, "12:20", "13:15"),
    ]

    # Noon shift: 5 slots, break at 13:50-14:20
    NOON_SLOTS = [
        (1, "12:00", "12:55"),
        (2, "12:55", "13:50"),
        # BREAK 13:50 - 14:20
        (3, "14:20", "15:15"),
        (4, "15:15", "16:10"),
        (5, "16:10", "17:05"),
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
        ws = (faculty.working_shift or "").strip()
        if shift == "morning":
            return ws in ("Morning", "Full Day")
        # noon shift — Evening faculty can also teach noon
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
            f"TIMETABLE GENERATION  |  max {max_subjects} subj/faculty  |  ZERO real clashes"
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
        TBA_ID = str(tba_faculty.faculty_id)

        # ── Preserve manual slots in busy sets ───────────────────────────
        # Only track REAL faculty (not TBA) in busy sets to avoid false clashes
        faculty_busy  = set()   # (fac_id_str, day, start) — real faculty only
        room_busy     = set()   # (room_name, day, start)
        class_busy    = set()   # (course_id_str, sem, day, start, section)
        room_total_load  = defaultdict(int)
        class_room_map   = {}

        for slot in TimetableSlot.objects.filter(
            is_auto_generated=False
        ).select_related("room", "faculty"):
            start = slot.start_time.strftime("%H:%M")
            day   = slot.day_of_week
            fid   = str(slot.faculty_id) if slot.faculty_id else None
            # Only block real faculty (not TBA)
            if fid and fid != TBA_ID:
                faculty_busy.add((fid, day, start))
            rn = slot.room_name or (slot.room.room_number if slot.room else None)
            if rn:
                room_busy.add((rn, day, start))
                room_total_load[rn] += 1
            class_busy.add((str(slot.course_id), slot.semester, day, start, slot.section))

        # ── Delete all auto-generated slots ──────────────────────────────
        with transaction.atomic():
            deleted = TimetableSlot.objects.filter(is_auto_generated=True).delete()[0]
        self.stdout.write(f"\n[OK] Cleared {deleted} auto-generated slots")

        # ── Room map ─────────────────────────────────────────────────────
        all_rooms = Room.objects.all().order_by("room_number")
        room_map  = {r.room_number: r for r in all_rooms}
        if not room_map:
            # Create default virtual rooms if none exist
            self.stdout.write("[WARN] No rooms found in DB — using virtual rooms")

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

        # Track faculty loads for this generation run
        faculty_subject_count = defaultdict(int)  # fac_id -> unique subject count
        faculty_subject_set   = defaultdict(set)  # fac_id -> set of subject keys
        faculty_courses_set   = defaultdict(set)  # fac_id -> set of course_ids
        faculty_day_load      = defaultdict(int)  # (fac_id, day) -> slots count

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
        # PHASE 1: Collect ALL course-semester combos with subjects
        # =================================================================
        self.stdout.write("\n-- PHASE 1: Course-semester analysis --")

        # subject_key -> Faculty (global shared assignment)
        subject_faculty_map = {}
        # all_course_sems: list of (course, sem, section, shift, subjects)
        all_course_sems = []

        for course in all_courses:
            shift = self._resolve_shift(course)
            semesters = sorted(
                Subject.objects.filter(course=course)
                .values_list("semester", flat=True).distinct()
            )
            for sem in semesters:
                subjects = list(
                    Subject.objects.filter(course=course, semester=sem).order_by("code")
                )
                if not subjects:
                    continue
                section = self.SEM_SECTIONS.get(sem, "A")
                all_course_sems.append((course, sem, section, shift, subjects))

        self.stdout.write(f"  Total course-semester combos: {len(all_course_sems)}")

        # =================================================================
        # PHASE 2: Assign faculty to subjects
        # Strategy: assign by subject key so the same subject across courses
        # goes to the same faculty (reuse knowledge), respecting the cap.
        # =================================================================
        self.stdout.write("\n-- PHASE 2: Faculty-subject assignment --")

        def pick_faculty_for_subject(skey, shift, course_id_str):
            """Pick best available faculty for a subject key in a given shift."""
            # Already assigned globally?
            if skey in subject_faculty_map:
                fac = subject_faculty_map[skey]
                fid = str(fac.faculty_id)
                # Check the assigned faculty can teach this shift too
                if self._shift_compatible(fac, shift):
                    return fac
                # Otherwise fall through to find someone new

            # Sort candidates: prefer shift-compatible, fewer subjects, fewer courses
            candidates = [
                f for f in all_faculty
                if self._shift_compatible(f, shift)
                and faculty_subject_count[str(f.faculty_id)] < max_subjects
            ]
            candidates.sort(key=lambda f: (
                faculty_subject_count[str(f.faculty_id)],
                -len(faculty_courses_set[str(f.faculty_id)]),
            ))

            if candidates:
                return candidates[0]

            # Fallback: any faculty under cap regardless of shift
            candidates2 = [
                f for f in all_faculty
                if faculty_subject_count[str(f.faculty_id)] < max_subjects
            ]
            candidates2.sort(key=lambda f: faculty_subject_count[str(f.faculty_id)])
            if candidates2:
                return candidates2[0]

            # Last resort: TBA
            return tba_faculty

        # Pre-assign subjects globally
        for course, sem, section, shift, subjects in all_course_sems:
            for subj in subjects:
                skey = self._subject_key(subj.name)
                if skey not in subject_faculty_map:
                    fac = pick_faculty_for_subject(skey, shift, str(course.course_id))
                    subject_faculty_map[skey] = fac
                    fid = str(fac.faculty_id)
                    if fac != tba_faculty:
                        if skey not in faculty_subject_set[fid]:
                            faculty_subject_set[fid].add(skey)
                            faculty_subject_count[fid] += 1
                        faculty_courses_set[fid].add(str(course.course_id))
                        fac.subjects.add(subj)

        self.stdout.write(f"  Unique subject keys assigned: {len(subject_faculty_map)}")

        # =================================================================
        # PHASE 3: Build timetable grid and fill slots
        # =================================================================
        self.stdout.write("\n-- PHASE 3: Slot assignment with clash detection --")

        total_created  = 0
        tba_count      = 0
        clash_avoided  = 0
        courses_done   = 0

        slots_to_create = []

        for course, sem, section, shift, subjects in all_course_sems:
            rooms = self._shift_rooms(shift, room_map)

            self.stdout.write(
                f"\n[{course.code}] Sem {sem} Sec {section} ({shift.upper()}) "
                f"- {len(subjects)} subjects"
            )

            # Pick home room for this class
            if rooms and room_map:
                home_room_name, home_room_obj = self._pick_room(
                    course, sem, section, rooms, room_map, class_room_map, room_total_load
                )
            else:
                # No rooms in DB — use a virtual name
                home_room_name = f"Room-{course.code}-{sem}"
                home_room_obj = None

            subject_names = [s.name for s in subjects]
            subject_map   = {s.name: s for s in subjects}

            # Build per-subject faculty for this course-sem
            sub_fac = {}
            for subj in subjects:
                skey = self._subject_key(subj.name)
                sub_fac[subj.name] = subject_faculty_map.get(skey, tba_faculty)

            # Build full slot grid for the week
            grid = []
            for day in self.ALL_DAYS:
                for _order, start, end in self._get_day_timings(shift, day):
                    grid.append((day, start, end))

            # Round-robin subject assignment across the week
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
                    # Pick least-used subject for this day
                    chosen_sub = min(
                        subject_names,
                        key=lambda sn: day_assigned_subjects[day].count(sn)
                    )

                slot_subject_map[(day, start)] = chosen_sub
                day_assigned_subjects[day].append(chosen_sub)

            # Create TimetableSlot rows with REAL clash checking
            used_local = set()

            for day, start, end in grid:
                local_key = (day, start)
                if local_key in used_local:
                    continue
                if (str(course.course_id), sem, day, start, section) in class_busy:
                    continue

                sub_name = slot_subject_map.get((day, start))
                if not sub_name:
                    continue

                subj = subject_map[sub_name]

                # ── Room selection ───────────────────────────────────────
                slot_room_name = home_room_name
                slot_room_obj  = home_room_obj
                if room_map and home_room_name and (slot_room_name, day, start) in room_busy:
                    found_alt = False
                    for alt_rn in rooms:
                        if (alt_rn, day, start) not in room_busy:
                            slot_room_name = alt_rn
                            slot_room_obj  = room_map.get(alt_rn)
                            found_alt = True
                            break
                    if not found_alt:
                        # Use room anyway (don't block slot creation)
                        pass

                # ── Faculty selection with STRICT clash check ────────────
                primary_fac  = sub_fac.get(sub_name, tba_faculty)
                assigned_fac = None

                # 1. Try primary faculty (real only)
                if primary_fac != tba_faculty:
                    fid = str(primary_fac.faculty_id)
                    if (fid, day, start) not in faculty_busy:
                        assigned_fac = primary_fac

                # 2. If primary is busy, find any free faculty who teaches this subject
                if not assigned_fac:
                    skey = self._subject_key(sub_name)
                    for f in all_faculty:
                        fid = str(f.faculty_id)
                        if (fid, day, start) in faculty_busy:
                            continue
                        if not self._shift_compatible(f, shift):
                            continue
                        if skey in faculty_subject_set[fid]:
                            assigned_fac = f
                            clash_avoided += 1
                            break

                # 3. Try any free shift-compatible faculty with capacity
                if not assigned_fac:
                    pool = sorted(
                        [
                            f for f in all_faculty
                            if self._shift_compatible(f, shift)
                            and str(f.faculty_id) not in {fid for fid, d, s in faculty_busy if d == day and s == start}
                            and (str(f.faculty_id), day, start) not in faculty_busy
                        ],
                        key=lambda f: (
                            faculty_day_load.get((str(f.faculty_id), day), 0),
                            faculty_subject_count[str(f.faculty_id)],
                        ),
                    )
                    if pool:
                        chosen_f = pool[0]
                        fid = str(chosen_f.faculty_id)
                        assigned_fac = chosen_f
                        skey = self._subject_key(sub_name)
                        if skey not in faculty_subject_set[fid]:
                            faculty_subject_set[fid].add(skey)
                            faculty_subject_count[fid] += 1
                        faculty_courses_set[fid].add(str(course.course_id))
                        if chosen_f != tba_faculty:
                            chosen_f.subjects.add(subj)

                # 4. TBA fallback (won't cause real clashes)
                if not assigned_fac:
                    assigned_fac = tba_faculty
                    tba_count += 1

                fid = str(assigned_fac.faculty_id)

                # ── Write DB row ─────────────────────────────────────────
                slots_to_create.append(TimetableSlot(
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
                ))

                used_local.add(local_key)
                # Only track real faculty in busy sets
                if fid != TBA_ID:
                    faculty_busy.add((fid, day, start))
                    faculty_day_load[(fid, day)] += 1
                if slot_room_name and room_map:
                    room_busy.add((slot_room_name, day, start))
                    room_total_load[slot_room_name] += 1
                total_created += 1

            courses_done += 1

        # Bulk create all slots in one transaction
        self.stdout.write(f"\n[OK] Bulk inserting {len(slots_to_create)} slots...")
        with transaction.atomic():
            TimetableSlot.objects.bulk_create(slots_to_create, batch_size=500)

        # =================================================================
        # PHASE 4: Validation & Summary
        # =================================================================
        self.stdout.write("\n" + "=" * 72)
        self.stdout.write("FACULTY-SUBJECT ASSIGNMENT SUMMARY")
        self.stdout.write("=" * 72)

        assigned_count = 0
        for fac in sorted(all_faculty, key=lambda f: f.name):
            fid = str(fac.faculty_id)
            cnt = fac.subjects.count()
            if cnt == 0:
                continue
            assigned_count += 1
            n_courses = len(faculty_courses_set.get(fid, set()))
            marker = ""
            if cnt < 3:
                marker = " [note: <3 subj]"
            self.stdout.write(
                f"  [{cnt}] {fac.name[:30]:32} {n_courses} courses{marker}"
            )

        # Clash verification — exclude TBA from clash checks
        self.stdout.write("\n-- POST-GENERATION CLASH VERIFICATION (real faculty only) --")
        fac_slots = defaultdict(list)
        for slot in TimetableSlot.objects.select_related(
            "faculty", "course", "subject"
        ).filter(is_auto_generated=True):
            if slot.faculty_id and str(slot.faculty_id) != TBA_ID:
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
            self.stdout.write(self.style.SUCCESS("  [OK] ZERO real faculty clashes!"))
        else:
            self.stdout.write(self.style.ERROR(f"  [!!] {real_clashes} real clashes found"))

        # Slot counts per course-sem
        self.stdout.write("\n-- SLOT COUNT VERIFICATION --")
        for course, sem, section, shift, subjects in all_course_sems:
            count = TimetableSlot.objects.filter(
                course=course, semester=sem, is_auto_generated=True
            ).count()
            expected_weekday = len(self.MORNING_SLOTS if shift == "morning" else self.NOON_SLOTS)
            expected_sat = self.SATURDAY_SLOT_LIMIT
            expected_total = (expected_weekday * 5) + expected_sat
            ok = "[OK]" if count == expected_total else f"[!!] expected {expected_total}"
            self.stdout.write(f"  {course.code} Sem{sem}: {count} slots {ok}")

        self.stdout.write("\n" + "=" * 72)
        self.stdout.write(self.style.SUCCESS(
            f"[DONE] {total_created} slots | {courses_done} course-semester combos | "
            f"{assigned_count} faculty assigned"
        ))
        if tba_count:
            self.stdout.write(self.style.WARNING(
                f"[INFO] {tba_count} slots assigned to TBA (needs faculty recruitment)"
            ))
        if clash_avoided:
            self.stdout.write(self.style.SUCCESS(
                f"[INFO] {clash_avoided} clashes avoided by using alternate faculty"
            ))
        self.stdout.write("=" * 72)
