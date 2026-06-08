import uuid
from django.db import models
from apps.core.models import Student, Batch

# ==========================================
# FEES (linked to students)
# ==========================================
class Fee(models.Model):
    """
    Financial records tracking student fee requirements, outstanding balances and status.
    """
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PARTIAL = 'partial', 'Partial'
        PAID = 'paid', 'Paid'
        OVERDUE = 'overdue', 'Overdue'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        Student,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='fees'
    )
    student_name = models.CharField(max_length=255)  # Denormalized for static record audits
    batch = models.ForeignKey(
        Batch,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='fees'
    )
    course_name = models.CharField(max_length=255, blank=True, null=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    outstanding_amount = models.DecimalField(max_digits=10, decimal_places=2)
    due_date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )
    paid_date = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Fee Record"
        verbose_name_plural = "Fee Records"
        db_table = "fees"

    def __str__(self):
        return f"Fee for {self.student_name} - {self.status}"


# ==========================================
# FEE PAYMENTS
# ==========================================
class FeePayment(models.Model):
    """
    Receipt ledger tracking individual financial transactions towards fee records.
    """
    class PaymentMode(models.TextChoices):
        CASH = 'cash', 'Cash'
        CARD = 'card', 'Card'
        TRANSFER = 'transfer', 'Bank Transfer'
        CHEQUE = 'cheque', 'Cheque'
        UPI = 'upi', 'UPI'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fee = models.ForeignKey(
        Fee,
        on_delete=models.CASCADE,
        related_name='payments'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateField(auto_now_add=True)
    payment_mode = models.CharField(
        max_length=20,
        choices=PaymentMode.choices,
        default=PaymentMode.CASH
    )
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Fee Payment"
        verbose_name_plural = "Fee Payments"
        db_table = "fee_payments"

    def __str__(self):
        return f"Payment of {self.amount} for Fee of {self.fee.student_name}"
