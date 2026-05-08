from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.mail import send_mail
from django.conf import settings
from .models import Student, Faculty

@receiver(post_save, sender=Student)
def send_student_welcome_email(sender, instance, created, **kwargs):
    if created:
        subject = 'Welcome to Ganpat University - Admission Confirmation'
        message = (
            f"Dear {instance.name},\n\n"
            f"Congratulations and welcome to Ganpat University! Your admission has been confirmed.\n"
            f"Your enrollment number is: {instance.enrollment_no}\n\n"
            f"Please login to the portal using this link: http://localhost:5173\n\n"
            f"Best Regards,\nGanpat University Administration"
        )
        # Email is now handled in admin_views.py to include password credentials
        # if hasattr(instance, 'email') and instance.email:
        #     send_mail(subject, message, settings.EMAIL_HOST_USER, [instance.email], fail_silently=True)
        # elif getattr(instance.user, 'email', None):
        #     send_mail(subject, message, settings.EMAIL_HOST_USER, [instance.user.email], fail_silently=True)

@receiver(post_save, sender=Faculty)
def send_faculty_welcome_email(sender, instance, created, **kwargs):
    if created:
        subject = 'Welcome to Ganpat University - Faculty Registration'
        message = (
            f"Dear {instance.name},\n\n"
            f"Welcome to Ganpat University! Your faculty account has been created.\n"
            f"Your Faculty ID is: {instance.employee_id if hasattr(instance, 'employee_id') else getattr(instance, 'faculty_id', '')}\n\n"
            f"Please login to the portal using this link: http://localhost:5173\n\n"
            f"Best Regards,\nGanpat University Administration"
        )
        # Email is now handled in admin_views.py to include password credentials
        # recipient_email = getattr(instance, 'email', None) or getattr(instance.user, 'email', None)
        # if recipient_email:
        #     send_mail(subject, message, settings.EMAIL_HOST_USER, [recipient_email], fail_silently=True)
