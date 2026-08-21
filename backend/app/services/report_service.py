import csv
import io
from typing import List, Dict, Any
from openpyxl import Workbook
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

class ReportService:
    @staticmethod
    def generate_csv_report(title: str, headers: List[str], rows: List[List[Any]]) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([f"Report: {title}"])
        writer.writerow([])
        writer.writerow(headers)
        for row in rows:
            writer.writerow(row)
        return output.getvalue()

    @staticmethod
    def generate_excel_report(title: str, headers: List[str], rows: List[List[Any]]) -> bytes:
        wb = Workbook()
        ws = wb.active
        ws.title = "Report"
        
        ws.append([f"SprintIQ AI Report: {title}"])
        ws.append([])
        ws.append(headers)
        
        for row in rows:
            ws.append(row)
            
        output = io.BytesIO()
        wb.save(output)
        return output.getvalue()

    @staticmethod
    def generate_pdf_report(title: str, subtitle: str, data_summary: Dict[str, Any], table_headers: List[str], table_rows: List[List[Any]]) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
        story = []
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'DocTitle',
            parent=styles['Heading1'],
            fontSize=22,
            textColor=colors.HexColor("#1e3a8a"),
            spaceAfter=10
        )
        subtitle_style = ParagraphStyle(
            'DocSubtitle',
            parent=styles['Normal'],
            fontSize=11,
            textColor=colors.HexColor("#64748b"),
            spaceAfter=20
        )

        story.append(Paragraph(f"SprintIQ AI — {title}", title_style))
        story.append(Paragraph(f"Generated on {subtitle}", subtitle_style))
        story.append(Spacer(1, 10))

        # Metrics block
        summary_text = "<b>Executive Metrics:</b><br/>" + "<br/>".join([f"• <b>{k}:</b> {v}" for k, v in data_summary.items()])
        story.append(Paragraph(summary_text, styles['Normal']))
        story.append(Spacer(1, 15))

        # Table data
        formatted_table_data = [table_headers] + table_rows
        t = Table(formatted_table_data, hAlign='LEFT')
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 10),
            ('BOTTOMPADDING', (0,0), (-1,0), 8),
            ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f8fafc')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('FONTSIZE', (0,1), (-1,-1), 9),
            ('TOPPADDING', (0,1), (-1,-1), 6),
            ('BOTTOMPADDING', (0,1), (-1,-1), 6),
        ]))
        story.append(t)

        doc.build(story)
        return buffer.getvalue()
