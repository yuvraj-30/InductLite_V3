# InductLite Hybrid Marketing Spec

Date: 2026-03-15

Scope: homepage and top-of-funnel marketing surfaces

Primary source references:

- Current homepage: [`../apps/web/src/app/page.tsx`](../apps/web/src/app/page.tsx)
- Current tokens: [`../apps/web/src/app/globals.css`](../apps/web/src/app/globals.css)
- Best CTA hierarchy reference: [`../competitors/1breadcrumb/inspected/page.html`](../competitors/1breadcrumb/inspected/page.html)
- Best enterprise CTA discipline reference: [`../competitors/hammertech/inspected/page.html`](../competitors/hammertech/inspected/page.html)
- Best proof restraint reference: [`../competitors/saferme/inspected/page.html`](../competitors/saferme/inspected/page.html)
- Best feature-bento composition reference: [`../competitors/signonsite/inspected/page.html`](../competitors/signonsite/inspected/page.html)

## 1. Positioning

InductLite should not look like a generic SaaS template and should not copy any competitor whole.

The intended hybrid is:

- `1Breadcrumb` hero clarity
- `HammerTech` CTA consistency
- `SaferMe` proof calmness
- `SignOnSite` modular feature composition
- InductLite’s own tokenized panel/card system

This means:

- less glass in the first viewport,
- fewer competing actions,
- tighter copy,
- stronger proof earlier,
- bento sections lower on the page where comparison and exploration matter more.

## 2. Core Visual Rules

### Hero

- One dominant CTA only.
- One secondary CTA only.
- Headline width should stay tight, around 9 to 12 words worth of measure.
- The supporting panel should be useful, not decorative.
- Remove “enterprise feature inventory” from the first screen.

### Proof

- Trust proof must appear before the large feature grid.
- Use a calm band or quiet tile row, not a carousel.
- Logos and trust statements should support the CTA, not compete with it.

### Bento Usage

- Bento belongs in features, use-cases, or proof-detail sections.
- Do not use bento as the primary above-the-fold structure.
- Avoid giving every block equal visual weight.

### Glass Policy

- Do not use glass in the homepage hero by default.
- Reserve glass for premium overlays, pricing emphasis, or selective campaign surfaces.
- Homepage should read as crisp, industrial, and decisive.

## 3. Token Map

The current token system in `globals.css` is strong enough, but the homepage should use a tighter subset.

### Recommended marketing token subset

- `--bg-base`: keep current light base
- `--bg-surface`: keep current white panel surface
- `--bg-surface-strong`: use only for secondary surfaces, not every section
- `--accent-primary`: keep for primary CTA, but use it more sparingly
- `--accent-success`: reserve for compliance and completion states, not general decoration
- `--text-primary`: keep
- `--text-secondary`: keep
- `--border-soft`: keep
- `--shadow-trust`: default card shadow
- `--shadow-float`: use only for emphasized cards

### Homepage-specific visual application

- Primary CTA background:
  - use `--accent-primary`
- Secondary CTA:
  - outline or soft neutral surface
- Hero sidecar:
  - `--bg-surface`
  - `--border-soft`
  - `--shadow-trust`
- Proof band:
  - soft tint derived from the current base surface or light blue system
- Feature cards:
  - mostly `--bg-surface`
  - rare use of `--bg-surface-strong`

### Typography rules

- Keep `Space Grotesk` for high-impact display copy, but use it only in the hero and major section headings.
- Keep `Manrope` for body and UI.
- Reduce overuse of heavy black weights on the homepage.
- Use:
  - hero headline: `font-bold` or `font-extrabold`
  - section headings: `font-bold`
  - card headings: `font-semibold`
- Avoid too many all-caps labels in a single viewport.

## 4. Required Homepage Structure

Recommended order:

1. Navigation
2. Hero with one CTA and one secondary CTA
3. Early proof band
4. Feature bento section
5. Workflow or use-case section
6. Pricing preview
7. Product/integration support section
8. Final CTA
9. Footer

### Why this order

- The current page moves too quickly from hero into feature inventory.
- Competitors that convert best make the first decision simple, then justify it with proof, then expand into capability.

## 5. Mapping to the Current Homepage

### Current strengths

From [`../apps/web/src/app/page.tsx`](../apps/web/src/app/page.tsx):

- tokenized surfaces are already in place
- card and button primitives already exist
- pricing cards are structurally stronger than most other sections
- overall information density is reasonable

### Current weaknesses

#### Hero is too evenly weighted

Current hero in [`../apps/web/src/app/page.tsx`](../apps/web/src/app/page.tsx) does this:

- left side: headline + two CTAs
- right side: workflow panel
- bottom: trust badge strip

The issue is that all three areas compete.

Required change:

- make the left column dominant
- convert the right panel into a real conversion sidecar or a sharper “why switch” panel
- reduce the trust strip to fewer, stronger items

#### Hero CTA language is split

Current CTA labels:

- `Start Free Workspace`
- `Book Demo`
- `Start New Workspace`
- `Talk to Sales`

This is too many top-level action phrasings.

Required change:

- choose one primary CTA family:
  - `Start free`
  - or `Book demo`
- then keep the secondary CTA family consistent everywhere

Recommended:

- primary: `Start free`
- secondary: `Book demo`

#### Feature section is too inventory-driven

The `What Clients Expect in 2026` section currently reads like a broad checklist.

Required change:

- convert it into a tighter bento with grouped themes:
  - sign-in and induction
  - compliance and permits
  - emergency and response
  - audit and exports

This will feel more product-led and less spreadsheet-led.

#### Integrations section lands too early

Integrations currently appear before pricing and before proof depth.

Required change:

- move integrations lower
- treat them as support detail, not as first-wave persuasion

#### Final CTA section is generic

Current final CTA copy is functional but not ownable.

Required change:

- match the hero language pattern
- use one direct promise and one action

## 6. Proposed New Homepage Composition

### Section 1: Nav

Keep the compact nav shell, but simplify the action area.

Recommended nav actions:

- `Features`
- `Pricing`
- `Compare`
- `Login`
- primary CTA: `Start free`

### Section 2: Hero

Content model:

- eyebrow: short category cue
- headline: 1 clear promise
- supporting paragraph: one sentence, one proof of value
- primary CTA: `Start free`
- secondary CTA: `Book demo`
- sidecar: concise demo/request card or a compact workflow proof card

Recommended direction:

- tighter headline
- less “full stack” language
- more “fast, compliant, live” language

### Section 3: Proof band

Borrow from SaferMe’s restraint.

Content model:

- one short heading
- logo row or trust-category row
- optional 2 to 4 short trust statements

No carousel.

### Section 4: Feature bento

Borrow from SignOnSite.

Content model:

- one large primary feature card
- 2 to 4 supporting cards
- one proof or testimonial quote embedded inside the grid

This replaces the current uniform feature inventory block.

### Section 5: Workflow / live operations

Use the current “Typical Workflow” concept here instead of in the hero sidecar.

Content model:

- 4-step operational flow
- one companion card about evidence and exports

### Section 6: Pricing preview

Keep the existing pricing card direction.

Required changes:

- shrink copy
- reduce plan preamble
- give Pro one clear highlight without making the section look separate from the rest of the page

### Section 7: Integrations and onboarding support

Combine current integrations and onboarding/support into one lower-priority section.

This turns them into confidence builders instead of first-line persuasion.

### Section 8: Final CTA

Make it structurally simpler:

- one headline
- one supporting line
- one primary action
- one secondary action

No extra explanatory clutter.

## 7. Change First

The best sequence is:

1. Rewrite the hero and CTA system
2. Insert a quiet proof band directly below the hero
3. Replace the uniform feature inventory with a real bento feature composition
4. Move integrations lower
5. Tighten final CTA and pricing copy

### Phase 1: Hero and CTA normalization

Files:

- [`../apps/web/src/app/page.tsx`](../apps/web/src/app/page.tsx)
- [`../apps/web/src/components/ui/button.tsx`](../apps/web/src/components/ui/button.tsx)

Tasks:

- normalize CTA labels
- reduce hero noise
- make right-side panel more conversion-focused

### Phase 2: Proof and bento restructuring

Files:

- [`../apps/web/src/app/page.tsx`](../apps/web/src/app/page.tsx)
- optionally [`../apps/web/src/components/ui/card.tsx`](../apps/web/src/components/ui/card.tsx) if a new marketing card variant is needed

Tasks:

- add proof band below hero
- refactor features into grouped bento cards

### Phase 3: Lower-page cleanup

Files:

- [`../apps/web/src/app/page.tsx`](../apps/web/src/app/page.tsx)

Tasks:

- move integrations lower
- compress support/onboarding
- tighten final CTA

## 8. Copy Direction

The homepage copy should shift from:

- “full platform inventory”

to:

- “one clear outcome with supporting capability”

Use these writing rules:

- one promise per section
- one dominant noun per heading
- fewer abstract phrases like `stack`, `workspace`, `scope`
- more operational language like `site`, `sign-in`, `induction`, `compliance`, `records`

## 9. Anti-Patterns to Avoid

- Do not put glass cards in the hero just because the system supports them.
- Do not use sliders for proof or testimonials.
- Do not let every section have equal contrast and elevation.
- Do not introduce more CTA labels.
- Do not make the homepage read like a release note list.

## 10. Definition of Done

The hybrid marketing direction is correctly implemented when:

- the hero has one dominant action and one clear secondary action
- proof appears immediately after the hero
- the first feature section feels grouped and intentional, not list-driven
- integrations no longer appear too early
- the page uses fewer visual modes in the first two scrolls
- the experience reads more decisive than the current homepage while preserving the existing design system
