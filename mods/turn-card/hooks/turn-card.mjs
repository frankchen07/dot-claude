// Turn Card: when a turn ends, draws a box above the prompt with what ran in it:
// skills, agents (model, tokens), shell hooks, tool counts, time, cost and tokens.
//
// The host reads on(...) and $.noun.method(...) from source, so they are
// spelled literally, and helpers that take $ are top-level functions.

import { cardLines, hookRuns } from "./card.mjs";

// Mods have no `process`, so the shell expands $HOME. Only recent lines matter.
const READ_HOOK_LOG = 'tail -n 50 "$HOME/.claude/audit-nudge/state/hooks.jsonl" 2>/dev/null';
const LABEL_COLORS = { Skills: "cyan", Agents: "magenta", Hooks: "yellow", Tools: "gray" };

const state = {
  enabled: true,
  current: null,
  // The last finished turn; lines are built at render time so a late async agent's tokens still show.
  card: null,
  turns: 0,
  lastCostUsd: 0,
  // agentId → usage, kept across turns because async agents can finish after the turn that started them.
  agentUsage: {},
};

export function register(on) {
  on("session.start", async ($, e, next) => {
    const r = await next(e);
    await $.command.register({ name: "turncard", description: "Turn Card: show or hide the end-of-turn summary" });
    // A resumed session already has cost on it; the first card should show only its own turn.
    try { state.lastCostUsd = (await $.session.usage())?.cost?.usd ?? 0; } catch { /* first card shows the session total */ }
    return r;
  });

  on("command.run", { command: "turncard" }, ($, e) => {
    state.enabled = !state.enabled;
    $.ui.invalidate("ui.render");
    return { text: `Turn Card ${state.enabled ? "on" : "off"}` };
  });

  on("turn.start", ($, e, next) => {
    if (!e.agentId) state.current = { startedAt: Date.now(), calls: [] };
    return next(e);
  });

  // Records the call and passes it on unchanged; never blocks.
  on("tool.call", async ($, e, next) => {
    const call = { tool: e.tool, skill: e.skill, args: e.args, subagent_type: e.subagent_type, description: e.description };
    if (state.current && !e.agentId) state.current.calls.push(call);
    const r = await next(e);
    if (e.tool === "Agent") {
      call.agentId = r?.result?.agentId;
      call.model = r?.result?.resolvedModel;
    }
    return r;
  });

  on("turn.complete", async ($, e, next) => {
    const r = await next(e);
    if (e.agentId) {
      state.agentUsage[e.agentId] = e.usage;
      $.ui.invalidate("ui.render");
      return r;
    }
    if (!state.current) return r;
    await finishTurn($, e);
    return r;
  });

  on("ui.render", { component: "AbovePrompt" }, ($, e, next) => {
    if (!state.enabled || !state.card || e.hasSurvey) return next(e);
    const { Box, Text } = $.ui.resolve(e);
    const lines = cardLines({ calls: state.card.calls, agentUsage: state.agentUsage }, state.card.end);
    return Box({
      flexDirection: "column", borderStyle: "round", borderColor: "gray", paddingX: 1,
      children: lines.map((line, k) => Box({
        key: `l${k}`, flexDirection: "row", children: [
          Text({ bold: true, color: k === 0 ? "magenta" : LABEL_COLORS[line.label], children: line.label.padEnd(8) }),
          Text({ dimColor: k === 0, wrap: "truncate-end", children: line.text }),
        ],
      })),
    });
  });
}

async function finishTurn($, e) {
  const turn = state.current;
  state.current = null;
  state.turns++;
  const end = { number: state.turns, durationMs: Date.now() - turn.startedAt, usage: e.usage, hooks: [] };
  try {
    const usage = await $.session.usage();
    if (usage?.cost?.usd !== undefined) {
      end.costUsd = usage.cost.usd - state.lastCostUsd;
      state.lastCostUsd = usage.cost.usd;
    }
    end.contextPercent = usage?.context?.percent;
  } catch { /* the card shows what the turn event carried */ }
  try {
    const log = await $.process.run(["bash", "-c", READ_HOOK_LOG], { timeoutMs: 5000 });
    end.hooks = hookRuns(log.stdout, Math.floor(turn.startedAt / 1000) * 1000, await $.session.cwd());
  } catch { /* no hook row */ }
  state.card = { calls: turn.calls, end };
  $.ui.invalidate("ui.render");
}
