"""PDF report generation for a diagnosis."""

from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image as RLImage
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models import Diagnosis, Disease
from app.services.storage import storage_service

DISCLAIMER = (
    "This report is a visual symptom classification produced by an AI model. "
    "It is not a laboratory confirmation and does not identify a pathogen species. "
    "Consult a qualified agronomist or plant pathologist before taking action."
)
GREEN = colors.HexColor("#1f7a4d")


def _p(text: object, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(str(text)) if text is not None else "-", style)


def _storage_image(key: str | None, max_w: float, max_h: float) -> RLImage | None:
    if not key:
        return None
    try:
        data = storage_service.get_bytes(key)
        img = RLImage(BytesIO(data))
        scale = min(max_w / img.imageWidth, max_h / img.imageHeight, 1.0)
        img.drawWidth = img.imageWidth * scale
        img.drawHeight = img.imageHeight * scale
        return img
    except Exception:
        return None


def build_diagnosis_pdf(diagnosis: Diagnosis, crop_name: str | None, disease: Disease | None) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"PlantGuard AI report {diagnosis.id}",
        author="PlantGuard AI",
    )
    ss = getSampleStyleSheet()
    title = ParagraphStyle("t", parent=ss["Title"], textColor=GREEN, alignment=0)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], textColor=GREEN, spaceBefore=10)
    body = ss["BodyText"]
    small = ParagraphStyle("s", parent=body, fontSize=8, textColor=colors.grey)

    preds = sorted(diagnosis.predictions, key=lambda x: x.rank)
    top = preds[0] if preds else None
    conf = diagnosis.overall_confidence
    if conf is None and top:
        conf = top.probability
    conf_txt = "-" if conf is None else f"{(conf * 100 if conf <= 1 else conf):.1f}%"

    story: list = [
        Paragraph("PlantGuard AI", title),
        Paragraph("Plant health diagnosis report", ss["Heading3"]),
        Spacer(1, 4),
    ]

    summary = [
        ["Diagnosis ID", diagnosis.id],
        ["Date", diagnosis.created_at.strftime("%Y-%m-%d %H:%M UTC")],
        ["Status", diagnosis.status],
        ["Crop", crop_name or "Not specified"],
        ["Predicted category", top.label if top else "-"],
        ["Confidence", conf_txt],
    ]
    t = Table([[_p(a, body), _p(b, body)] for a, b in summary], colWidths=[45 * mm, 125 * mm])
    t.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#eef5f0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(t)

    if preds:
        story.append(Paragraph("Top predictions", h2))
        rows = [[_p("Rank", body), _p("Label", body), _p("Probability", body)]]
        for p in preds[:5]:
            pr = p.probability * 100 if p.probability <= 1 else p.probability
            rows.append([_p(p.rank, body), _p(p.label, body), _p(f"{pr:.1f}%", body)])
        pt = Table(rows, colWidths=[20 * mm, 110 * mm, 40 * mm])
        pt.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef5f0")),
                ]
            )
        )
        story.append(pt)

    story.append(Paragraph("Image quality check", h2))
    story.append(_p(f"Result: {diagnosis.quality_status or 'not available'}", body))
    for msg in diagnosis.quality_messages or []:
        story.append(_p(f"- {msg}", body))

    imgs = [
        _storage_image(diagnosis.image.object_storage_key if diagnosis.image else None, 82 * mm, 80 * mm),
        _storage_image(
            diagnosis.explanation.heatmap_storage_key if diagnosis.explanation else None,
            82 * mm,
            80 * mm,
        ),
    ]
    if any(imgs):
        story.append(Paragraph("Images", h2))
        cells = [[i or _p("Not available", small) for i in imgs]]
        cells.append([_p("Uploaded image", small), _p("Grad-CAM attention overlay", small)])
        it = Table(cells, colWidths=[85 * mm, 85 * mm])
        it.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story.append(it)

    if disease:
        story.append(Paragraph(f"Disease information: {escape(disease.name)}", h2))
        for label, val in [
            ("Description", disease.description),
            ("Pathogen type", disease.pathogen_type),
            ("Symptoms", disease.symptoms),
            ("Cause", disease.cause),
            ("Prevention", disease.prevention),
            ("Management", disease.management_notes),
        ]:
            if val:
                story.append(Paragraph(f"<b>{label}:</b> {escape(val)}", body))

    if diagnosis.recommendations:
        story.append(Paragraph("Recommendations", h2))
        for r in diagnosis.recommendations:
            story.append(
                Paragraph(f"<b>{escape(r.title)}</b> ({escape(r.priority)}, {escape(r.category)})", body)
            )
            story.append(_p(r.description, body))
            story.append(Spacer(1, 3))

    story.append(Spacer(1, 10))
    story.append(Paragraph("Disclaimer", h2))
    story.append(_p(DISCLAIMER, body))

    doc.build(story)
    return buf.getvalue()
