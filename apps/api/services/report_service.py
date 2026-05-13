"""
Report service — prompt construction and PDF rendering.
Uses fpdf2 for native PDF generation. Falls back to HTML-styled content if not available.
"""

from __future__ import annotations

import re
from datetime import datetime


# ─────────────────────────────────────────────────────────────────────────────
# Report type registry
# ─────────────────────────────────────────────────────────────────────────────

REPORT_TYPES = {
    "company_analysis": {
        "label": "Company Analysis",
        "description": "Deep dive into a company's financials, business model, competitive position, and investment outlook.",
        "sections": [
            "Executive Summary",
            "Business Overview",
            "Financial Performance",
            "Competitive Landscape",
            "Growth Catalysts",
            "Risk Factors",
            "Valuation & Investment Thesis",
            "Conclusion",
        ],
    },
    "investment_summary": {
        "label": "Investment Summary",
        "description": "Concise investment case for a security with key metrics and recommendation.",
        "sections": [
            "Investment Thesis",
            "Key Financial Metrics",
            "Bull Case",
            "Bear Case",
            "Price Target & Recommendation",
        ],
    },
    "portfolio_report": {
        "label": "Portfolio Report",
        "description": "Performance analysis, allocation breakdown, and strategic recommendations for a portfolio.",
        "sections": [
            "Portfolio Overview",
            "Performance Attribution",
            "Sector Allocation",
            "Risk Profile",
            "Rebalancing Recommendations",
            "Outlook",
        ],
    },
    "risk_report": {
        "label": "Risk Report",
        "description": "Comprehensive risk assessment covering market, credit, liquidity, and operational risks.",
        "sections": [
            "Executive Summary",
            "Market Risk",
            "Credit Risk",
            "Liquidity Risk",
            "Concentration Risk",
            "Macroeconomic Risk Factors",
            "Mitigation Strategies",
        ],
    },
    "market_insights": {
        "label": "Market Insights",
        "description": "Macro-level market commentary covering trends, sector rotation, and economic indicators.",
        "sections": [
            "Market Overview",
            "Key Themes",
            "Sector Analysis",
            "Economic Indicators",
            "Fed & Monetary Policy",
            "Investment Implications",
        ],
    },
}


def generate_report_prompt(
    report_type: str,
    subject: str,
    context: str = "",
) -> tuple[str, str]:
    """Build the system and user prompts for report generation."""
    meta = REPORT_TYPES.get(report_type, REPORT_TYPES["company_analysis"])

    section_list = "\n".join(f"{i+1}. {s}" for i, s in enumerate(meta["sections"]))

    system_prompt = (
        "You are an elite institutional financial analyst at a top-tier investment bank. "
        "You produce structured, data-driven, professionally written financial reports. "
        "Write in a concise, authoritative, and precise financial prose style. "
        "CRITICAL INSTRUCTIONS FOR FORMATTING:\n"
        "1. You MUST use Markdown for structure. Use `##` for main sections and `###` for sub-sections.\n"
        "2. You MUST use Markdown tables to present financial metrics, comparisons, or historical data. Tables are essential for readability.\n"
        "3. Use **bold text** to highlight key numbers, metrics, and actionable insights.\n"
        "4. Use bullet points for lists of risks, catalysts, or key takeaways.\n"
        "5. Avoid generic filler. Be specific, analytical, and highly professional."
    )

    user_prompt = (
        f"Generate a comprehensive **{meta['label']}** report for: **{subject}**\n\n"
        f"The report must cover all of the following sections in order:\n{section_list}\n\n"
    )

    if context:
        user_prompt += f"Additional context provided by the user:\n{context}\n\n"

    user_prompt += (
        "Start directly with the report content — begin with a `# Report Title` heading. "
        "Make each section substantive (at least 2-3 paragraphs). "
        "End with a clear Conclusion or Recommendation section."
    )

    return system_prompt, user_prompt


# ─────────────────────────────────────────────────────────────────────────────
# PDF Renderer using fpdf2 (with HTML fallback)
# ─────────────────────────────────────────────────────────────────────────────

def render_pdf(
    title: str,
    report_type: str,
    subject: str,
    content: str,
    created_at: datetime | None = None,
) -> bytes:
    """Render a Markdown report string as a PDF and return raw bytes.
    Uses fpdf2 if installed; otherwise returns a print-ready HTML document."""
    try:
        return _render_with_fpdf(title, report_type, subject, content, created_at)
    except ImportError:
        # fpdf2 not installed — return a print-ready HTML document instead
        return _render_html_fallback(title, report_type, subject, content, created_at)


def _render_with_fpdf(
    title: str,
    report_type: str,
    subject: str,
    content: str,
    created_at: datetime | None = None,
) -> bytes:
    """Native PDF via fpdf2."""
    from fpdf import FPDF  # type: ignore

    report_label = REPORT_TYPES.get(report_type, {}).get("label", report_type)
    generated_date = (created_at or datetime.utcnow()).strftime("%B %d, %Y")

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()
    pdf.set_margins(20, 20, 20)

    # Cover / Header
    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(15, 15, 15)
    pdf.multi_cell(0, 12, subject, align="L")
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 14)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 8, report_label, ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(130, 130, 130)
    pdf.cell(0, 6, f"Generated by FinGPT X  ·  {generated_date}", ln=True)
    pdf.ln(4)
    pdf.set_draw_color(220, 220, 220)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(8)

    # Content
    for line in content.split("\n"):
        stripped = line.strip()
        if stripped.startswith("# ") and not stripped.startswith("## "):
            pdf.set_font("Helvetica", "B", 18)
            pdf.set_text_color(10, 10, 10)
            pdf.ln(4)
            pdf.multi_cell(0, 9, _clean(stripped[2:]), align="L")
            pdf.ln(2)
        elif stripped.startswith("## "):
            pdf.set_font("Helvetica", "B", 14)
            pdf.set_text_color(20, 20, 20)
            pdf.ln(6)
            pdf.multi_cell(0, 8, _clean(stripped[3:]), align="L")
            pdf.set_draw_color(200, 200, 200)
            pdf.line(20, pdf.get_y(), 190, pdf.get_y())
            pdf.ln(4)
        elif stripped.startswith("### "):
            pdf.set_font("Helvetica", "B", 12)
            pdf.set_text_color(40, 40, 40)
            pdf.ln(4)
            pdf.multi_cell(0, 7, _clean(stripped[4:]), align="L")
            pdf.ln(1)
        elif stripped.startswith(("- ", "* ", "+ ")):
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(40, 40, 40)
            pdf.cell(6)
            pdf.multi_cell(0, 6, f"• {_clean(stripped[2:])}", align="L")
        elif re.match(r"^\d+\.", stripped):
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(40, 40, 40)
            pdf.cell(6)
            pdf.multi_cell(0, 6, _clean(stripped), align="L")
        elif stripped in ("---", "***", "___"):
            pdf.ln(3)
            pdf.set_draw_color(210, 210, 210)
            pdf.line(20, pdf.get_y(), 190, pdf.get_y())
            pdf.ln(3)
        elif stripped == "":
            pdf.ln(3)
        else:
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(40, 40, 40)
            pdf.multi_cell(0, 6, _clean(stripped), align="L")
            pdf.ln(1)

    # Footer
    pdf.ln(8)
    pdf.set_draw_color(220, 220, 220)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(160, 160, 160)
    pdf.cell(0, 5,
        "Generated by FinGPT X v2.0 · Local AI · Not financial advice.",
        align="C")

    return bytes(pdf.output())


def _render_html_fallback(
    title: str,
    report_type: str,
    subject: str,
    content: str,
    created_at: datetime | None = None,
) -> bytes:
    """Print-ready HTML when fpdf2 is not installed. Browsers render it as PDF on print."""
    import html
    report_label = REPORT_TYPES.get(report_type, {}).get("label", report_type)
    generated_date = (created_at or datetime.utcnow()).strftime("%B %d, %Y")

    # Convert Markdown to basic HTML
    md_lines = content.split("\n")
    html_lines = []
    for line in md_lines:
        s = line.strip()
        if s.startswith("# ") and not s.startswith("## "):
            html_lines.append(f"<h1>{html.escape(s[2:])}</h1>")
        elif s.startswith("## "):
            html_lines.append(f"<h2>{html.escape(s[3:])}</h2>")
        elif s.startswith("### "):
            html_lines.append(f"<h3>{html.escape(s[4:])}</h3>")
        elif s.startswith(("- ", "* ", "+ ")):
            html_lines.append(f"<li>{html.escape(s[2:])}</li>")
        elif re.match(r"^\d+\.", s):
            html_lines.append(f"<li>{html.escape(s)}</li>")
        elif s in ("---", "***", "___"):
            html_lines.append("<hr>")
        elif s == "":
            html_lines.append("<br>")
        else:
            # Bold markdown inline
            s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
            html_lines.append(f"<p>{s}</p>")

    body = "\n".join(html_lines)
    doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{html.escape(subject)} — {report_label}</title>
<style>
  @page {{ margin: 2cm; }}
  body {{ font-family: 'Georgia', serif; max-width: 800px; margin: 0 auto; color: #111; line-height: 1.6; font-size: 11pt; }}
  .header {{ border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 24px; }}
  .header h1 {{ margin: 0; font-size: 22pt; }}
  .header .meta {{ color: #555; font-size: 10pt; margin-top: 4px; }}
  h1 {{ font-size: 18pt; margin-top: 28px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }}
  h2 {{ font-size: 14pt; margin-top: 22px; color: #111; }}
  h3 {{ font-size: 12pt; margin-top: 16px; color: #222; }}
  p {{ margin: 8px 0; text-align: justify; }}
  li {{ margin: 4px 0; }}
  hr {{ border: none; border-top: 1px solid #ddd; margin: 16px 0; }}
  .footer {{ margin-top: 40px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 8pt; color: #888; text-align: center; }}
</style>
</head>
<body>
<div class="header">
  <h1>{html.escape(subject)}</h1>
  <div class="meta">{html.escape(report_label)} · Generated by FinGPT X · {generated_date}</div>
</div>
{body}
<div class="footer">
  This report was generated by FinGPT X v2.0 using local AI inference.
  For informational purposes only. Not financial advice.
</div>
</body>
</html>"""
    return doc.encode("utf-8")


def _clean(text: str) -> str:
    """Strip Markdown bold/italic markers for plain PDF text."""
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    text = re.sub(r"__(.+?)__", r"\1", text)
    text = re.sub(r"_(.+?)_", r"\1", text)
    text = re.sub(r"`(.+?)`", r"\1", text)
    return text.strip()


