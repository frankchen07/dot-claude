import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNotes, shortTokens, formatDuration, formatUsd, hookRuns, cardLines } from "../hooks/card.mjs";

test("parseNotes splits name: note pairs and tolerates junk", () => {
  assert.deepEqual(parseNotes("output-prove-it: 139 tests green; Explore: found 3 files"),
    { "output-prove-it": "139 tests green", Explore: "found 3 files" });
  assert.deepEqual(parseNotes(undefined), {});
  assert.deepEqual(parseNotes(""), {});
  assert.deepEqual(parseNotes("no colon here; a: b"), { a: "b" });
  assert.deepEqual(parseNotes("url: http://x: y"), { url: "http://x: y" });
});

test("shortTokens", () => {
  assert.equal(shortTokens(591), "591");
  assert.equal(shortTokens(41234), "41.2k");
  assert.equal(shortTokens(18000), "18k");
  assert.equal(shortTokens(1_250_000), "1.3M");
});

test("formatDuration", () => {
  assert.equal(formatDuration(9095), "9.1s");
  assert.equal(formatDuration(372_000), "6m 12s");
  assert.equal(formatDuration(3_725_000), "1h 2m");
});

test("formatUsd", () => {
  assert.equal(formatUsd(0.0021), "$0.002");
  assert.equal(formatUsd(1.234), "$1.23");
  assert.equal(formatUsd(undefined), "");
});

test("hookRuns keeps this turn's runs for this folder", () => {
  const log = [
    JSON.stringify({ ts: 100, cwd: "/a", hook: "audit-nudge", event: "Stop", result: "block" }),
    "not json",
    JSON.stringify({ ts: 300, cwd: "/a", hook: "audit-nudge", event: "Stop", result: "block" }),
    JSON.stringify({ ts: 310, cwd: "/b", hook: "audit-nudge", event: "Stop", result: "block" }),
    JSON.stringify({ ts: 320, cwd: "/a", hook: "audit-nudge", event: "Stop", result: "pass" }),
  ].join("\n");
  assert.deepEqual(hookRuns(log, 200, "/a"), [{ name: "Stop: audit-nudge", text: "blocked 1× → passed" }]);
  assert.deepEqual(hookRuns("", 0, "/a"), []);
});

const turn = {
  calls: [
    { tool: "Skill", skill: "explore-effective-efficiency" },
    { tool: "Read" },
    { tool: "Skill", skill: "coding-scope-discipline" },
    { tool: "Edit" }, { tool: "Edit" },
    { tool: "Skill", skill: "coding-scope-discipline" },
    { tool: "Agent", subagent_type: "Explore", description: "probe", agentId: "a1", model: "claude-haiku-5-5" },
    { tool: "Bash" },
    { tool: "Skill", skill: "audit-session-summary", args: "coding-scope-discipline: kept diff small; Explore: returned ok" },
  ],
  agentUsage: { a1: { input_tokens: 2, output_tokens: 4, cache_read_input_tokens: 0, cache_creation_input_tokens: 17824 } },
};
const end = {
  number: 3, durationMs: 9095, costUsd: 0.0021, contextPercent: 4,
  usage: { input_tokens: 10, output_tokens: 591, cache_read_input_tokens: 154871, cache_creation_input_tokens: 31901 },
  hooks: [{ name: "Stop: audit-nudge", text: "blocked 1× → passed" }],
};

test("cardLines builds header and rows, notes attached, audit skill hidden", () => {
  const lines = cardLines(turn, end);
  assert.deepEqual(lines[0], { label: "Turn 3", text: "9.1s · $0.002 · 187k in · 591 out · context 4%" });
  assert.deepEqual(lines.slice(1), [
    { label: "Skills", text: "explore-effective-efficiency" },
    { label: "", text: "coding-scope-discipline ×2 — kept diff small" },
    { label: "Agents", text: "Explore · probe (haiku, 17.8k) — returned ok" },
    { label: "Hooks", text: "Stop: audit-nudge blocked 1× → passed" },
    { label: "Tools", text: "Skill 4 · Edit 2 · Agent 1 · Bash 1 · Read 1" },
  ]);
});

test("cardLines says none for skills and agents, drops other empty rows", () => {
  const lines = cardLines({ calls: [], agentUsage: {} }, { number: 1, durationMs: 1200, usage: { input_tokens: 5, output_tokens: 7 } });
  assert.deepEqual(lines, [
    { label: "Turn 1", text: "1.2s · 5 in · 7 out" },
    { label: "Skills", text: "none" },
    { label: "Agents", text: "none" },
  ]);
});

test("agent notes match type or description, ignoring case and a trailing 'agent'", () => {
  const calls = [
    { tool: "Agent", subagent_type: "Explore", description: "probe" },
    { tool: "Agent", subagent_type: "verify-e2e-complete", description: "Check it runs" },
    { tool: "Skill", skill: "audit-session-summary", args: "Explore agent: returned ok; check it runs: passed" },
  ];
  const lines = cardLines({ calls, agentUsage: {} }, { number: 2, durationMs: 1000, usage: {} });
  assert.deepEqual(lines.filter((l) => l.label === "Agents" || l.label === "").map((l) => l.text), [
    "Explore · probe — returned ok",
    "verify-e2e-complete · Check it runs — passed",
  ]);
});

test("hookRuns says when the loop guard gave up", () => {
  const log = [
    JSON.stringify({ ts: 300, cwd: "/a", hook: "audit-nudge", event: "Stop", result: "block" }),
    JSON.stringify({ ts: 301, cwd: "/a", hook: "audit-nudge", event: "Stop", result: "block" }),
    JSON.stringify({ ts: 302, cwd: "/a", hook: "audit-nudge", event: "Stop", result: "gave-up" }),
  ].join("\n");
  assert.deepEqual(hookRuns(log, 0, "/a"), [{ name: "Stop: audit-nudge", text: "blocked 2× → gave up" }]);
});
