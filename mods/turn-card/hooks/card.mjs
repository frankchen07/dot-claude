// Pure helpers for Turn Card: no `$`, so they run under `node --test`.

// The skill that carries the model's notes; it is the card's input, not a row.
export const NOTES_SKILL = "audit-session-summary";

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

// "claude-haiku-5-5" → "haiku".
function modelFamily(model) {
  return String(model ?? "").replace(/^claude-/, "").split("-")[0];
}

// Lines appended by shell hooks (see README), as JSON: { ts, cwd, hook, event, result }.
// Keeps runs since the turn started in this folder, one entry per hook.
export function hookRuns(logText, sinceMs, cwd) {
  const byHook = new Map();
  for (const line of String(logText ?? "").split("\n")) {
    let run;
    try { run = JSON.parse(line); } catch { continue; }
    if (!run || run.ts < sinceMs || run.cwd !== cwd) continue;
    const name = `${run.event}: ${run.hook}`;
    const seen = byHook.get(name) ?? { blocks: 0, last: "" };
    if (run.result === "block") seen.blocks++;
    seen.last = run.result;
    byHook.set(name, seen);
  }
  return [...byHook].map(([name, { blocks, last }]) => {
    const parts = blocks ? [`blocked ${blocks}×`] : [];
    if (last === "pass") parts.push("passed");
    if (last === "gave-up") parts.push("gave up");
    return { name, text: parts.join(" → ") };
  });
}

// One finished turn → [{ label, text }]: a header, then a line per skill, agent and hook, then tool counts.
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

  const u = end.usage ?? {};
  const header = [formatDuration(end.durationMs ?? 0), formatUsd(end.costUsd),
    `${shortTokens(tokensIn(u))} in`, `${shortTokens(u.output_tokens ?? 0)} out`,
    end.contextPercent === undefined ? "" : `context ${end.contextPercent}%`].filter(Boolean);
  const lines = [{ label: `Turn ${end.number}`, text: header.join(" · ") }];

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

  row("Hooks", (end.hooks ?? []).map((h) => `${h.name} ${h.text}`));

  const tools = new Map();
  for (const c of turn.calls) tools.set(c.tool, (tools.get(c.tool) ?? 0) + 1);
  const counts = [...tools].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t, n]) => `${t} ${n}`);
  if (counts.length) lines.push({ label: "Tools", text: counts.join(" · ") });
  return lines;
}
