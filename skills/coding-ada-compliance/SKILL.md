---
name: coding-ada-compliance
description: Use when building, auditing, or shipping any customer-facing website — before marking a site "done"/"ready for prod," when a client or business has a physical location in California (esp. Santa Clara County / San Jose — high serial-litigation area), or when asked about ADA/WCAG/Unruh Act compliance, accessibility statements, contrast, skip-to-content, or screen-reader support. Triggers: ADA compliance, website accessibility, WCAG, Unruh Act, accessibility audit, ready for prod, screen reader support, contrast check.
---

# ADA / Website Accessibility Compliance

## Overview

"ADA compliant" has no single certifying body or checklist blessed by law —
but courts, DOJ guidance, and settlements have converged on one de facto
technical standard: **WCAG 2.1 Level AA**. Treat that as the bar. This skill
covers (1) the legal landscape so you know how much risk is actually on the
table, and (2) a verifiable pre-launch checklist so "ADA compliant" means
something concrete instead of a vibe.

## Legal landscape

| Layer | What it means | Exposure |
|---|---|---|
| **Federal — ADA Title III** | 9th Circuit (`Robles v. Domino's Pizza`, 2019, cert denied) held websites/apps are covered when they extend a physical place of public accommodation. No published federal technical standard, but WCAG 2.1 AA is what courts and DOJ settlements point to. | Injunctive relief, attorney's fees; no statutory per-violation damages at the federal level. |
| **California — Unruh Civil Rights Act (Civ. Code §51)** | Any ADA violation is automatically an Unruh violation (1992 amendment incorporates ADA by reference). `Thurston v. Midvale Corp.` (Cal. Ct. App., 2019) affirmed a restaurant website violated Unruh via ADA incorporation and ordered WCAG 2.0 AA compliance — controlling precedent for CA food-service sites. | **$4,000 statutory minimum per violation** (not per suit — per violation), up to 3x actual damages, plus attorney's fees. No cure period — a suit can't be dismissed by fixing the site afterward. |
| **Online-only exception** | `Martinez v. Cot'n Wash, Inc.` (Cal. Ct. App., 2022) — a site with **no physical-location nexus** isn't a "place of public accommodation," so no ADA/Unruh claim. | Only protects pure e-commerce/SaaS with zero physical presence. **Any brick-and-mortar location (café, retail, restaurant) destroys this defense instantly** — nexus is trivial to establish. |
| **Santa Clara County / San Jose specifically** | Documented litigation hotspot — San José Spotlight covered a Small Business Advisory Task Force convened specifically over serial-filing volume (Assemblymembers Alex Lee, Evan Low involved). Local casualties: Crema Coffee and Time Deli closed after suits; Plaza Garibaldi (San Jose restaurant) paid $17,000 to settle. | Higher baseline risk than most CA counties just by being located here. |

### Serial plaintiffs / firms to know about (pattern recognition, not an exhaustive list)

- **Scott Johnson** — Sacramento-based, 2,000+ ADA suits across Northern CA / Bay Area (Mountain View, Palo Alto, and broader region), typically targets restaurants, salons, auto shops, liquor stores. Separately sentenced to home detention + $250K restitution for tax fraud tied to settlement income — that's a fact about him, not a weakness in the underlying claims.
- **Perla Mageno** (repped by Manning Law) — 600+ suits, concentrated on small restaurants, bakeries, and coffee shops specifically.
- Firms recurring in this space: **Manning Law APC, Wilshire Law Firm, Pacific Trial Attorneys**.
- Pattern: quick physical/website check → demand letter → settlement pressure (CA has no cure period, so "we'll fix it" doesn't stop the suit once filed).

### Bottom line

If the business has a physical CA location (any café/retail/restaurant qualifies), the online-only defense doesn't apply, Unruh's per-violation statutory damages dwarf federal exposure, and Santa Clara County specifically has an above-average filing rate. Treat WCAG 2.1 AA as a launch gate, not a nice-to-have.

## Pre-launch checklist — verifiable, not vibes

Each item lists **how to actually check it** — don't mark anything done from a visual skim. Run axe DevTools / Lighthouse / WAVE as a first pass, then do the manual checks below by hand — automated scanners catch roughly a third of real WCAG failures.

### Perceivable

- [ ] **Color contrast** — text ≥ 4.5:1 (normal text), ≥ 3:1 (large text ≥18pt/14pt bold), UI components/icons ≥ 3:1 against adjacent color. Verify: browser DevTools contrast checker on every distinct text/background pair, or WebAIM Contrast Checker with your actual hex values. Check hover/focus/disabled states too, not just default.
- [ ] **Alt text on all meaningful images** — decorative images get `alt=""` (empty, not missing) so screen readers skip them; informative images describe content/function, not "image of...". Verify: turn on a screen reader (VoiceOver on Mac: Cmd+F5) and tab through every image.
- [ ] **Captions/transcripts on video, audio descriptions where needed** — any pre-recorded video with audio needs captions; if visual-only info is conveyed, needs an audio description track or transcript. Verify: play every video with sound off, confirm captions are present and accurate.
- [ ] **No information conveyed by color alone** — e.g., a form error can't be "red border" only; must also have text/icon. Verify: view the page in grayscale (DevTools rendering emulation) and confirm nothing becomes unreadable/ambiguous.
- [ ] **Text resizable to 200% without loss of content/function** — no fixed-height containers clipping text, no horizontal scroll required. Verify: Cmd/Ctrl + "+" to 200% zoom, check every page.
- [ ] **Responsive reflow at 320px width** — content usable at mobile width without horizontal scrolling (except data tables/images where inherent). Verify: DevTools responsive mode at 320px.

### Operable

- [ ] **Skip-to-content link** — first focusable element on every page, visually hidden until focused, jumps past nav/header to `<main>`. Verify: load any page, hit Tab once, confirm the skip link appears and Enter jumps focus past the nav.
- [ ] **Full keyboard navigation, no traps** — every interactive element (nav, forms, modals, carousels, dropdowns, custom widgets) reachable and operable via Tab/Shift+Tab/Enter/Space/Esc/Arrow keys, with no dead end that swallows focus. Verify: unplug your mouse. Navigate the entire golden path (browse → add to cart/book → checkout/submit) keyboard-only.
- [ ] **Visible focus indicator on every interactive element** — never `outline: none` without a replacement style. Verify: Tab through the page, confirm every focused element has an unmistakable visual state (not just a 1px default that gets lost against the background).
- [ ] **Logical tab order** — matches visual/reading order, no jarring jumps. Verify: same keyboard pass as above, watch where focus lands.
- [ ] **No keyboard traps in modals/dialogs** — focus is trapped *inside* an open modal (can't tab out to background content) but Esc closes it and returns focus to the trigger element. Verify: open every modal/dialog, confirm Tab cycles within it and Esc returns you to where you started.
- [ ] **No auto-playing content that can't be paused** — carousels, video, animations running >5s need a pause/stop control. Verify: load the page, time anything that moves on its own.
- [ ] **Sufficient target size for touch/click** — interactive elements ≥ 24x24px (WCAG 2.1 AA minimum), with adequate spacing. Verify: inspect small icon-buttons/links particularly on mobile viewports.
- [ ] **No content that flashes more than 3x/second** — seizure risk. Verify: review any animated/flashing elements (rare in typical marketing/e-commerce sites, but check hero animations).

### Understandable

- [ ] **Form labels programmatically associated** — every `<input>` has a `<label for>` (or `aria-label`/`aria-labelledby`), not just adjacent placeholder text. Verify: inspect DOM for every form field; placeholder-as-label is a fail (disappears on input, unreadable by many screen readers).
- [ ] **Error identification + suggestion** — form validation errors are announced to screen readers (`aria-live` region or `aria-describedby` linking field to error text) and describe *how* to fix it, not just "invalid". Verify: submit a form with bad input using a screen reader on, confirm the error is announced and specific.
- [ ] **Consistent navigation/labeling** — same nav structure and component naming across pages. Verify: spot-check 3-4 different page templates.
- [ ] **Page has a descriptive `<title>` and `lang` attribute** — `<html lang="en">` set, unique `<title>` per page. Verify: view source on each template.
- [ ] **Headings in logical hierarchical order** — one `<h1>` per page, no skipped levels (h2 → h4 without h3). Verify: browser extension (e.g. HeadingsMap) or manual DOM scan.

### Robust

- [ ] **Semantic HTML / landmark regions** — `<nav>`, `<main>`, `<header>`, `<footer>`, not div-soup with click handlers. Custom interactive components (dropdowns, tabs, accordions) have correct ARIA roles/states (`role`, `aria-expanded`, `aria-selected`, etc.). Verify: run axe DevTools — this is what it's best at catching.
- [ ] **Screen reader pass on the full golden path** — not just spot checks. Verify: VoiceOver (Mac, Cmd+F5) or NVDA (Windows, free) through the actual critical flow — browse → product/service detail → cart/booking → checkout/contact form → confirmation.
- [ ] **No ARIA misuse** — `aria-hidden="true"` never on focusable elements, `role` attributes match actual behavior. Verify: axe DevTools flags most of this automatically.

### Site-level / legal-adjacent (specific to the "100% ready to publish" bar)

- [ ] **Published accessibility statement page** — states the target standard (WCAG 2.1 AA), a contact method for accessibility issues, and ideally a stated review cadence. This is what plaintiffs' counsel checks first and it materially affects settlement posture. Verify: page exists, is linked in the footer, and isn't a stub.
- [ ] **Privacy policy page, current and linked in footer** — separate from accessibility but bundled into most "pre-prod" launch gates; confirm it accurately describes actual data collection (forms, analytics, cookies) rather than boilerplate that doesn't match the site.
- [ ] **Cookie/consent banner is itself keyboard-accessible and screen-reader-announced** — a common miss: the banner blocking the page is inaccessible, which is its own violation on top of whatever it's disclosing.
- [ ] **PDF/downloadable documents are accessible** — tagged PDFs with reading order, or an HTML alternative offered. Verify: any menu/policy/spec sheet PDF — open with a screen reader, or run it through Adobe's accessibility checker.
- [ ] **Third-party embeds/widgets audited too** — booking widgets, payment iframes, chat widgets, map embeds. These are outside your codebase but still part of *your* site's compliance exposure. Verify: keyboard + screen reader pass on each embedded widget specifically, not just your own markup.

### Tooling stack (run in this order)

1. **axe DevTools** (browser extension) — automated pass, catches ~30-40% of issues, near-zero false positives, run first.
2. **Lighthouse** (Chrome DevTools → Accessibility tab) — second automated pass, different rule set, also flags performance/SEO issues that often correlate.
3. **WAVE** (browser extension) — visual overlay, good for a fast eyeball pass on contrast and structure.
4. **Manual keyboard-only pass** — the checklist above, no mouse.
5. **Manual screen reader pass** — VoiceOver (Mac) or NVDA (Windows, free) through the golden path end to end.
6. **WebAIM Contrast Checker** — spot-check any color pair the automated tools flagged or that looks borderline.

None of steps 1-3 alone are sufficient for a "100% compliant, ready for prod" claim — they're necessary but not sufficient. Steps 4-5 are what actually catch the failures that generate lawsuits (keyboard traps, missing skip links, unlabeled forms, focus order).
