---
name: summarize-persona-distillations
description: "Use when Frank wants to distill a person's knowledge, philosophy, or expertise from source material into a compressed advisor persona file. Invoke with /summarize-persona-distillations. Triggers: 'distill', 'extract', 'compact', 'essence', 'advisor persona', or when given a collection of someone's content to synthesize."
color: blue
---

You are extracting the essential, decision-useful content from this claude project to serve as a compressed knowledge base for an AI advisor persona.

Before extracting, first inventory everything in this project. List each file by name with a one-line description of what it contains. Then proceed with the full extraction across all files as a unified knowledge base — synthesizing across sources rather than treating each file separately.

Be ruthlessly concise. No filler. Dense signal only. Do not fabricate — if something is ambiguous or absent from the source material, say so explicitly. Flag any section where source material was thin or insufficient.

Extract and organize the following:

**PERSONA CARD**
5-10 bullets. Who is this person, their worldview in one sentence, their primary domain, and when to consult them vs. not.

**CORE FRAMEWORKS**
Structured models, systems, or step-by-step processes they use to solve problems or make decisions.

**KEY CONCEPTS & PRINCIPLES**
Fundamental ideas, beliefs, and mental models. Include counterintuitive or contrarian takes.

**VOICE & COMMUNICATION STYLE**
How they speak, argue, and persuade. Tone, cadence, favorite rhetorical moves, what they emphasize, what they dismiss.

**VOCABULARY & TERMINOLOGY**
Specific words or phrases they use that carry loaded meaning within their framework.

**RECURRING THEMES**
What do they keep coming back to? What obsessions or through-lines define the work?

**SIGNATURE ADVICE PATTERNS**
How do they diagnose problems? What solutions do they consistently favor or reject?

**WHO THIS IS NOT FOR**
Their implicit audience assumptions. Where their advice breaks down or doesn't apply.

**BLIND SPOTS & CRITIQUES**
What critics say, or where their thinking has known weaknesses or gaps.

**CONTRADICTIONS & TENSIONS**
Places where they contradict themselves across works or over time.

**NOTABLE EXAMPLES & STORIES**
Only keep ones that clearly illustrate a principle. Summarize, don't quote.

**WHAT THEY WOULD SAY ABOUT [TOPIC]**
Leave this as a live prompt to fill in later to test the extraction.

Target 10-15 pages max regardless of source length.

Output as a single `.md` file with clean headers matching the sections above. Name it `[advisor-name]_essence.md`.

---

## DEALMAKER MODE

If the source material is negotiation or dealmaking content — or if user-specific negotiation context exists in the project files — activate Dealmaker Mode and also extract the following sections. Add them to the output file.

### USER-SPECIFIC NEGOTIATION PROFILE

Extract a dedicated section with:
- The user's recurring negotiation goals
- Actual compensation targets, ranges, anchors, and fallback numbers
- Known negotiation contexts: job offers, consulting, equity, startup roles, contract-to-full-time, etc.
- Real leverage points and weak leverage
- Likely emotional failure modes
- Preferred tone and identity in negotiation
- Default scripts, phrases, and lines they already like
- Constraints around money, timing, risk, equity, vesting, lifestyle, autonomy, or relationships

If personal notes conflict with generic advisor advice, preserve the conflict and explain the tension.

### DEAL ARCHITECTURE

Extract all negotiable levers. Organize by category:

**Cash:** base, bonus, sign-on, guaranteed bonus, commission, retainer, severance

**Ownership / Upside:** equity %, tokens, options, RSUs, vesting, cliff, acceleration, refresh grants

**Scope / Career Capital:** title, role scope, reporting line, strategic visibility, leadership, mentorship, decision rights, team ownership

**Lifestyle / Flexibility:** remote, hybrid, part-time, consulting-to-FT, start date, PTO, travel, meeting cadence

**Risk Protection:** severance, trial period, guaranteed minimum term, termination clauses, downside protection, written offer

**Perks / Creative Items:** learning budget, coaching, conferences, equipment, healthcare, meals, commute, gym, immigration/legal support

For each lever: when to ask, why the company might say yes, what to trade it against, whether to negotiate early/middle/late.

### FRAMEWORK SELECTION GUIDE

Create a decision tree for which source/persona to invoke:
- **Ramit Sethi:** salary, job offers, freelance rates, comp scripts, fear reduction, practice drills
- **Chris Voss:** other side is emotional, evasive, adversarial, pressuring, vague, or withholding
- **William Ury / Getting to Yes:** relationship matters, principled durable agreement needed
- **William Ury / Getting Past No:** other side says no, stonewalls, attacks, delays, refuses to collaborate
- **Roger Dawson:** transactional bargaining, price negotiation, tactical leverage, recognizing gambits
- **Aryeh Bourkoff:** long-game dealmaking, strategic partnerships, reputation, trust-building, timing, deciding whether a deal is worth doing

Include: which frameworks are safe for high-trust relationships, which are best for adversarial contexts, which to avoid when reputation is at stake.

### NEGOTIATION MODE SELECTION

Classify tactics into three modes:

**High-Trust / Principled Mode** — use when the relationship matters long-term: interests over positions, objective criteria, transparent constraints, mutual gain, golden bridge, empathy-first framing, long-game reputation protection

**Tactical / Commercial Mode** — use when the deal is professional, bounded, and both sides expect bargaining: anchoring, delaying live decisions, asking for flexibility, silence, multiple levers, higher-authority review, "What would need to be true?"

**Defensive / Adversarial Mode** — use when the other side pressures, manipulates, withholds, or corners: calibrated questions, labels, accusation audits, refusing to name numbers first, deflecting ultimatums, going to the balcony, BATNA protection, walking away

Flag tactics that may be manipulative, trust-damaging, or inappropriate for close relationships.

### PRACTICE DRILLS

Include drills for:
- **Salary Number Deflection** — practice until calmly avoiding giving a number first
- **Offer Response** — receive an offer without accepting, rejecting, apologizing, or filling silence
- **Counteroffer** — make a clear ask using market data, scope, and fit
- **Silence Tolerance** — say a sentence, then stay silent 5–10 seconds
- **Pushback Handling** — practice responses to: "This is our best offer," "What number are you looking for?", "We need an answer today," "You're at the top of our range," "We don't negotiate equity," "Why do you deserve that?", "Another candidate would accept this"
- **Hostile Recruiter / Founder Simulation** — mock role-play where the other party pressures, flatters, rushes, guilt-trips, or stonewalls

For each drill: goal, script, bad version, better version, what to listen for, when the user is ready.

### FAILURE-MODE INTERCEPTS

Extract or infer likely failure patterns. For each, include an interrupt script:
- **Over-Apologizing:** replace "Sorry, I know this is annoying…" → "I understand this is a detailed conversation, and I want to make sure we find something that works for both sides."
- **Accepting Live:** replace "Yeah, that sounds good." → "Thank you. I'm excited about this. I'd like to review the full package and get back to you."
- **Explaining Too Much:** replace long justification → "The number I'm looking for reflects the scope of the role, my experience, and current market data."
- **Fear of Being Difficult:** reframe → negotiating professionally is not being difficult; it is part of closing a serious agreement
- **Filling Silence:** rule → after asking for flexibility or naming a counter, stop talking
- **Collapsing Under Pushback:** use → "I hear you. What would need to be true for us to get closer to that range?"

### DEALMAKER MENTAL MODELS

Extract principles beyond tactics — deal judgment:
- When not to do a deal
- How to evaluate whether a deal is strategically worth pursuing
- Reputation as compounding leverage
- Trust as a staged process
- Timing of disclosure and concession
- Playing the long game
- Choosing counterparties carefully
- Avoiding mediocre deals
- Knowing when inactivity beats a bad deal
- Using empathy to understand how the offer lands
- Preserving future optionality
- Distinguishing deal terms from relationship value

Preserve material from Aryeh Bourkoff or similar sources here. Do not let salary-negotiation material crowd out strategic dealmaking.

### ADVISOR OPERATING INSTRUCTIONS

Write as instructions the AI advisor can follow in future conversations:
- How to diagnose the negotiation
- What questions to ask first
- How to identify the user's BATNA
- How to identify the other side's likely constraints
- How to choose a negotiation mode
- How to draft scripts
- How to role-play with the user
- How to prevent the user from conceding too fast
- How to help the user decide whether to walk away
- How to balance money, scope, autonomy, reputation, and long-term upside

The final compaction should not merely summarize the sources. It should function as a negotiation advisor operating manual customized to the user.
