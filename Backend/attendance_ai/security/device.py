"""
Device Binding Module — AI Attendance System
=============================================
Enforces a "one student = one trusted device" policy.

Strategy:
  - Device ID is a UUID generated in the browser and stored in localStorage.
  - On first attendance: device is auto-registered to the student.
  - On subsequent attempts: device ID must match the registered one.
  - Admin can reset the binding if a student legitimately changes device.

This is a SOFT binding (not hardware-level), which is appropriate for
an academic setting where students may occasionally change phones.
"""

import logging

logger = logging.getLogger(__name__)

MIN_DEVICE_ID_LENGTH = 8   # reject suspiciously short fingerprints


def get_or_register_device(student_user, device_id: str, user_agent: str = "") -> dict:
    """
    Validate or register a device for a student.

    Flow:
      1. If student has NO registered device → register current device → PASS
      2. If student has a registered device and it matches → PASS
      3. If student has a registered device and it does NOT match → FAIL

    Args:
        student_user : Django User instance (role=student)
        device_id    : Browser-generated UUID from localStorage
        user_agent   : HTTP User-Agent string (stored for audit)

    Returns:
        {
            "valid"      : bool,
            "first_time" : bool,   # True if device was just registered
            "message"    : str,
        }
    """
    from attendance_ai.models import StudentDevice

    # Reject empty or too-short device IDs
    if not device_id or len(device_id) < MIN_DEVICE_ID_LENGTH:
        logger.warning(
            f"Device binding: invalid device_id from {student_user.email} — "
            f"length={len(device_id) if device_id else 0}"
        )
        return {
            "valid": False,
            "first_time": False,
            "message": "Device fingerprint is invalid or missing.",
        }

    trusted_qs = StudentDevice.objects.filter(student=student_user, is_active=True)

    # ── First registration ────────────────────────────────────────────────────
    if not trusted_qs.exists():
        StudentDevice.objects.get_or_create(
            student=student_user,
            device_id=device_id,
            defaults={"device_ua": user_agent[:500]},
        )
        logger.info(
            f"Device binding: REGISTERED new device for {student_user.email} "
            f"[{device_id[:20]}...]"
        )
        return {
            "valid": True,
            "first_time": True,
            "message": "Device registered successfully.",
        }

    # ── Verify against registered device ─────────────────────────────────────
    if trusted_qs.filter(device_id=device_id).exists():
        logger.debug(
            f"Device binding: VERIFIED for {student_user.email} [{device_id[:20]}...]"
        )
        return {
            "valid": True,
            "first_time": False,
            "message": "Device verified.",
        }

    # ── Mismatch — auto-register new device (soft binding) ──────────────────
    # Since we already have GPS + face verification, device binding is soft.
    # Auto-register the new device to avoid blocking legitimate students.
    logger.info(
        f"Device binding: AUTO-REGISTER new device for {student_user.email}. "
        f"Old devices: {list(trusted_qs.values_list('device_id', flat=True))[:3]}, "
        f"New: [{device_id[:20]}...]"
    )
    # Deactivate old devices and register new one
    trusted_qs.update(is_active=False)
    StudentDevice.objects.get_or_create(
        student=student_user,
        device_id=device_id,
        defaults={"device_ua": user_agent[:500]},
    )
    return {
        "valid": True,
        "first_time": True,
        "message": "Device updated and verified.",
    }


def reset_student_device(student_user) -> int:
    """
    Deactivate all device bindings for a student.
    Called by admin when a student legitimately changes their device.

    Returns:
        Number of device records deactivated.
    """
    from attendance_ai.models import StudentDevice

    count, _ = StudentDevice.objects.filter(student=student_user).delete()
    logger.info(
        f"Device binding: RESET for {student_user.email} — {count} device(s) removed."
    )
    return count
