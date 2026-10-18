import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "../hooks/turncard.mjs";

// The mod's hooks driven by a fake `$`: an in-memory store and a session id the test switches.
const hooks = [];
register((event, matcher, hook) => hooks.push({ event, matcher: hook ? matcher : {}, hook: hook ?? matcher }));
const fire = (event, e, next = async () => ({})) => {
  const h = hooks.find((x) => x.event === event && Object.entries(x.matcher).every(([k, v]) => e[k] === v));
  return h.hook($, e, next);
};

let sessionId = "A";
const store = new Map();
const $ = {
  session: {
    id: async () => sessionId,
    usage: async () => ({ cost: { usd: 0 }, context: {} }),
  },
  store: {
    get: async (k) => store.get(k),
    set: async (k, v) => { store.set(k, JSON.parse(JSON.stringify(v))); },
    delete: async (k) => { store.delete(k); },
    keys: async () => [...store.keys()],
  },
  ui: { invalidate: () => {} },
};

async function turn({ agentId } = {}) {
  await fire("turn.start", {});
  if (agentId) {
    await fire("tool.call", { tool: "Agent", subagent_type: "Explore" }, async () => ({ result: { agentId } }));
    await fire("turn.complete", { agentId, usage: { input_tokens: 1, output_tokens: 1 } });
  }
  await fire("turn.complete", { usage: { input_tokens: 5, output_tokens: 7 } });
}

test("history is saved per session, comes back on resume, and agent usage stays with its session", async () => {
  await turn({ agentId: "a1" });
  sessionId = "B";
  await turn();
  assert.deepEqual(store.get("turns:B").agentUsage, {});
  assert.equal(store.get("turns:B").history.length, 1);

  sessionId = "A";
  const { text } = await fire("command.run", { command: "turns" });
  assert.match(text, /^Turn 1 · /);
  assert.match(text, /Explore \(2\)/);
  await turn();
  assert.equal(store.get("turns:A").history.at(-1).end.number, 2);
});

test("a full store drops the oldest other sessions until the save fits", async () => {
  store.clear();
  store.set("turns:old1", { history: [] });
  store.set("turns:old2", { history: [] });
  const set = $.store.set;
  // Pretends the size cap is two keys.
  $.store.set = async (k, v) => { if (store.size >= 2) throw new Error("store over 4 MiB"); return set(k, v); };
  sessionId = "C";
  await turn();
  $.store.set = set;
  assert.deepEqual([...store.keys()], ["turns:old2", "turns:C"]);
});

const stop = () => fire("classic.Stop", { stop_hook_active: false }, async () => ({}));
const call = (tool, extra = {}) => fire("tool.call", { tool, ...extra });

test("the nudge blocks a stop after a skill or agent with no notes, and passes once notes are given", async () => {
  sessionId = "N";
  await fire("turn.start", { text: "go" });
  await call("Skill", { skill: "output-prove-it" });
  assert.match((await stop()).block, /audit-session-summary/);
  await call("Skill", { skill: "audit-session-summary", args: "output-prove-it: green" });
  assert.equal((await stop()).block, undefined);
  await fire("turn.complete", { usage: {} });

  await fire("turn.start", { text: "again" });
  await call("Agent", { subagent_type: "Explore" });
  assert.ok((await stop()).block);
  await fire("turn.complete", { usage: {} });
});

test("the nudge leaves plain turns alone and gives up after two blocks", async () => {
  await fire("turn.start", { text: "plain" });
  await call("Bash");
  assert.equal((await stop()).block, undefined);
  await fire("turn.complete", { usage: {} });

  await fire("turn.start", { text: "stubborn" });
  await call("Skill", { skill: "output-prove-it" });
  assert.ok((await stop()).block);
  assert.ok((await stop()).block);
  assert.equal((await stop()).block, undefined);
  await fire("turn.complete", { usage: {} });
});

test("'no audit summary' turns the nudge off until 'audit summary on'", async () => {
  await fire("turn.start", { text: "no audit summary for now" });
  await call("Skill", { skill: "output-prove-it" });
  assert.equal((await stop()).block, undefined);
  await fire("turn.complete", { usage: {} });

  await fire("turn.start", { text: "ok, audit summary on" });
  await call("Skill", { skill: "output-prove-it" });
  assert.ok((await stop()).block);
  await fire("turn.complete", { usage: {} });
});
