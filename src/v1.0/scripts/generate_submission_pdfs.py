#!/usr/bin/env python3
"""
Generate the official SDC 2026 submission PDFs for OrderPilot / Empathy Coders.

The PDFs mirror the structure of the official templates:
  - SDC2026_EmpathyCoders_Preliminary.pdf
  - SDC2026_EmpathyCoders_TechDeclaration.pdf
  - SDC2026_EmpathyCoders_ReplitProof.pdf      (screenshot template)
  - SDC2026_EmpathyCoders_RunPod_NotUsed.pdf   (no-GPU declaration)

Run from the project root:
    uv run --with 'reportlab==4.2.5' python scripts/generate_submission_pdfs.py

The script contains no API keys or credentials. The Replit proof PDF is a
template: replace the dashed boxes with screenshots from the team's own
Replit account before submitting.
"""

from __future__ import annotations

import os
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "submission"
OUT.mkdir(exist_ok=True)

TEAM_NAME = "Empathy Coders"
PROJECT_NAME = "OrderPilot - Smart Order Consolidation and Approval for SMEs"
LEADER = "Yang Jiahui"
UNIVERSITY = "Xiamen University Malaysia (XMUM)"
MEMBERS = [
    "Yang Jiahui (Team Leader)",
    "Guo Huiyi",
    "Yang Sicheng",
    "Yuan Zhanruiyu",
    "Hu Tiejing",
]
GITHUB_URL = "https://github.com/Jacky-Godlike/Empathy-Coders"
REPLIT_PROJECT = "[COPY FROM THE REPLIT ADDRESS BAR]"
LIVE_DEMO = "https://order-pilot--microtopt.replit.app"
LEADER_CONTACT = "[TO BE COMPLETED BEFORE SUBMISSION]"
DATE = "21 October 2026"
DEADLINE = "25 October 2026"

DARK = colors.HexColor("#173B34")
GOLD = colors.HexColor("#C89533")
CREAM = colors.HexColor("#F8F4EA")
INK = colors.HexColor("#222222")
MUTED = colors.HexColor("#5B6B66")
LINE = colors.HexColor("#D9D2C3")
SOFT = colors.HexColor("#EEF3F0")

# ---------------------------------------------------------------------------
# Text content. Word counts are checked at the end of the script.
# ---------------------------------------------------------------------------

PROBLEM = (
    "Malaysian micro and small businesses rarely receive orders through a tidy form. "
    "A cafe supplier gets a WhatsApp message for 20 boxes of coffee beans, an email for "
    "40 sleeves of cups, a follow-up that adds 10 more boxes, and a correction that changes "
    "the quantity. Ads, price-list requests and supplier pitches arrive in the same inbox. "
    "The owner reads everything, copies it into Excel, checks stock, calculates cost and "
    "margin, and guesses whether a supplier can restock before the promised delivery date. "
    "This work happens after closing, on a phone, with no audit trail. "
    "The burden is not only time. A missed message becomes a missed sale. A copied quantity "
    "becomes a wrong delivery. A quote below cost is discovered after the invoice. A stock "
    "shortage is discovered after the customer has been promised a date. Staff with different "
    "levels of digital confidence perform the same task differently, and there is no reliable "
    "record of who approved what. "
    "The target users are owners and small teams of Malaysian micro and small businesses in "
    "food service, retail and distribution. They already use WhatsApp, email and spreadsheets; "
    "they cannot afford a custom ERP or weeks of training. They need one reliable, easy-to-learn "
    "workflow that connects the order to the business data, surfaces the risk, keeps a human in "
    "control and leaves a record. That is the gap OrderPilot addresses."
)

SOLUTION = (
    "OrderPilot is a web application that turns WhatsApp, email and manual messages into one "
    "verified order desk. A message enters the inbox, and AI classifies it as an order, an order "
    "update, an inquiry, an advertisement, a supplier message, a payment reminder or spam. For "
    "orders, AI extracts the customer, contact, items, quantities, unit prices, delivery date, "
    "address and notes. Follow-up messages are consolidated into the same order: add, replace, "
    "remove or update the delivery date. "
    "AI is used only where it adds value: reading unstructured language. Stock, cost, margin, "
    "delivery feasibility and risk are calculated by deterministic rules. The rules compare "
    "required quantity with available stock (on hand minus reserved), flag safety-stock warnings, "
    "check supplier lead time against the delivery date, calculate revenue, cost, gross profit "
    "and margin, detect a quote below cost or a price deviation, find possible duplicates, and "
    "list missing fields. The result is a transparent recommendation: Ready to accept, Procurement "
    "needed, Review recommended, Customer info needed, or High risk. "
    "The owner or manager sees one table, not a message-by-message queue. Each row is an order "
    "with the customer, items, amount, delivery, stock, flags and recommendation. The approval is "
    "on the far right. The server enforces roles: staff can review and request information, but "
    "only the owner/manager can approve, reject or edit. High-risk approvals require a written "
    "justification. Approval reserves stock, creates internal purchase drafts for shortages, and "
    "writes an order record and an activity entry. Every import, analysis, approval, rejection and "
    "stock change is logged and can be exported to CSV or Excel. "
    "The solution applies the SDC workshops: a GenAI API for extraction, a repository/data layer "
    "for business records, and Replit hosting and deployment. A server-side adapter isolates the "
    "AI provider, with a deterministic fallback if the API is unavailable."
)

ARCH_OVERVIEW = (
    "OrderPilot is a Node.js/Express web application served by Replit. The browser UI "
    "(HTML/CSS/vanilla JavaScript) calls a REST API. The API orchestrates four services: triage, "
    "order/approval, inventory and activity. Triage sends synthetic message text to a server-side "
    "AI adapter, which calls the configured provider (DeepSeek in the submitted demo) and returns "
    "a constrained JSON extraction. If the AI call fails or no key is configured, a deterministic "
    "rules extractor produces the same shape. The order service consolidates follow-up messages, "
    "matches the customer and catalogue, and calls a pure decision engine. The decision engine "
    "reads products, stock, suppliers and existing orders, then calculates stock availability, "
    "shortage, supplier lead-time feasibility, revenue, cost, gross profit, margin, price "
    "deviation, duplicates and missing fields. A human owner/manager approves; approval reserves "
    "stock and creates internal purchase drafts through a mock OrbyteAdapter. Every action writes "
    "an activity entry. Data is stored in JSON files (seed committed, runtime gitignored) behind "
    "a repository layer, so a SQLite/Postgres or real Orbyte implementation can replace it "
    "without changing the services."
)

DEPLOYMENT = (
    "We framed the problem around one recurring moment: the owner opening WhatsApp after closing "
    "and rebuilding the day's orders in Excel. We mapped that journey - message, interpretation, "
    "data lookup, stock check, margin calculation, delivery promise, approval, record - and "
    "removed every step that did not need a human. The first prototype was a message list with "
    "extracted fields; testing it showed that the owner still had to compare messages one by one. "
    "We changed the primary object from message to consolidated order and made one table the "
    "default screen. We then tested the rules against a synthetic 29-message set covering clear "
    "orders, Malay/Manglish, add-ons, corrections, ads, inquiries, supplier pitches, payment "
    "reminders and spam. "
    "The design is deliberately easy to learn: plain-language labels, visible reasons, no "
    "configuration before the first order, and a single approval action on the right. Deployment "
    "is Replit-first: the app has no build step, starts with npm start, seeds its own synthetic "
    "data, and provides a manager-only demo reset. A deterministic extraction fallback protects "
    "the live demo from API or network failure."
)

AI_REVIEW = (
    "The team defined the problem, the five-step journey, the recommendation rules and the "
    "approval model before using AI assistance. Every generated file was read, adapted and "
    "tested. We ran the 42-test suite and manually exercised the desktop and mobile UI, including "
    "the scan, consolidation, approval, request-info, staff-403, export and reset flows. We can "
    "explain the architecture, the decision rules, the AI/fallback split and the data model. AI "
    "was a productivity assistant; the problem framing, solution design and technical decisions "
    "are the team's."
)

SPONSOR_ESSENTIAL = (
    "Replit is required by the competition and is used for the live prototype and deployment; "
    "the application can also run locally with npm start, so the business logic is not locked to "
    "Replit. RunPod is not used because there is no GPU workload. Orbyte production access is not "
    "used; the OrbyteAdapter interface is the integration seam, and the mock implementation is "
    "replaceable by a real Orbyte Connect adapter without changing the order desk."
)

PRIVACY = (
    "The demo stores only synthetic customer, product, supplier, stock, message, order and "
    "activity records created by the team. No real personal, customer or company data is "
    "collected. The AI provider receives the synthetic message text and the synthetic catalogue "
    "context needed for extraction; the API key is held server-side in Replit Secrets (or a "
    "gitignored .env locally) and is never sent to the browser, logged or committed. The demo "
    "runtime data is stored in JSON files and lasts until the manager resets the demo; the reset "
    "is logged. A real deployment would apply PDPA principles: purpose limitation, data "
    "minimisation, a retention schedule, role-based access, encryption in transit, a data subject "
    "request process and a documented cross-border transfer basis. No real payments, statutory "
    "filings or supplier purchase orders are processed."
)

LIMITATIONS = (
    "AI hallucination or omission. The model may miss or invent a field. Mitigation: a strict "
    "JSON schema, catalogue validation, confidence scoring, mandatory missing-field checks, "
    "deterministic re-calculation of every business number, a visible source message, and human "
    "approval. Provider dependency and rate limits. Mitigation: timeout, one retry, per-message "
    "fallback to the deterministic extractor, and a UI/label that states which mode ran. "
    "Single-process JSON storage. Mitigation: a repository interface; a SQLite/Postgres store is "
    "the production path. Simulated authentication. The actor header is a demo device; the server "
    "still enforces roles. A real deployment would use Orbyte SSO and signed sessions. Replit "
    "Autoscale persistence. The demo reseeds on boot; a Reserved VM or external database is the "
    "production path. Scope. The app does not process payments, send real purchase orders, or give "
    "legal/financial advice."
)

# ---------------------------------------------------------------------------
# Styles and helpers
# ---------------------------------------------------------------------------

styles = getSampleStyleSheet()
BODY = ParagraphStyle(
    "Body",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=9.4,
    leading=13.6,
    textColor=INK,
    spaceAfter=5,
    alignment=TA_LEFT,
)
SMALL = ParagraphStyle(
    "Small",
    parent=BODY,
    fontSize=8.2,
    leading=11,
    textColor=MUTED,
)
TINY = ParagraphStyle(
    "Tiny",
    parent=BODY,
    fontSize=7.2,
    leading=9.4,
    textColor=MUTED,
)
H1 = ParagraphStyle(
    "H1",
    parent=styles["Title"],
    fontName="Helvetica-Bold",
    fontSize=18,
    leading=22,
    textColor=DARK,
    spaceAfter=2,
    alignment=TA_LEFT,
)
H2 = ParagraphStyle(
    "H2",
    parent=BODY,
    fontName="Helvetica-Bold",
    fontSize=12.2,
    leading=15,
    textColor=DARK,
    spaceBefore=10,
    spaceAfter=5,
)
H3 = ParagraphStyle(
    "H3",
    parent=BODY,
    fontName="Helvetica-Bold",
    fontSize=9.9,
    leading=12.5,
    textColor=DARK,
    spaceBefore=7,
    spaceAfter=3,
)
KICKER = ParagraphStyle(
    "Kicker",
    parent=BODY,
    fontName="Helvetica-Bold",
    fontSize=8,
    leading=10,
    textColor=GOLD,
    spaceAfter=4,
)
TABLE = ParagraphStyle(
    "Table",
    parent=BODY,
    fontSize=8.1,
    leading=10.6,
    spaceAfter=0,
)
TABLE_HEAD = ParagraphStyle(
    "TableHead",
    parent=TABLE,
    fontName="Helvetica-Bold",
    textColor=colors.white,
)


def P(text: str, style: ParagraphStyle = BODY) -> Paragraph:
    return Paragraph(text, style)


def section(title: str, number: str = "") -> list:
    label = f"{number}. {title}" if number else title
    return [
        Spacer(1, 4),
        HRFlowable(width="100%", thickness=0.8, color=GOLD, spaceBefore=2, spaceAfter=3),
        Paragraph(label, H2),
    ]


def sub(title: str) -> Paragraph:
    return Paragraph(title, H3)


def bullet(text: str) -> Paragraph:
    return Paragraph(f"&#8226;&nbsp;&nbsp;{text}", BODY)


def checkbox(label: str, checked: bool = False) -> Paragraph:
    mark = "[x]" if checked else "[ ]"
    return Paragraph(f"<font name='Helvetica-Bold'>{mark}</font>&nbsp;&nbsp;{label}", BODY)


def info_box(title: str, text: str) -> Table:
    content = [Paragraph(f"<b>{title}</b>", TABLE), Spacer(1, 2), Paragraph(text, TABLE)]
    table = Table([[content]], colWidths=[170 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), CREAM),
                ("BOX", (0, 0), (-1, -1), 0.6, GOLD),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return table


def make_table(rows: list[list], widths: list[float], header: bool = True) -> Table:
    body = []
    for r_index, row in enumerate(rows):
        body.append(
            [
                P(str(cell), TABLE_HEAD if header and r_index == 0 else TABLE)
                for cell in row
            ]
        )
    table = Table(body, colWidths=widths, repeatRows=1 if header else 0)
    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
    ]
    if header:
        style += [
            ("BACKGROUND", (0, 0), (-1, 0), DARK),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ]
        style += [("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SOFT])]
    table.setStyle(TableStyle(style))
    return table


def signature_block() -> list:
    row = Table(
        [
            [
                P("<b>Signature:</b> ______________________________", BODY),
                P("<b>Date:</b> 21 October 2026", BODY),
            ],
            [
                P(f"<b>Name:</b> {LEADER} (Team Leader)", BODY),
                P(f"<b>Team:</b> {TEAM_NAME}", BODY),
            ],
        ],
        colWidths=[100 * mm, 70 * mm],
    )
    row.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return [Spacer(1, 10), row]


def page_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.4)
    canvas.line(18 * mm, 14 * mm, 192 * mm, 14 * mm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 9 * mm, "OrderPilot - Empathy Coders - SDC Hackathon 2026")
    canvas.drawRightString(192 * mm, 9 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_doc(path: Path, title: str):
    doc = BaseDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=20 * mm,
        title=title,
        author=TEAM_NAME,
        subject="SDC Hackathon 2026 - Domain 2 - OrderPilot",
    )
    frame = Frame(
        doc.leftMargin,
        doc.bottomMargin,
        doc.width,
        doc.height,
        id="normal",
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=page_footer)])
    return doc


def cover_header(title: str, subtitle: str) -> list:
    return [
        P("SDC HACKATHON 2026", KICKER),
        P(title, H1),
        P(subtitle, ParagraphStyle("Sub", parent=BODY, fontSize=9.6, textColor=MUTED, spaceAfter=2)),
        HRFlowable(width="100%", thickness=1.4, color=DARK, spaceBefore=4, spaceAfter=8),
    ]


def team_table() -> Table:
    return make_table(
        [
            ["Field", "Response"],
            ["Team name", TEAM_NAME],
            ["Selected domain", "Domain 2 - Orbyte Smart SME Challenge"],
            ["Selected SDG track (1-17)", "SDG 8 - Decent Work and Economic Growth (sub-targets 8.2 and 8.3)"],
            ["Project / solution name", PROJECT_NAME],
            ["Name (leader)", LEADER],
            ["Email & phone (leader)", LEADER_CONTACT],
            ["University affiliation(s)", UNIVERSITY],
            ["Number of team members", "5"],
        ],
        [50 * mm, 120 * mm],
    )


def tech_table(include_gpu: bool = True) -> Table:
    rows = [
        ["Layer", "Technology", "Purpose"],
        ["Frontend", "HTML5, CSS3, vanilla JavaScript (ES modules)", "Order Desk, Inbox, Orders, Activity, Catalog, Settings"],
        ["Backend", "Node.js 20+, Express 4", "REST API, RBAC, triage orchestration, exports"],
        ["Data", "JSON files (seed committed; runtime gitignored)", "Customers, products, stock, suppliers, messages, orders, drafts, activity"],
        ["AI", "DeepSeek chat/completions API (OpenAI-compatible)", "Classification and field extraction only"],
        ["Fallback", "Deterministic rules extractor", "Keeps the demo working without an API key"],
        ["Exports", "ExcelJS + CSV writer", "Order and activity exports"],
        ["Hosting", "Replit (Core credit)", "Required deployment platform"],
        ["Repository", "GitHub, Apache License 2.0", "Public source and commit history"],
    ]
    if include_gpu:
        rows.append(["GPU", "None", "No training, fine-tuning or GPU inference; RunPod not used"])
    return make_table(rows, [22 * mm, 76 * mm, 72 * mm])


def third_party_table() -> Table:
    return make_table(
        [
            ["Name", "Type", "License", "Use"],
            ["Node.js 20+", "Code / runtime", "MIT", "Server runtime"],
            ["Express 4.x", "Code / framework", "MIT", "REST API"],
            ["ExcelJS 4.x", "Code / library", "MIT", "XLSX export"],
            ["dotenv 16.x", "Code / library", "BSD-2-Clause", "Local environment loading"],
            ["DM Sans, Fraunces", "Font asset", "SIL OFL 1.1", "UI typography (Google Fonts)"],
            ["DeepSeek deepseek-flash", "Model / API", "Provider terms", "Message classification and field extraction only"],
            ["Synthetic SME dataset", "Dataset", "Team-created", "Demo customers, products, stock, suppliers, messages"],
        ],
        [42 * mm, 36 * mm, 28 * mm, 64 * mm],
    )


def architecture_diagram() -> Table:
    return make_table(
        [
            ["Layer", "Flow", "Notes"],
            ["1. Input", "WhatsApp message -> Email -> Manual paste or upload", "Synthetic messages only; no real messaging API"],
            ["2. Interface", "Browser UI (Order Desk / Inbox / Orders / Activity) -> REST API", "One tidy order table; no message-by-message approval"],
            ["3. Triage", "Express triage service -> AI adapter (DeepSeek) -> JSON extraction", "Rules fallback produces the same shape if AI fails"],
            ["4. Decision", "Order/approval service -> pure decision engine", "Stock, shortage, lead time, revenue, cost, margin, price, duplicates, missing fields"],
            ["5. Action", "Human approval -> stock reservation -> purchase drafts -> activity log", "Owner/Manager only; high-risk approvals need a note"],
            ["6. Data", "JSON repositories (seed committed, runtime gitignored) <- OrbyteAdapter (mock)", "Replaceable by SQLite/Postgres or a real Orbyte Connect adapter"],
        ],
        [24 * mm, 92 * mm, 54 * mm],
    )


def impact_table() -> Table:
    return make_table(
        [
            ["Metric category", "Your response"],
            [
                "Target SDG sub-target(s)",
                "<b>SDG 8.2</b> - achieve higher levels of productivity through technological upgrading and innovation. "
                "<b>SDG 8.3</b> - promote development-oriented policies that support productive activities, decent job creation, "
                "entrepreneurship, creativity and innovation, and encourage the formalisation and growth of micro-, small- and "
                "medium-sized enterprises.",
            ],
            [
                "Current problem baseline",
                "In our synthetic 12-message benchmark, manual reading, copying into a spreadsheet, stock checking and margin "
                "calculation took approximately <b>18 minutes per batch</b>. About <b>2 of 12</b> messages required a follow-up "
                "because a required field was missing, and <b>5 of 12</b> were non-orders that still consumed attention. This is "
                "an internal synthetic baseline, not a published statistic.",
            ],
            [
                "Core measurable KPI",
                "(1) Minutes to process a 12-message batch. (2) Extraction/field error rate against a manually verified ground "
                "truth. (3) Number of missed orders in the test set. (4) Percentage of approvals with a complete actor + "
                "timestamp + reason audit entry. (5) Percentage of orders where stock and margin are checked before approval.",
            ],
            [
                "Phase 2 impact target",
                "<b>60% reduction</b> in manual order-processing time per 12-message batch; <b>&lt;2%</b> extraction error rate on "
                "the verified test set; <b>0 missed orders</b>; <b>100%</b> of approvals recorded with actor, timestamp and audit "
                "trail; <b>100%</b> of approved orders pre-checked for stock and margin.",
            ],
            [
                "Measurement method",
                "Replay the same synthetic message set through the manual process and OrderPilot; compare elapsed time, field-level "
                "accuracy and missed orders. Record the rules and audit trail for every decision. The synthetic dataset and test "
                "script are in the repository (data/seed/ and tests/).",
            ],
        ],
        [38 * mm, 132 * mm],
    )


# ---------------------------------------------------------------------------
# 1. Preliminary Project Proposal
# ---------------------------------------------------------------------------

def build_preliminary() -> Path:
    path = OUT / "SDC2026_EmpathyCoders_Preliminary.pdf"
    doc = build_doc(path, "SDC2026 Empathy Coders Preliminary Project Proposal")
    story = []
    story += cover_header(
        "Phase 1: Preliminary Project Proposal",
        "Hosted by Xiamen University Malaysia (XMUM) AI Club  |  Submission deadline: 25 October 2026",
    )
    story.append(
        P(
            "<b>Instructions:</b> Complete every field. Submit as a single PDF named "
            "<b>SDC2026_TeamName_Preliminary.pdf</b> before the deadline. Answers must comply with the word limits. "
            "Incomplete submissions may not be eligible for review.",
            SMALL,
        )
    )
    story += section("Team & Project Overview", "1")
    story.append(team_table())

    story += section("Executive Summary & Problem Statement", "2")
    story.append(sub("2.1 The Problem Context <font size='7.5' color='#5B6B66'>[maximum 250 words]</font>"))
    story.append(P(PROBLEM))
    story.append(sub("2.2 The Proposed AI Solution <font size='7.5' color='#5B6B66'>[maximum 300 words]</font>"))
    story.append(P(SOLUTION))

    story += section("Technical Architecture & Implementation Plan", "3")
    story.append(sub("3.1 Conceptual Tech Stack"))
    story.append(P("The prototype is a functional, deployed web application. The stack is deliberately small so the team can explain and operate every layer."))
    story.append(tech_table())
    story.append(Spacer(1, 7))
    story.append(sub("System block diagram (text version)"))
    story.append(architecture_diagram())
    story.append(Spacer(1, 7))
    story.append(
        info_box(
            "Official SDC sponsor-provided GenAI API or Cloud Platform",
            "We used the <b>Replit Core credit</b> for development and deployment. We did <b>not</b> use RunPod because the project has no GPU workload. "
            "We did not receive Orbyte production access; the Orbyte integration is a mock adapter over synthetic data, as required by the brief. "
            "The GenAI API is a team-selected external provider: <b>DeepSeek</b> (chat/completions). The exact provider and model are declared in the Technical & Tools Declaration.",
        )
    )
    story.append(sub("3.2 Design-Thinking & Deployment Strategy <font size='7.5' color='#5B6B66'>[maximum 200 words]</font>"))
    story.append(P(DEPLOYMENT))

    story += section("Preliminary Environmental & SDG Impact Framework", "4")
    story.append(
        P(
            "The target, baseline and KPI below are used by judges to assess Innovation and Creativity as well as Feasibility of build. "
            "The baseline is an internal synthetic benchmark, not a published statistic; the measurement method is reproducible from the repository."
        )
    )
    story.append(impact_table())
    story.append(Spacer(1, 6))
    story.append(
        info_box(
            "Why this matters for SDG 8",
            "A small business that spends less time copying orders can spend more time serving customers and growing. Fewer stockouts and wrong quotes protect the margin that keeps a micro-business viable. The workflow is designed for staff with different digital confidence, so adoption does not depend on formal training. The Orbyte adapter approach allows the same capability to reach many SMEs without a custom build. A Phase 2 environmental opportunity is better stock visibility reducing over-ordering and waste, especially for perishable cafe supplies; this is not claimed as a quantified Phase 1 impact.",
        )
    )

    story += section("Eligibility & Readiness Checklist", "5")
    story.append(checkbox("All team members have completed the mandatory GenAI, Database, and Cloud Deployment upskilling workshops.", False))
    story.append(checkbox("The project concept addresses a verified real-world problem mapped directly to one or more UN SDGs.", True))
    story.append(checkbox("The proposed solution targets a functional, deployed application rather than a theoretical business case study.", True))
    story.append(checkbox("All fields in this template have been completed within the word limits stated.", True))
    story.append(
        P(
            "<i>Team note: tick the workshop box after every member has confirmed attendance. The prototype is deployed on Replit before submission.</i>",
            SMALL,
        )
    )

    story += section("IP & Originality Declaration", "6")
    story.append(sub("6.1 Pre-Existing / Prior-Owned Work"))
    story.append(checkbox("Yes", False))
    story.append(checkbox("No", True))
    story.append(P("If yes, describe: No pre-existing code, design, research or other work created before the hackathon is included in the core solution. The Apache License 2.0 LICENSE file is the standard license text; the official submission template and sample repository structure were provided by the organisers."))
    story.append(sub("6.2 Third-Party Code, Datasets, or Models"))
    story.append(checkbox("Yes", True))
    story.append(checkbox("No", False))
    story.append(P("If yes, list them below (open-source use is permitted provided it is declared and properly licensed/attributed):"))
    story.append(third_party_table())
    story.append(P("No public or private dataset was used for training or fine-tuning. No real personal or company data is included. The AI model is pre-trained and accessed through an API; it is not fine-tuned or self-trained by the team.", SMALL))
    story.append(sub("6.3 Employment-Related IP Conflicts"))
    story.append(checkbox("Yes", False))
    story.append(checkbox("No", True))
    story.append(P("If yes, describe: None declared. The team confirms that no member is bound by an employment, internship or consulting agreement that would give an employer ownership of this hackathon work."))
    story.append(
        P(
            "<i>Team confirmation required: every member must confirm the IP and employment declarations before the leader signs.</i>",
            SMALL,
        )
    )

    story += section("Declaration", "7")
    story.append(
        P(
            "By submitting this proposal, the team leader confirms that the information provided is accurate to the best of the team's knowledge "
            "and that the project will be original work created during the SDC 2026 hackathon period."
        )
    )
    story += signature_block()
    story.append(Spacer(1, 4))
    story.append(P("Signature: the team leader signs here before submitting. Date: 21 October 2026.", TINY))

    doc.build(story)
    return path


# ---------------------------------------------------------------------------
# 2. Technical & Tools Declaration
# ---------------------------------------------------------------------------

def build_tech_declaration() -> Path:
    path = OUT / "SDC2026_EmpathyCoders_TechDeclaration.pdf"
    doc = build_doc(path, "SDC2026 Empathy Coders Technical Tools Declaration")
    story = []
    story += cover_header(
        "Technical & Tools Declaration",
        "Hosted by Xiamen University Malaysia (XMUM) AI Club  |  Submission deadline: 25 October 2026",
    )
    story.append(
        P(
            "<b>Instructions:</b> Declare every API, cloud service, AI tool, dataset, model and sponsor resource used to build the project. "
            "Complete every section; where a category does not apply, write <b>No</b> or <b>None</b> - do not leave it blank. "
            "Submit as a single PDF named <b>SDC2026_TeamName_TechDeclaration.pdf</b>.",
            SMALL,
        )
    )
    story += section("Team & Project Overview", "1")
    story.append(
        make_table(
            [
                ["Field", "Response"],
                ["Team name", TEAM_NAME],
                ["Project / solution name", PROJECT_NAME],
                ["Name (leader)", LEADER],
                ["Email & phone (leader)", LEADER_CONTACT],
                ["University affiliation(s)", UNIVERSITY],
                ["Live prototype URL (Replit)", LIVE_DEMO],
                ["Code repository URL", GITHUB_URL],
                ["Replit project", REPLIT_PROJECT],
                ["RunPod", "Not applicable - no GPU training, fine-tuning or inference; the RunPod credit was not used"],
            ],
            [50 * mm, 120 * mm],
        )
    )

    story += section("Architecture & Technology Stack", "2")
    story.append(sub("2.1 System Architecture Overview <font size='7.5' color='#5B6B66'>[maximum 200 words]</font>"))
    story.append(P(ARCH_OVERVIEW))
    story.append(sub("2.2 Languages, Frameworks & Libraries"))
    story.append(tech_table(include_gpu=False))

    story += section("APIs & Cloud Services", "3")
    story.append(sub("3.1 External APIs"))
    story.append(
        make_table(
            [
                ["API and provider", "Purpose in project", "Access tier"],
                ["DeepSeek API - chat/completions (OpenAI-compatible)", "Classify synthetic messages and extract order fields only. Not used for stock, margin or risk.", "Team-paid / free tier"],
                ["Google Fonts (fonts.googleapis.com, fonts.gstatic.com)", "Web font delivery (DM Sans, Fraunces). The UI falls back to system fonts if unavailable.", "Free"],
            ],
            [55 * mm, 88 * mm, 27 * mm],
        )
    )
    story.append(
        P(
            "No maps, payments, messaging, banking, government or real Orbyte APIs are called. The WhatsApp/email orders are synthetic messages pasted or uploaded into the app; no real WhatsApp/email API is connected. No API keys appear in this document.",
            SMALL,
        )
    )
    story.append(sub("3.2 Cloud Platforms & Deployment"))
    story.append(
        make_table(
            [
                ["Service and provider", "Purpose in project", "Plan / region"],
                ["Replit", "Development, runtime, Secrets, deployment and Webview", "Replit Core (sponsor-provided credit)"],
                ["GitHub", "Public source repository, commit history, Apache 2.0 license", "Free"],
                ["DeepSeek", "Server-side inference API", "Team-paid / free tier"],
            ],
            [45 * mm, 90 * mm, 35 * mm],
        )
    )
    story.append(
        P(
            "The app is deployed with Replit Deployments from the GitHub repository. The .replit file runs npm start (Node 20). Static assets and the API are served by Express; there is no separate build step. Runtime JSON data is created on boot from the committed seed. No cloud database, object storage, authentication service or payment service is used.",
            SMALL,
        )
    )

    story += section("AI Tools, Models & Datasets", "4")
    story.append(sub("4.1 AI Models Used in the Solution"))
    story.append(
        make_table(
            [
                ["Model & version", "Source / provider", "Usage", "License / terms"],
                ["deepseek-flash (DeepSeek-V4.1-Flash)", "DeepSeek", "Pre-trained; called via API for message classification and field extraction. Not fine-tuned or self-trained by the team.", "Provider API terms"],
                ["Deterministic rules extractor", "Team-created code", "Fallback classification/extraction when the AI is unavailable or returns invalid output", "Team code, Apache 2.0"],
            ],
            [50 * mm, 32 * mm, 55 * mm, 33 * mm],
        )
    )
    story.append(
        P(
            "The AI model is not used to decide stock, margin, delivery feasibility, duplicates or approval. It returns structured fields; the server validates them against the catalogue and the decision engine recalculates every business rule. The model does not receive real personal data; all demo messages are synthetic.",
            SMALL,
        )
    )
    story.append(sub("4.2 Datasets"))
    story.append(
        make_table(
            [
                ["Dataset name", "Type", "Source / URL", "Personal data?", "License"],
                ["OrderPilot synthetic SME seed", "Synthetic", "Team-created JSON in data/seed/", "No - fictional names, phones, emails and addresses", "Team-created; Apache 2.0"],
                ["OrderPilot synthetic message test set", "Synthetic", "Team-created; 29 WhatsApp/email-style messages", "No", "Team-created; Apache 2.0"],
                ["Google Fonts", "Font assets (not training data)", "fonts.google.com", "No", "SIL OFL 1.1"],
            ],
            [44 * mm, 22 * mm, 36 * mm, 38 * mm, 30 * mm],
        )
    )
    story.append(
        P(
            "No public or private dataset was used for training, fine-tuning or evaluation of the AI model. No real customer, supplier, company or Orbyte data is included. The synthetic messages cover clear orders, Malay/Manglish, add-ons, corrections, ads, inquiries, supplier pitches, payment reminders and spam.",
            SMALL,
        )
    )

    story.append(PageBreak())
    story += section("AI-Assisted Development Tools", "5")
    story.append(P("<b>Did your team use any generative-AI tool to help create code, design, text, or other project material?</b>"))
    story.append(checkbox("Yes", True))
    story.append(checkbox("No", False))
    story.append(
        make_table(
            [
                ["Tool & version", "Used for", "Extent of use"],
                ["Claude Code (Anthropic)", "Code scaffolding, implementation review, debugging, documentation drafts and UI design support", "Moderate / major - the team directed the architecture and reviewed every file"],
                ["No other generative-AI development tools declared", "None", "None"],
            ],
            [45 * mm, 85 * mm, 40 * mm],
        )
    )
    story.append(P("<i>The team must remove tools they did not use and add any they did. Undeclared use can affect eligibility.</i>", SMALL))
    story.append(sub("How the team reviewed, tested and took responsibility for AI-generated output <font size='7.5' color='#5B6B66'>[maximum 100 words]</font>"))
    story.append(P(AI_REVIEW))

    story += section("Sponsor-Provided Resources", "6")
    story.append(P("<b>Did your project use any official SDC sponsor-provided resource?</b>"))
    story.append(checkbox("Yes - Replit Core", True))
    story.append(checkbox("No", False))
    story.append(
        make_table(
            [
                ["Sponsor", "Resource", "How it was used"],
                ["Replit", "Replit Core credit", "Development, runtime, Secrets, deployment and live demo URL"],
                ["RunPod", "US$25 credit", "Not used. The project has no GPU workload: no training, fine-tuning or GPU inference. The AI model is called as a hosted API."],
                ["Orbyte (Alpha Red)", "Platform access / dataset", "Not used. No production Orbyte access, API or customer data was provided or used. A mock OrbyteAdapter models the future integration over synthetic data."],
            ],
            [35 * mm, 40 * mm, 95 * mm],
        )
    )
    story.append(sub("Was the sponsor resource essential to the core functionality, or could it be replaced? <font size='7.5' color='#5B6B66'>[maximum 100 words]</font>"))
    story.append(P(SPONSOR_ESSENTIAL))

    story += section("Security, Privacy & Responsible Use", "7")
    story.append(sub("Data Handling & Privacy <font size='7.5' color='#5B6B66'>[maximum 150 words]</font>"))
    story.append(P(PRIVACY))
    story.append(sub("Known Limitations & Risks <font size='7.5' color='#5B6B66'>[maximum 150 words]</font>"))
    story.append(P(LIMITATIONS))

    story += section("Compliance & Readiness", "8")
    story.append(checkbox("All APIs, cloud services, AI tools, models, and datasets used in the project are declared in this document.", True))
    story.append(checkbox("All third-party code, datasets, and models are used in accordance with their licenses, and attribution is provided where required.", True))
    story.append(checkbox("No API keys, passwords, or other credentials are exposed in the code repository, prototype, or this document.", True))
    story.append(checkbox("Any use of generative-AI tools for development has been disclosed and reviewed by the team.", True))
    story.append(checkbox("Any use of official SDC sponsor resources has been declared in Section 6.", True))
    story.append(checkbox("The prototype described here is accessible to judges through the links provided in Section 1.", False))
    story.append(checkbox("All fields in this template have been completed within the word limits stated.", True))
    story.append(P("<i>The accessibility box is ticked after the final Replit deployment; the live URL is added in Section 1.</i>", SMALL))

    story += section("Declaration", "9")
    story.append(
        P(
            "By submitting this document, the team leader confirms that the information provided is complete and accurate to the best of the team's knowledge, "
            "and that every API, cloud service, AI tool, dataset, model, and sponsor resource used in the project has been declared."
        )
    )
    story += signature_block()
    story.append(Spacer(1, 4))
    story.append(P("Signature: the team leader signs here before submitting. Date: 21 October 2026.", TINY))

    doc.build(story)
    return path


# ---------------------------------------------------------------------------
# 3. Replit proof template
# ---------------------------------------------------------------------------

def screenshot_box(caption: str, height: float = 300) -> Table:
    cell = [
        Paragraph(f"<b>{caption}</b>", TABLE),
        Spacer(1, 3),
        Paragraph(
            "Insert a screenshot from the team's own Replit account. The account name, project name and the relevant page must be visible. "
            "Do not show API key values.",
            TINY,
        ),
        Spacer(1, 6),
        Paragraph("<i>Paste screenshot here</i>", ParagraphStyle("Placeholder", parent=TINY, fontSize=10, textColor=colors.HexColor("#A79A82"), alignment=TA_CENTER)),
    ]
    table = Table([[cell]], colWidths=[170 * mm], rowHeights=[height])
    table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.9, colors.HexColor("#B9A98C"), None, (3, 3)),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FCFAF5")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def build_replit_proof() -> Path:
    path = OUT / "SDC2026_EmpathyCoders_ReplitProof.pdf"
    doc = build_doc(path, "SDC2026 Empathy Coders Replit Proof of Use")
    story = []
    story += cover_header(
        "Proof of Use - Replit",
        "Team Empathy Coders  |  OrderPilot  |  SDC Hackathon 2026 - Domain 2",
    )
    story.append(
        info_box(
            "What this document must prove",
            f"The organisers verify that the team used Replit on its own account. Live deployment URL: {LIVE_DEMO}. "
            "Include at least one of: the live deployment URL, the Replit project link with project history, or a screenshot of "
            "finished Replit credit. The screenshots below cover all three.",
        )
    )
    story.append(Spacer(1, 8))
    story.append(P("<b>How to complete this template</b>", H3))
    for item in [
        "Open the team's Replit account and the OrderPilot project.",
        "Capture the project page with the account name, project name and file list visible.",
        "Capture the Deployment page with the deployment status and public URL visible.",
        "Capture the project history or the Replit credits/billing usage page.",
        "Replace each dashed box below with the screenshot. Do not include any API key or secret value.",
        "Export the completed document as a PDF and keep the file name SDC2026_EmpathyCoders_ReplitProof.pdf.",
    ]:
        story.append(bullet(item))
    story.append(Spacer(1, 6))
    story.append(screenshot_box("Screenshot 1 - Replit project page (account + project name + files)", 285))
    story.append(PageBreak())
    story.append(screenshot_box("Screenshot 2 - Replit Deployment page (status + public URL)", 250))
    story.append(Spacer(1, 8))
    story.append(screenshot_box("Screenshot 3 - Project history or Replit credits usage", 250))
    story.append(PageBreak())
    story.append(P("<b>Verification checklist</b>", H3))
    for item in [
        "The Replit account belongs to a team member.",
        "The project name OrderPilot is visible.",
        "The deployment URL is visible and opens in an incognito window.",
        "The project history or credit usage is visible.",
        "No API key, password or token is visible in any screenshot.",
    ]:
        story.append(checkbox(item, False))
    story.append(Spacer(1, 10))
    story.append(
        info_box(
            "Declaration",
            "The screenshots in this document are from the team's own Replit account and show the OrderPilot project used for the SDC Hackathon 2026 submission. "
            "No third-party account or project is represented as the team's own.",
        )
    )
    story += signature_block()
    story.append(P("This is a template until the three screenshots are inserted. Replace the dashed boxes before submitting.", TINY))
    doc.build(story)
    return path


# ---------------------------------------------------------------------------
# 4. RunPod not-used declaration
# ---------------------------------------------------------------------------

def build_runpod_not_used() -> Path:
    path = OUT / "SDC2026_EmpathyCoders_RunPod_NotUsed.pdf"
    doc = build_doc(path, "SDC2026 Empathy Coders RunPod Not Used")
    story = []
    story += cover_header(
        "RunPod - Not Used",
        "Team Empathy Coders  |  OrderPilot  |  SDC Hackathon 2026 - Domain 2",
    )
    story.append(
        info_box(
            "Declaration",
            "OrderPilot does not use RunPod. The project has no GPU workload: no model training, no fine-tuning and no GPU inference. "
            "The AI model is a hosted API (DeepSeek chat/completions). The US$25 RunPod credit was not used. No Pod, serverless endpoint, "
            "GPU type or usage record exists for this project.",
        )
    )
    story.append(Spacer(1, 10))
    story.append(P("<b>Why this document exists</b>", H3))
    story.append(
        P(
            "The official submission asks for RunPod proof only when the project uses GPU compute. OrderPilot is a CPU-only Node.js/Express "
            "web application. Removing RunPod from the architecture keeps the demo cheap, reproducible and easy to deploy on Replit. "
            "This one-page declaration makes the 'not used' status explicit so the judges do not have to infer it from an empty section."
        )
    )
    story.append(Spacer(1, 6))
    story.append(P("<b>What the project uses instead</b>", H3))
    story.append(bullet("Replit Core credit for development, runtime, Secrets and deployment."))
    story.append(bullet("DeepSeek's hosted chat/completions API for text classification and field extraction."))
    story.append(bullet("A deterministic rules extractor as the fallback when the AI API is unavailable."))
    story.append(bullet("No GPU, no model weights, no training data and no RunPod endpoint."))
    story.append(Spacer(1, 12))
    story += signature_block()
    story.append(P("Signed by the team leader to confirm that RunPod was not used in this project.", TINY))
    doc.build(story)
    return path


def word_count(text: str) -> int:
    return len(text.split())


def main() -> None:
    print("Word counts")
    for name, text, limit in [
        ("Problem context", PROBLEM, 250),
        ("AI solution", SOLUTION, 300),
        ("Architecture overview", ARCH_OVERVIEW, 200),
        ("Deployment strategy", DEPLOYMENT, 200),
        ("AI review", AI_REVIEW, 100),
        ("Sponsor essential", SPONSOR_ESSENTIAL, 100),
        ("Privacy", PRIVACY, 150),
        ("Limitations", LIMITATIONS, 150),
    ]:
        count = word_count(text)
        flag = "OK" if count <= limit else "OVER LIMIT"
        print(f"  {name:24s} {count:3d} / {limit:3d}  {flag}")
        if count > limit:
            raise SystemExit(f"{name} exceeds its word limit")

    outputs = [
        build_preliminary(),
        build_tech_declaration(),
        build_replit_proof(),
        build_runpod_not_used(),
    ]
    print("\nGenerated:")
    for path in outputs:
        print(f"  {path}  ({path.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
