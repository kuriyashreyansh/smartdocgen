from app.services.renderer import render_docx
from app.services.pdf_converter import docx_to_pdf

context = {
    "ref_no": "ACM/2027/PL/001", "letter_date": "07 October 2026",
    "recipient_designation": "The Dean (Student Welfare)",
    "club_full_name": "ACM Student Chapter, SVNIT Surat",
    "signatory_name": "Your Name", "signatory_designation": "Secretary",
    "event_name": "TechFest 2027", "event_date": "12 February 2027",
    "venue": "Seminar Hall", "faculty_coordinator": "Prof. Mehta",
    "expected_participants": "200",
}

docx_path = render_docx("permission_letter.docx", context, "test_permission.docx")
print("DOCX:", docx_path)
print("PDF:", docx_to_pdf(docx_path))