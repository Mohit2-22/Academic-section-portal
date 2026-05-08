"""
assign_faculty_lectures.py
===========================
Ensures every active faculty member has AT LEAST 3 lectures assigned
in the timetable (across all courses/semesters).

If faculty pool is insufficient (fewer faculty than needed to cover all
slots), the command generates additional placeholder faculty entries so
the timetable can be fully staffed.

Run:
    python manage.py assign_faculty_lectures
    python manage.py assign_faculty_lectures --min 3 --create_new
"""

from collections import defaultdict
from django.core.management.base import BaseCommand
from django.db import transaction
from academics.models import TimetableSlot, Subject
from users.models import Faculty, User


class Command(BaseCommand):
    help = "Ensure every active faculty has >= 3 timetable lectures; optionally create new faculty."

    def add_arguments(self, parser):
        parser.add_argument(
            "--min",
            type=int,
            default=3,
            help="Minimum lectures per faculty (default: 3)",
        )
        parser.add_argument(
            "--create_new",
            action="store_true",
            default=False,
            help="Auto-create new faculty if the pool is insufficient",
        )
        parser.add_argument(
            "--dept",
            type=str,
            default="Computer Applications",
            help="Department for auto-created faculty",
        )

    def handle(self, *args, **options):
        min_lectures = options["min"]
        create_new = options["create_new"]
        dept = options["dept"]

        self.stdout.write("=" * 70)
        self.stdout.write("FACULTY LECTURE ASSIGNMENT AUDIT")
        self.stdout.write("=" * 70)

        # ── Count current assignments per faculty ──────────────────────────
        faculty_load = defaultdict(int)
        for slot in TimetableSlot.objects.select_related("faculty").all():
            if slot.faculty_id:
                faculty_load[str(slot.faculty_id)] += 1

        all_faculty = list(
            Faculty.objects.filter(status="Active").exclude(name__icontains="TBA")
        )

        self.stdout.write(f"\nTotal active faculty: {len(all_faculty)}")
        self.stdout.write(f"Minimum lectures required per faculty: {min_lectures}\n")

        # Identify under-assigned faculty
        under_assigned = [
            f
            for f in all_faculty
            if faculty_load[str(f.faculty_id)] < min_lectures
        ]

        self.stdout.write(
            f"Faculty below minimum ({min_lectures} lectures): {len(under_assigned)}"
        )

        if not under_assigned:
            self.stdout.write(
                self.style.SUCCESS(
                    "\n[OK] All faculty already have >= "
                    f"{min_lectures} lectures. Nothing to do."
                )
            )
            return

        for f in under_assigned:
            current = faculty_load[str(f.faculty_id)]
            self.stdout.write(
                f"  [{f.employee_id}] {f.name}: {current} lectures "
                f"(needs {min_lectures - current} more)"
            )

        # ── Find unassigned / lightly-loaded slots to fill ────────────────
        # Slots with TBA faculty or slots where total assignments < min
        tba_slots = list(
            TimetableSlot.objects.filter(
                faculty__name__icontains="TBA"
            ).select_related("subject", "course")[:200]
        )

        self.stdout.write(f"\nTBA slots available for reassignment: {len(tba_slots)}")

        assigned_count = 0
        tba_iter = iter(tba_slots)

        with transaction.atomic():
            for faculty in under_assigned:
                need = min_lectures - faculty_load[str(faculty.faculty_id)]
                # Check if faculty has subjects assigned in the M2M
                assigned_subjects = list(faculty.subjects.all())

                filled = 0
                for slot in tba_iter:
                    if filled >= need:
                        break

                    # Prefer slots whose subject matches faculty's assignments
                    if assigned_subjects:
                        subject_match = any(
                            str(s.subject_id) == str(slot.subject_id)
                            for s in assigned_subjects
                        )
                    else:
                        subject_match = True  # No restriction if no M2M yet

                    if subject_match or not assigned_subjects:
                        slot.faculty = faculty
                        slot.save(update_fields=["faculty"])

                        # Also add subject to faculty.subjects M2M if missing
                        if slot.subject and slot.subject not in assigned_subjects:
                            faculty.subjects.add(slot.subject)
                            assigned_subjects.append(slot.subject)

                        faculty_load[str(faculty.faculty_id)] += 1
                        filled += 1
                        assigned_count += 1
                        self.stdout.write(
                            f"  Assigned [{slot.day_of_week} {slot.start_time}] "
                            f"{slot.subject.code if slot.subject else '?'} "
                            f"→ {faculty.name}"
                        )

        self.stdout.write(
            self.style.SUCCESS(f"\n[DONE] Reassigned {assigned_count} TBA slots to under-assigned faculty.")
        )

        # ── Optionally create new faculty ──────────────────────────────────
        if create_new:
            # Count remaining under-assigned
            still_under = [
                f
                for f in all_faculty
                if faculty_load[str(f.faculty_id)] < min_lectures
            ]
            if still_under:
                self.stdout.write(
                    f"\n[CREATE_NEW] {len(still_under)} faculty still under threshold. "
                    "Generating new faculty members..."
                )
                new_created = 0
                with transaction.atomic():
                    for i in range(1, len(still_under) + 1):
                        emp_id = f"GU-GEN-{1000 + i:04d}"
                        if Faculty.objects.filter(employee_id=emp_id).exists():
                            continue
                        email = f"faculty.gen{i:04d}@ganpatuniversity.ac.in"
                        user, _ = User.objects.get_or_create(
                            email=email,
                            defaults={"role": "faculty"},
                        )
                        Faculty.objects.create(
                            user=user,
                            employee_id=emp_id,
                            name=f"Faculty {1000 + i}",
                            email=email,
                            phone="0000000000",
                            department=dept,
                            working_shift="Noon",
                            status="Active",
                            max_lectures_per_day=6,
                        )
                        new_created += 1
                        self.stdout.write(
                            f"  Created: {emp_id} | {email}"
                        )
                self.stdout.write(
                    self.style.SUCCESS(
                        f"[DONE] Created {new_created} new faculty members. "
                        "Re-run 'generate_timetable' to assign them to slots."
                    )
                )
        self.stdout.write("=" * 70)
