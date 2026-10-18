// Pure helpers for Turn Card: no `$`, so they run under `node --test`.

// The skill that carries the model's notes; it is the card's input, not a row.
export const NOTES_SKILL = "audit-session-summary";

// True when a skill or agent ran after the last notes call, so its outcome has no note yet.
export function needsNotes(calls) {
  const last = calls.findLastIndex((c) => (c.tool === "Skill" && c.skill !== NOTES_SKILL) || c.tool === "Agent");
  return last > calls.findLastIndex((c) => c.tool === "Skill" && c.skill === NOTES_SKILL);
}

// "name: note; name: note" → { name: note }. Pairs without a colon are dropped.
export function parseNotes(args) {
  const notes = {};
  for (const pair of String(args ?? "").split(";")) {
    const at = pair.indexOf(":");
    if (at <= 0) continue;
    const name = pair.slice(0, at).trim();
    const note = pair.slice(at + 1).trim();
    if (name && note) notes[name] = note;
  }
  return notes;
}

export function shortTokens(n) {
  if (n >= 1_000_000) return `${trimZero((n / 1_000_000).toFixed(1))}M`;
  if (n >= 100_000) return `${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `${trimZero((n / 1_000).toFixed(1))}k`;
  return String(n);
}

function trimZero(s) {
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

export function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export function formatUsd(usd) {
  if (usd === undefined || usd === null) return "";
  return `$${usd < 0.01 ? usd.toFixed(3) : usd.toFixed(2)}`;
}

// The model names things loosely ("Explore agent", "Check It Runs"), so notes are matched on this.
function noteKey(name) {
  return String(name ?? "").trim().toLowerCase().replace(/\s+agent$/, "");
}

function tokensIn(u) {
  return (u?.input_tokens ?? 0) + (u?.cache_read_input_tokens ?? 0) + (u?.cache_creation_input_tokens ?? 0);
}

// "187k in: 155k cached (83%) · 31.9k new · 591 out". New is what wasn't read from cache, cache writes included.
function tokensText(u) {
  const total = tokensIn(u);
  const cached = u.cache_read_input_tokens ?? 0;
  const pct = total ? ` (${Math.round((cached / total) * 100)}%)` : "";
  return `${shortTokens(total)} in: ${shortTokens(cached)} cached${pct} · ${shortTokens(total - cached)} new · ${shortTokens(u.output_tokens ?? 0)} out`;
}

// "context 150k / 1M (15%)", or "context 15%" when the window's size isn't known.
function formatContext(end) {
  if (end.contextPercent === undefined) return "";
  if (end.contextTokens === undefined || !end.contextWindow) return `context ${end.contextPercent}%`;
  return `context ${shortTokens(end.contextTokens)} / ${shortTokens(end.contextWindow)} (${end.contextPercent}%)`;
}

// "claude-haiku-5-5" → "haiku".
function modelFamily(model) {
  return String(model ?? "").replace(/^claude-/, "").split("-")[0];
}

// One finished turn → [{ label, text }]: a header, then a line per skill and agent, then tool counts.
export function cardLines(turn, end) {
  const notes = {};
  for (const c of turn.calls) {
    if (c.tool !== "Skill" || c.skill !== NOTES_SKILL) continue;
    for (const [name, note] of Object.entries(parseNotes(c.args))) notes[noteKey(name)] = note;
  }
  const withNote = (names, text) => {
    const note = names.map((n) => notes[noteKey(n)]).find(Boolean);
    return note ? `${text} — ${note}` : text;
  };

  const header = [formatDuration(end.durationMs ?? 0), formatUsd(end.costUsd), formatContext(end)].filter(Boolean);
  const lines = [{ label: `Turn ${end.number}`, text: header.join(" · ") }, { label: "Tokens", text: tokensText(end.usage ?? {}) }];

  const row = (label, texts) => texts.forEach((text, k) => lines.push({ label: k === 0 ? label : "", text }));
  const orNone = (texts) => (texts.length ? texts : ["none"]);

  const skills = new Map();
  for (const c of turn.calls) {
    if (c.tool !== "Skill" || !c.skill || c.skill === NOTES_SKILL) continue;
    skills.set(c.skill, (skills.get(c.skill) ?? 0) + 1);
  }
  row("Skills", orNone([...skills].map(([name, n]) => withNote([name], n > 1 ? `${name} ×${n}` : name))));

  row("Agents", orNone(turn.calls.filter((c) => c.tool === "Agent").map((c) => {
    const type = c.subagent_type || "general-purpose";
    const usage = turn.agentUsage?.[c.agentId];
    const meta = [modelFamily(c.model), usage ? shortTokens(tokensIn(usage) + (usage.output_tokens ?? 0)) : ""].filter(Boolean);
    return withNote([c.description, type], `${type}${c.description ? ` · ${c.description}` : ""}${meta.length ? ` (${meta.join(", ")})` : ""}`);
  })));

  const tools = new Map();
  for (const c of turn.calls) if (c.skill !== NOTES_SKILL) tools.set(c.tool, (tools.get(c.tool) ?? 0) + 1);
  const counts = [...tools].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t, n]) => (n > 1 ? `${t} ×${n}` : t));
  if (counts.length) lines.push({ label: "Tools", text: counts.join(" · ") });
  return lines;
}

// Finished turns ({ calls, end }) → plain text for /turns, newest first.
export function historyText(turns, agentUsage) {
  if (!turns.length) return "No turns yet";
  return [...turns].reverse().map(({ calls, end }) => {
    const [head, ...rows] = cardLines({ calls, agentUsage }, end);
    return [`${head.label} · ${head.text}`, ...rows.map((l) => `  ${l.label.padEnd(8)}${l.text}`)].join("\n");
  }).join("\n\n");
}

// Store keys for saved /turns histories ("turns:<sessionId>"), oldest first → the ones past `keep`.
export function sessionKeysToPrune(keys, keep) {
  const saved = keys.filter((k) => k.startsWith("turns:"));
  return saved.slice(0, Math.max(0, saved.length - keep));
}
