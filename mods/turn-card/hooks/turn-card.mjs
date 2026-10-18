// Turn Card: when a turn ends, draws a box above the prompt with what ran in it:
// skills, agents (model, tokens), tool counts, time, cost and tokens. It also holds a turn open until the
// model has passed outcome notes for the skills and agents it used, since the notes are the card's only input
// the mod can't record itself.
//
// The host reads on(...) and $.noun.method(...) from source, so they are
// spelled literally, and helpers that take $ are top-level functions.

import { cardLines, historyText, needsNotes, NOTES_SKILL, sessionKeysToPrune } from "./card.mjs";

// Saved /turns histories kept on disk, one per session.
const SAVED_SESSIONS = 25;
const LABEL_COLORS = { Tokens: "blue", Skills: "cyan", Agents: "magenta", Tools: "gray" };
const NUDGE = `You used a Skill or Agent this turn without running ${NOTES_SKILL} yet. Invoke the ${NOTES_SKILL} skill now, with args \`name: outcome; …\` for each skill and agent used, then you can stop.`;
// Blocks per turn before the nudge lets the turn end without notes, so it can never loop.
const MAX_NUDGES = 2;
// The person's words that turn the nudge off and on; the last one said wins.
const NOTES_OFF = /no audit summary|skip the audit|don'?t do the audit|do not do the audit/i;
const NOTES_ON = /audit summary on|resume the audit/i;

const state = {
  enabled: true,
  // The session the history belongs to; a new id (start, resume, /clear) loads that session's saved turns.
  sessionId: null,
  current: null,
  // Every finished turn this session, oldest first; the card is the last. Lines are built at render
  // time so a late async agent's tokens still show.
  history: [],
  lastCostUsd: 0,
  // agentId → usage for this session, kept across turns because async agents can finish after the turn that started them.
  agentUsage: {},
  // "no audit summary" said this session, saved with the history so a resume keeps it.
  notesOff: false,
};

export function register(on) {
  on("session.start", async ($, e, next) => {
    const r = await next(e);
    await $.command.register({ name: "turncard", description: "Turn Card: show or hide the end-of-turn summary" });
    await $.command.register({ name: "turns", description: "Turn Card: list this session's turns, newest first" });
    return r;
  });

  on("command.run", { command: "turncard" }, ($, e) => {
    state.enabled = !state.enabled;
    $.ui.invalidate("ui.render");
    return { text: `Turn Card ${state.enabled ? "on" : "off"}` };
  });

  on("command.run", { command: "turns" }, async ($) => {
    await syncSession($);
    return { text: historyText(state.history, state.agentUsage) };
  });

  on("turn.start", async ($, e, next) => {
    if (!e.agentId) {
      await syncSession($);
      if (NOTES_OFF.test(e.text ?? "")) state.notesOff = true;
      if (NOTES_ON.test(e.text ?? "")) state.notesOff = false;
      state.current = { startedAt: Date.now(), calls: [], nudges: 0 };
    }
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

  on("classic.Stop", ($, e, next) => {
    const turn = state.current;
    if (!turn || state.notesOff || turn.nudges >= MAX_NUDGES || !needsNotes(turn.calls)) return next(e);
    turn.nudges++;
    return { block: NUDGE };
  });

  on("turn.complete", async ($, e, next) => {
    const r = await next(e);
    if (e.agentId) {
      state.agentUsage[e.agentId] = e.usage;
      $.ui.invalidate("ui.render");
      await saveHistory($);
      return r;
    }
    if (!state.current) return r;
    await finishTurn($, e);
    return r;
  });

  on("ui.render", { component: "AbovePrompt" }, ($, e, next) => {
    const card = state.history.at(-1);
    if (!state.enabled || !card || e.hasSurvey) return next(e);
    const { Box, Text } = $.ui.resolve(e);
    const lines = cardLines({ calls: card.calls, agentUsage: state.agentUsage }, card.end);
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
  const end = { number: state.history.length + 1, durationMs: Date.now() - turn.startedAt, usage: e.usage };
  try {
    const usage = await $.session.usage();
    if (usage?.cost?.usd !== undefined) {
      end.costUsd = usage.cost.usd - state.lastCostUsd;
      state.lastCostUsd = usage.cost.usd;
    }
    end.contextPercent = usage?.context?.percent;
    end.contextTokens = usage?.context?.tokens;
    end.contextWindow = usage?.context?.window;
  } catch { /* the card shows what the turn event carried */ }
  state.history.push({ calls: turn.calls, end });
  $.ui.invalidate("ui.render");
  await saveHistory($);
}

// Runs before each turn and /turns, since /clear and an in-session /resume switch the session id without
// firing session.start. `claude --resume` keeps a session's id, so its saved turns load back. The cost so
// far is the baseline, so the next card shows only its own turn.
async function syncSession($) {
  let id;
  try { id = await $.session.id(); } catch { return; }
  if (id === state.sessionId) return;
  state.sessionId = id;
  let saved;
  try { saved = await $.store.get(`turns:${id}`); } catch { /* start empty */ }
  state.history = saved?.history ?? [];
  state.agentUsage = saved?.agentUsage ?? {};
  state.notesOff = saved?.notesOff ?? false;
  try { state.lastCostUsd = (await $.session.usage())?.cost?.usd ?? 0; } catch { state.lastCostUsd = 0; }
}

// Re-setting moves the key to the end of the store's order, so the oldest sessions are pruned first.
// The store caps at 4 MiB, so a save that doesn't fit drops the oldest other session and tries again.
async function saveHistory($) {
  if (!state.sessionId) return;
  const key = `turns:${state.sessionId}`;
  try {
    const others = (await $.store.keys()).filter((k) => k !== key);
    const pruned = sessionKeysToPrune(others, SAVED_SESSIONS - 1);
    for (const old of pruned) await $.store.delete(old);
    const older = others.filter((k) => k.startsWith("turns:") && !pruned.includes(k));
    await $.store.delete(key);
    for (;;) {
      try {
        await $.store.set(key, { history: state.history, agentUsage: state.agentUsage, notesOff: state.notesOff });
        return;
      } catch (err) {
        if (!older.length) throw err;
        await $.store.delete(older.shift());
      }
    }
  } catch { /* the card works without the saved copy; the next turn saves again */ }
}
