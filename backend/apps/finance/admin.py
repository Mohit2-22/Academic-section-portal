from django.contrib import admin
from .models import Fee, FeePayment

# ==========================================
# INLINE FOR PAYMENT RECORDS
# ==========================================
class FeePaymentInline(admin.TabularInline):
    """
    Shows individual transaction receipts directly under the primary fee record.
    """
    model = FeePayment
    extra = 1
    verbose_name = "Payment Transaction"
    verbose_name_plural = "Payment Transactions"


# ==========================================
# ADMIN CONFIGURATIONS
# ==========================================

@admin.register(Fee)
class FeeAdmin(admin.ModelAdmin):
    """
    Overview billing dashboard and outstanding balances management.
    """
    list_display = ('student_name', 'batch', 'total_amount', 'paid_amount', 'outstanding_amount', 'due_date', 'status', 'created_at')
    list_filter = ('status', 'due_date', 'created_at', 'batch')
    search_fields = ('student_name', 'course_name')
    ordering = ['-created_at']
    inlines = [FeePaymentInline]


@admin.register(FeePayment)
class FeePaymentAdmin(admin.ModelAdmin):
    """
    Direct payment audits ledger.
    """
    list_display = ('fee', 'amount', 'payment_mode', 'reference_number', 'payment_date', 'created_at')
    list_filter = ('payment_mode', 'payment_date', 'created_at')
    search_fields = ('fee__student_name', 'reference_number')
    ordering = ['-created_at']
