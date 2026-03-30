from __future__ import annotations

import subprocess
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT_DIR = ROOT / "docs" / "images" / "feature-guide" / "2026-03-28"
VIDEO_ROOT = ROOT / "docs" / "videos" / "feature-guide" / "2026-03-29"
SLIDES_ROOT = VIDEO_ROOT / "slides"

WIDTH = 1920
HEIGHT = 1080
LEFT_WIDTH = 760
RIGHT_WIDTH = WIDTH - LEFT_WIDTH


PHASES = [
    {
        "slug": "01-public-journey",
        "title": "Phase 1: Public Journey",
        "summary": "How the product introduces itself, authenticates staff, and guides a person through site entry.",
        "features": [
            {
                "title": "Homepage",
                "route": "/",
                "image": "homepage-overview.png",
                "what": "The public front door that explains the product clearly and directs people into demo or login paths.",
                "who": "Prospects, internal stakeholders, and returning customers.",
                "why": "It establishes trust before anyone sees the operating side of the system.",
            },
            {
                "title": "Login",
                "route": "/login",
                "image": "login-overview.png",
                "what": "The secured entry point for operators using password or SSO access.",
                "who": "Company admins, site managers, and compliance teams.",
                "why": "It turns the experience from public product story into real operational software.",
            },
            {
                "title": "Public Sign-In Flow",
                "route": "/s/:slug",
                "image": "public-signin-overview.png",
                "what": "A guided site-entry workflow that collects identity, induction, and acknowledgement records.",
                "who": "Contractors, visitors, workers, and delivery drivers.",
                "why": "It is the frontline moment where the product proves its value in the real world.",
            },
        ],
    },
    {
        "slug": "02-operations",
        "title": "Phase 2: Operations",
        "summary": "The live operating layer for site management, active movement, urgent coordination, and reporting.",
        "features": [
            {"title": "Dashboard", "route": "/admin", "image": "admin-dashboard-overview.png", "what": "The operator home screen with summary cards, act-now items, and operational health.", "who": "Site managers and operations leads.", "why": "It helps the team understand what needs attention first."},
            {"title": "Sites", "route": "/admin/sites", "image": "admin-sites-overview.png", "what": "The company site register with addresses, public links, status, and actions.", "who": "Company admins and operations managers.", "why": "Every other workflow depends on sites being structured correctly."},
            {"title": "Pre-Registrations", "route": "/admin/pre-registrations", "image": "admin-pre-registrations-overview.png", "what": "Invite and bulk-upload tooling that prepares people before they arrive.", "who": "Front desk and site coordination teams.", "why": "It reduces friction at the gate and makes arrivals more controlled."},
            {"title": "Deliveries", "route": "/admin/deliveries", "image": "admin-deliveries-overview.png", "what": "A live queue for inbound site deliveries and their collection state.", "who": "Gate staff and logistics coordinators.", "why": "It replaces ad hoc delivery notes with a searchable operating record."},
            {"title": "Resources", "route": "/admin/resources", "image": "admin-resources-overview.png", "what": "Shared site resource and booking management.", "who": "Facilities and site admins.", "why": "It avoids clashes and keeps shared assets scheduled visibly."},
            {"title": "Live Register", "route": "/admin/live-register", "image": "admin-live-register-overview.png", "what": "The live occupancy and attention queue for people currently on site.", "who": "Site managers and emergency coordinators.", "why": "It answers who is on site and what needs action right now."},
            {"title": "Command Mode", "route": "/admin/command-mode", "image": "admin-command-mode-overview.png", "what": "The urgent-response console for broadcasts and coordinated roll calls.", "who": "Incident commanders and site leads.", "why": "It provides a faster surface for high-pressure operational moments."},
            {"title": "Sign-In History", "route": "/admin/history", "image": "admin-history-overview.png", "what": "The historical ledger of sign-ins and sign-outs across sites.", "who": "Admins, investigators, and compliance teams.", "why": "It turns past presence into a searchable, auditable record."},
            {"title": "Audit Analytics", "route": "/admin/audit-analytics", "image": "admin-audit-analytics-overview.png", "what": "Trend and reporting views over audit and operational activity.", "who": "Compliance leads and managers.", "why": "It helps leadership see patterns instead of isolated events."},
            {"title": "Exports", "route": "/admin/exports", "image": "admin-exports-overview.png", "what": "The controlled queue for generating and downloading export files.", "who": "Compliance teams and admins preparing reports.", "why": "It provides a governed way to move structured data out of the app."},
        ],
    },
    {
        "slug": "03-safety-compliance",
        "title": "Phase 3: Safety & Compliance",
        "summary": "The risk-control layer for hazards, incidents, actions, inspections, approvals, and operational communications.",
        "features": [
            {"title": "Hazard Register", "route": "/admin/hazards", "image": "admin-hazards-overview.png", "what": "The working register for site hazards and their follow-up.", "who": "Safety managers and supervisors.", "why": "It turns safety concerns into trackable records instead of memory."},
            {"title": "Incidents", "route": "/admin/incidents", "image": "admin-incidents-overview.png", "what": "The incident record and close-out workflow.", "who": "Safety teams and site leaders.", "why": "It creates a proper record when something serious happens."},
            {"title": "Action Register", "route": "/admin/actions", "image": "admin-actions-overview.png", "what": "The follow-up task register for issues that need to be worked through to completion.", "who": "Safety teams and managers.", "why": "It keeps corrective work visible instead of letting it disappear."},
            {"title": "Inspections", "route": "/admin/inspections", "image": "admin-inspections-overview.png", "what": "Scheduling and recording of site inspections.", "who": "Inspectors and safety managers.", "why": "It provides evidence that inspections were planned and completed."},
            {"title": "Escalations", "route": "/admin/escalations", "image": "admin-escalations-overview.png", "what": "A decision queue for issues that require stronger managerial review.", "who": "Senior operators and compliance leads.", "why": "It gives harder cases a formal, reviewable decision path."},
            {"title": "Permit-to-Work", "route": "/admin/permits", "image": "admin-permits-overview.png", "what": "The permit template, request, and approval workflow for controlled work.", "who": "Permit issuers and contractors requesting work access.", "why": "It formalizes high-risk work instead of relying on verbal permission."},
            {"title": "Safety Forms", "route": "/admin/safety-forms", "image": "admin-safety-forms-overview.png", "what": "Reusable forms and submissions for structured safety records.", "who": "Safety admins and site leads.", "why": "It standardizes how safety information is collected and stored."},
            {"title": "Approvals", "route": "/admin/approvals", "image": "admin-approvals-overview.png", "what": "Manual review, watchlist, and identity-hardening workflows before access is cleared.", "who": "Compliance and security teams.", "why": "It handles the cases that should not be waved through automatically."},
            {"title": "Communications Hub", "route": "/admin/communications", "image": "admin-communications-overview.png", "what": "The broadcast and operational-messaging feature.", "who": "Site leads and incident coordinators.", "why": "It turns urgent communication into a controlled event instead of a scattered chat."},
        ],
    },
    {
        "slug": "04-contractors-content",
        "title": "Phase 4: Contractors & Content",
        "summary": "The contractor-readiness and content-governance layer behind site access decisions.",
        "features": [
            {"title": "Contractors", "route": "/admin/contractors", "image": "admin-contractors-overview.png", "what": "The master register of contractor organisations and their active state.", "who": "Company admins and contractor managers.", "why": "It gives the business a controlled view of the external organisations it works with."},
            {"title": "Templates", "route": "/admin/templates", "image": "admin-templates-overview.png", "what": "Versioned templates used in inductions and controlled workflows.", "who": "Content owners and compliance teams.", "why": "It gives important wording and forms a governed lifecycle."},
            {"title": "Risk Passport", "route": "/admin/risk-passport", "image": "admin-risk-passport-overview.png", "what": "A summarized contractor risk view.", "who": "Contractor managers and compliance leads.", "why": "It turns scattered signals into a quick readiness picture."},
            {"title": "Competency", "route": "/admin/competency", "image": "admin-competency-overview.png", "what": "Competency requirements and worker certification records.", "who": "Training coordinators and compliance teams.", "why": "It proves people hold the required qualifications before they work."},
            {"title": "Trust Graph", "route": "/admin/trust-graph", "image": "admin-trust-graph-overview.png", "what": "A higher-level contractor trust and confidence view across sites.", "who": "Senior compliance teams and contractor governance leads.", "why": "It gives a broader picture than a single checklist or score."},
            {"title": "Benchmarks", "route": "/admin/benchmarks", "image": "admin-benchmarks-overview.png", "what": "Comparative and explainability views for broader performance signals.", "who": "Leadership and operations analysts.", "why": "It helps the business compare itself against broader patterns and models."},
        ],
    },
    {
        "slug": "05-integrations-advanced",
        "title": "Phase 5: Integrations & Advanced",
        "summary": "The advanced layer for integrations, evidence, simulation, and mobile-runtime behavior.",
        "features": [
            {"title": "Webhooks", "route": "/admin/webhooks", "image": "admin-webhooks-overview.png", "what": "The delivery monitor for outbound system-to-system events.", "who": "Technical admins and integration owners.", "why": "It shows whether external deliveries were sent, retried, or failed."},
            {"title": "Teams / Slack", "route": "/admin/integrations/channels", "image": "admin-teams-slack-overview.png", "what": "Channel-based integration setup for messages and test events.", "who": "Technical admins and communications owners.", "why": "It connects the app to the messaging tools people already use."},
            {"title": "Procore Connector", "route": "/admin/integrations/procore", "image": "admin-procore-overview.png", "what": "The bridge between InductLite and Procore-style project data flows.", "who": "Integration admins and enterprise customers.", "why": "It lets site-readiness information move between systems."},
            {"title": "Prequalification Exchange", "route": "/admin/prequalification-exchange", "image": "admin-prequalification-exchange-overview.png", "what": "Import tooling for external contractor qualification snapshots.", "who": "Compliance teams and contractor governance teams.", "why": "It brings outside readiness data into the product instead of leaving it disconnected."},
            {"title": "Mobile Ops", "route": "/admin/mobile", "image": "admin-mobile-overview.png", "what": "Admin-side controls for mobile assist hints and subscriptions.", "who": "Mobile operations admins and access-control teams.", "why": "It keeps assisted mobile behavior visible and controllable."},
            {"title": "Native Runtime", "route": "/admin/mobile/native", "image": "admin-mobile-native-overview.png", "what": "Device enrollment, bootstrap, heartbeat, and geofence-aware runtime support.", "who": "Technical admins and mobile/runtime teams.", "why": "It proves the platform can support real device-assisted access flows."},
            {"title": "Access Ops", "route": "/admin/access-ops", "image": "admin-access-ops-overview.png", "what": "Trace visibility for access-related events and decisions.", "who": "Access-control and troubleshooting teams.", "why": "It helps explain why a person was or was not granted access."},
            {"title": "Evidence Packs", "route": "/admin/evidence", "image": "admin-evidence-overview.png", "what": "Verification and audit tooling for evidence manifests.", "who": "Compliance teams and auditors.", "why": "It provides stronger trust in important records."},
            {"title": "Policy Simulator", "route": "/admin/policy-simulator", "image": "admin-policy-simulator-overview.png", "what": "Scenario modeling for policy choices before rollout.", "who": "Compliance leads and rollout teams.", "why": "It lets the team test rules before they affect real workflows."},
        ],
    },
    {
        "slug": "06-administration",
        "title": "Phase 6: Administration",
        "summary": "The governance layer for users, settings, audit traceability, and plan-level control.",
        "features": [
            {"title": "Users", "route": "/admin/users", "image": "admin-users-overview.png", "what": "Internal user management for the company side of the product.", "who": "Company admins and system administrators.", "why": "It controls who can use the operating side of the platform."},
            {"title": "Audit Log", "route": "/admin/audit-log", "image": "admin-audit-log-overview.png", "what": "The traceability ledger for admin and system actions.", "who": "Compliance teams and investigators.", "why": "It answers who changed what and when."},
            {"title": "Settings", "route": "/admin/settings", "image": "admin-settings-overview.png", "what": "The control panel for compliance, identity, and billing-related settings.", "who": "Company admins and IT or compliance leads.", "why": "It defines how the system behaves for the company environment."},
            {"title": "Plan Configurator", "route": "/admin/plan-configurator", "image": "admin-plan-configurator-overview.png", "what": "Controlled scheduling of plan and packaging changes.", "who": "Company admins and support or operations teams.", "why": "It makes commercial or rollout changes visible and recorded."},
        ],
    },
]


def get_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    if bold:
        candidates.extend(
            [
                Path("C:/Windows/Fonts/segoeuib.ttf"),
                Path("C:/Windows/Fonts/arialbd.ttf"),
            ]
        )
    else:
        candidates.extend(
            [
                Path("C:/Windows/Fonts/segoeui.ttf"),
                Path("C:/Windows/Fonts/arial.ttf"),
            ]
        )
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


FONT_H1 = get_font(54, bold=True)
FONT_H2 = get_font(38, bold=True)
FONT_BODY = get_font(28)
FONT_SMALL = get_font(22)
FONT_LABEL = get_font(20, bold=True)


def wrap_text(text: str, width: int) -> list[str]:
    return textwrap.wrap(text, width=width, break_long_words=False, break_on_hyphens=False)


def draw_wrapped(draw: ImageDraw.ImageDraw, text: str, font, x: int, y: int, width_chars: int, fill) -> int:
    lines = wrap_text(text, width_chars)
    for line in lines:
        draw.text((x, y), line, font=font, fill=fill)
        y += font.size + 10
    return y


def load_screenshot(name: str) -> Image.Image:
    path = SCREENSHOT_DIR / name
    if not path.exists():
        raise FileNotFoundError(path)
    return Image.open(path).convert("RGB")


def paste_screenshot(base: Image.Image, screenshot: Image.Image) -> None:
    target_x = LEFT_WIDTH + 40
    target_y = 70
    target_w = RIGHT_WIDTH - 80
    target_h = HEIGHT - 140
    shot = screenshot.copy()
    shot.thumbnail((target_w, target_h))
    x = target_x + (target_w - shot.width) // 2
    y = target_y + (target_h - shot.height) // 2
    shadow = Image.new("RGBA", (shot.width + 24, shot.height + 24), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((12, 12, shot.width + 12, shot.height + 12), 28, fill=(0, 0, 0, 45))
    base.paste(shadow, (x - 12, y - 12), shadow)
    frame = Image.new("RGB", (shot.width + 12, shot.height + 12), (255, 255, 255))
    frame.paste(shot, (6, 6))
    base.paste(frame, (x - 6, y - 6))


def create_intro_slide(phase: dict, out_path: Path) -> None:
    base = Image.new("RGB", (WIDTH, HEIGHT), (247, 244, 236))
    draw = ImageDraw.Draw(base)
    draw.rectangle((0, 0, LEFT_WIDTH, HEIGHT), fill=(19, 46, 52))
    draw.rectangle((LEFT_WIDTH, 0, WIDTH, HEIGHT), fill=(233, 239, 236))
    draw.rounded_rectangle((LEFT_WIDTH + 70, 120, WIDTH - 90, HEIGHT - 120), radius=34, fill=(251, 252, 250))

    draw.text((70, 70), "INDUCTLITE FEATURE GUIDE", font=FONT_LABEL, fill=(171, 214, 205))
    draw.text((70, 125), phase["title"], font=FONT_H1, fill=(255, 255, 255))
    y = draw_wrapped(draw, phase["summary"], FONT_BODY, 70, 245, 34, (223, 235, 232))
    y += 30
    draw.text((70, y), "This walkthrough covers:", font=FONT_H2, fill=(255, 255, 255))
    y += 64
    for feature in phase["features"]:
        draw.text((88, y), f"- {feature['title']}", font=FONT_BODY, fill=(241, 247, 245))
        y += 44

    right_x = LEFT_WIDTH + 120
    draw.text((right_x, 170), "What this phase shows", font=FONT_H2, fill=(20, 55, 62))
    y2 = 260
    bullets = [
        "Who uses this part of the product.",
        "What operational problem it solves.",
        "What the user sees on screen.",
        "Why it matters in a real site workflow.",
    ]
    for bullet in bullets:
        draw.text((right_x, y2), f"- {bullet}", font=FONT_BODY, fill=(48, 72, 77))
        y2 += 52

    draw.text((right_x, 610), "Format", font=FONT_H2, fill=(20, 55, 62))
    draw.text((right_x, 680), "Silent screenshot walkthrough with captions.", font=FONT_BODY, fill=(48, 72, 77))
    draw.text((right_x, 730), "Use this video alongside the matching handbook phase.", font=FONT_BODY, fill=(48, 72, 77))
    draw.text((right_x, 885), "Feature guide generated from local certified routes", font=FONT_SMALL, fill=(92, 108, 112))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    base.save(out_path)


def create_feature_slide(phase: dict, feature: dict, out_path: Path) -> None:
    base = Image.new("RGB", (WIDTH, HEIGHT), (246, 244, 239))
    draw = ImageDraw.Draw(base)
    draw.rectangle((0, 0, LEFT_WIDTH, HEIGHT), fill=(251, 249, 244))
    draw.rectangle((LEFT_WIDTH, 0, WIDTH, HEIGHT), fill=(229, 236, 232))
    draw.rounded_rectangle((30, 30, LEFT_WIDTH - 30, HEIGHT - 30), radius=32, fill=(255, 255, 255))

    draw.text((70, 70), phase["title"].upper(), font=FONT_LABEL, fill=(48, 105, 98))
    draw.text((70, 120), feature["title"], font=FONT_H1, fill=(16, 44, 50))
    draw.text((70, 205), feature["route"], font=FONT_SMALL, fill=(84, 103, 108))

    y = 290
    sections = [
        ("What it does", feature["what"]),
        ("Who uses it", feature["who"]),
        ("Why it matters", feature["why"]),
    ]
    for heading, body in sections:
        draw.text((70, y), heading, font=FONT_H2, fill=(20, 55, 62))
        y += 56
        y = draw_wrapped(draw, body, FONT_BODY, 70, y, 34, (52, 69, 73))
        y += 26

    draw.text((70, HEIGHT - 110), "Use this screen when introducing the feature to a new user.", font=FONT_SMALL, fill=(92, 108, 112))

    paste_screenshot(base, load_screenshot(feature["image"]))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    base.save(out_path)


def create_outro_slide(phase: dict, out_path: Path) -> None:
    base = Image.new("RGB", (WIDTH, HEIGHT), (22, 45, 51))
    draw = ImageDraw.Draw(base)
    draw.text((120, 150), phase["title"], font=FONT_H1, fill=(255, 255, 255))
    draw.text((120, 255), "Phase complete", font=FONT_H2, fill=(168, 219, 208))
    y = 360
    lines = [
        "Use the matching handbook chapter for the full spoken explanation.",
        "Use the screenshots for static walkthroughs and training packs.",
        "Use the video when you want a guided visual overview without live clicking.",
    ]
    for line in lines:
        draw.text((120, y), f"- {line}", font=FONT_BODY, fill=(234, 240, 238))
        y += 56
    draw.text((120, 860), "InductLite feature guide walkthrough", font=FONT_SMALL, fill=(174, 189, 186))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    base.save(out_path)


def build_phase_slides(phase: dict) -> list[tuple[Path, float]]:
    slide_dir = SLIDES_ROOT / phase["slug"]
    slide_dir.mkdir(parents=True, exist_ok=True)
    slides: list[tuple[Path, float]] = []
    intro_path = slide_dir / "00-intro.png"
    create_intro_slide(phase, intro_path)
    slides.append((intro_path, 6.0))
    for index, feature in enumerate(phase["features"], start=1):
        slide_path = slide_dir / f"{index:02d}-{feature['title'].lower().replace(' ', '-').replace('/', '-')}.png"
        create_feature_slide(phase, feature, slide_path)
        slides.append((slide_path, 5.0))
    outro_path = slide_dir / "99-outro.png"
    create_outro_slide(phase, outro_path)
    slides.append((outro_path, 4.5))
    return slides


def build_video(slides: list[tuple[Path, float]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    concat_path = output_path.with_suffix(".txt")
    with concat_path.open("w", encoding="utf-8") as handle:
        for slide, duration in slides:
            handle.write(f"file '{slide.as_posix()}'\n")
            handle.write(f"duration {duration:.2f}\n")
        handle.write(f"file '{slides[-1][0].as_posix()}'\n")

    command = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_path),
        "-vf",
        "fps=30,format=yuv420p",
        "-movflags",
        "+faststart",
        str(output_path),
    ]
    subprocess.run(command, check=True)


def build_all() -> None:
    VIDEO_ROOT.mkdir(parents=True, exist_ok=True)
    all_slides: list[tuple[Path, float]] = []
    for phase in PHASES:
        phase_slides = build_phase_slides(phase)
        phase_output = VIDEO_ROOT / f"{phase['slug']}.mp4"
        build_video(phase_slides, phase_output)
        all_slides.extend(phase_slides)
    build_video(all_slides, VIDEO_ROOT / "00-full-product-tour.mp4")


if __name__ == "__main__":
    build_all()
