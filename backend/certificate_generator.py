"""
Certificate Generator — PDF certificates using ReportLab for Royal Technosoft LTD
"""
import os
import uuid
from datetime import date
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

CERTS_DIR = os.path.join(os.path.dirname(__file__), "uploads", "certificates")
os.makedirs(CERTS_DIR, exist_ok=True)

INSTITUTE_NAME = "Royal Technosoft LTD"
INSTITUTE_TAGLINE = "Empowering Future Tech Professionals"

def draw_certificate(c, width, height, student_name, course_name, batch_name, cert_number, issue_date):
    """Draw a full certificate on the canvas page."""
    # Background gradient-like fill: Off-white/slate tint
    c.setFillColor(HexColor('#F9F9FB'))
    c.rect(0, 0, width, height, fill=1, stroke=0)

    # 1. Subtle Gold Watermark Logo (10% opacity) in the center background
    c.saveState()
    c.setFillColor(HexColor('#E8B84B'))
    c.setFillAlpha(0.06)
    
    # Draw a stylized watermark logo shape (concentric diamond lines + text)
    c.translate(width / 2, height / 2)
    c.rotate(45)
    c.rect(-100, -100, 200, 200, fill=1, stroke=0)
    c.rotate(-45)
    c.setFont("Helvetica-Bold", 80)
    c.drawCentredString(0, -25, "ROYAL")
    c.restoreState()

    # 2. Decorative double borders (Dark Navy & Gold)
    # Outer Border: Dark Navy
    c.setStrokeColor(HexColor('#1A1A2E'))
    c.setLineWidth(12)
    c.rect(20, 20, width - 40, height - 40, fill=0, stroke=1)

    # Inner Border: Primary Gold
    c.setStrokeColor(HexColor('#E8B84B'))
    c.setLineWidth(3)
    c.rect(32, 32, width - 64, height - 64, fill=0, stroke=1)

    # 3. Header Section
    # Large Gold and Navy Title block
    c.setFillColor(HexColor('#1A1A2E'))
    c.rect(34, height - 130, width - 68, 96, fill=1, stroke=0)
    
    # Gold stripe below header block
    c.setFillColor(HexColor('#E8B84B'))
    c.rect(34, height - 135, width - 68, 5, fill=1, stroke=0)

    # Institute name in header block
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(width / 2, height - 88, INSTITUTE_NAME.upper())

    # Tagline
    c.setFillColor(HexColor('#E8B84B'))
    c.setFont("Helvetica-Oblique", 11)
    c.drawCentredString(width / 2, height - 114, INSTITUTE_TAGLINE)

    # 4. Certificate Content
    # Title: "CERTIFICATE OF COMPLETION"
    c.setFillColor(HexColor('#1A1A2E'))
    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(width / 2, height - 180, "CERTIFICATE OF COMPLETION")

    # Separator line
    c.setStrokeColor(HexColor('#E8B84B'))
    c.setLineWidth(1.5)
    c.line(width/2 - 120, height - 195, width/2 + 120, height - 195)

    # Certification text
    c.setFillColor(HexColor('#4A5568'))
    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2, height - 230, "This is to certify that")

    # Student Name
    c.setFillColor(HexColor('#1A1A2E'))
    c.setFont("Helvetica-Bold", 32)
    c.drawCentredString(width / 2, height - 275, student_name)

    # Underline for name
    name_width = c.stringWidth(student_name, "Helvetica-Bold", 32)
    c.setStrokeColor(HexColor('#E8B84B'))
    c.setLineWidth(2)
    c.line((width - name_width) / 2, height - 282, (width + name_width) / 2, height - 282)

    # Completion text
    c.setFillColor(HexColor('#4A5568'))
    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2, height - 315, "has successfully completed the course")

    # Course Name (Large Gold/Navy Bold)
    c.setFillColor(HexColor('#E8B84B'))
    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(width / 2, height - 355, course_name)

    # Batch and date info
    c.setFillColor(HexColor('#718096'))
    c.setFont("Helvetica", 12)
    c.drawCentredString(width / 2, height - 382, f"At Royal Technosoft LTD — Batch: {batch_name}")

    # Separator line
    c.setStrokeColor(HexColor('#E8B84B'))
    c.setLineWidth(1)
    c.line(80, height - 402, width - 80, height - 402)

    # Date and certificate number row
    c.setFillColor(HexColor('#4A5568'))
    c.setFont("Helvetica", 10)
    issue_str = issue_date.strftime("%d %B %Y") if hasattr(issue_date, 'strftime') else str(issue_date)
    c.drawString(80, height - 425, f"Date of Issue: {issue_str}")
    c.drawRightString(width - 80, height - 425, f"Certificate ID: {cert_number}")

    # 5. Signatures and Seals
    sig_y = height - 490
    
    # Left Signature Line
    c.setStrokeColor(HexColor('#A0AEC0'))
    c.setLineWidth(1)
    c.line(80, sig_y, 240, sig_y)
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(HexColor('#1A1A2E'))
    c.drawCentredString(160, sig_y - 14, "Course Faculty")
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor('#718096'))
    c.drawCentredString(160, sig_y - 26, "Royal Technosoft LTD")

    # Stylized Institute Gold Seal (Middle)
    c.saveState()
    c.translate(width / 2, sig_y - 10)
    # Outer circle
    c.setStrokeColor(HexColor('#E8B84B'))
    c.setLineWidth(1.5)
    c.circle(0, 0, 28, fill=0, stroke=1)
    # Inner circle
    c.circle(0, 0, 24, fill=0, stroke=1)
    # Inner text
    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(HexColor('#E8B84B'))
    c.drawCentredString(0, 4, "ROYAL")
    c.setFont("Helvetica", 5)
    c.drawCentredString(0, -6, "SEAL OF EXCELLENCE")
    c.restoreState()

    # Right Signature Line
    c.line(width - 240, sig_y, width - 80, sig_y)
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(HexColor('#1A1A2E'))
    c.drawCentredString(width - 160, sig_y - 14, "Director / Principal")
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor('#718096'))
    c.drawCentredString(width - 160, sig_y - 26, "Royal Technosoft LTD")

    # 6. Bottom footer band
    c.setFillColor(HexColor('#1A1A2E'))
    c.rect(34, 34, width - 68, 24, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 8)
    c.drawCentredString(width / 2, 42, "This is an authentic verified credential issued by Royal Technosoft LTD. Verify at www.royaltechnosoft.com")


def generate_certificate(student_name: str, course_name: str, batch_name: str,
                          cert_number: str = None, issue_date=None) -> tuple:
    """
    Generate a PDF certificate.
    Returns (file_path: str, cert_number: str)
    """
    if not cert_number:
        cert_number = f"RYL-{date.today().year}-{uuid.uuid4().hex[:6].upper()}"
    if not issue_date:
        issue_date = date.today()

    safe_name = "".join(c for c in student_name if c.isalnum() or c in (' ', '_')).replace(' ', '_')
    file_name = f"{cert_number}_{safe_name}.pdf"
    file_path = os.path.join(CERTS_DIR, file_name)

    page_width, page_height = landscape(A4)
    c = canvas.Canvas(file_path, pagesize=landscape(A4))
    draw_certificate(c, page_width, page_height, student_name, course_name, batch_name, cert_number, issue_date)
    c.save()

    return file_path, cert_number


if __name__ == "__main__":
    path, num = generate_certificate("Aman Kumar", "Java Programming", "Batch A - Java Morning")
    print(f"Generated: {path} [{num}]")
