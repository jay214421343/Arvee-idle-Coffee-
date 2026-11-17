"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { dec } = require("../src/economy");
const store = require("../src/store");
const { respond, handleComponent } = require("../src/commands");
const ui = require("../src/ui");
const owner = "123456789012345678";
function purchase() {
  return { quantity: 10, generator: { id: "MSPS", name: "Field Crew" },
    cost: dec("1200"), balance: dec("800"), rate: dec("14") };
}
function slash(command, more = {}) {
  const out = { deferred: false, payload: null };
  return { out, interaction: {
    user: { id: owner }, commandName: "idle", isChatInputCommand: () => true,
    options: {
      getSubcommandGroup: () => null, getSubcommand: () => command,
      getString: () => "MSPS", getInteger: () => 10,
      getBoolean: (name) => name === "confirm" ? true : null
    },
    deferReply: async () => { out.deferred = true; },
    editReply: async (payload) => { out.payload = payload; },
    ...more
  } };
}
function component(action, arg = "") {
  const out = { deferred: false, payload: null };
  return { out, interaction: {
    user: { id: owner }, customId: ui.custom(owner, action, arg),
    isButton: () => true, isStringSelectMenu: () => false,
    deferUpdate: async () => { out.deferred = true; },
    editReply: async (payload) => { out.payload = payload; },
    followUp: async () => { throw new Error("Unexpected error follow-up"); }
  } };
}
function content(payload) {
  return JSON.stringify(payload.components[0].toJSON());
}
test("recruitment routes show the same completed, two-action receipt", async () => {
  const old = store.buyGenerator;
  let calls = 0;
  store.buyGenerator = async (userId, generator, quantity) => {
    calls++;
    assert.equal(userId, owner);
    assert.equal(generator, "MSPS");
    assert.equal(quantity, 10);
    return purchase();
  };
  try {
    const s = slash("buy");
    await respond(s.interaction);
    assert.equal(s.out.deferred, true);
    assert.match(content(s.out.payload), /OPERATIONS.*RECRUITED/);
    const b = component("buy_ten", "MSPS");
    await handleComponent(b.interaction);
    assert.equal(b.out.deferred, true);
    assert.match(content(b.out.payload), /OPERATIONS.*RECRUITED/);
    assert.match(content(b.out.payload), /1.2K IC/);
    assert.equal(calls, 2);
    assert.equal(s.out.payload.components[0].toJSON().type, 17);
  } finally {
    store.buyGenerator = old;
  }
});
test("prestige routes show the same saved level and multiplier receipt", async () => {
  const old = store.prestige;
  let calls = 0;
  store.prestige = async (userId) => {
    calls++;
    assert.equal(userId, owner);
    return { prestige: 4, multiplier: dec("2.25") };
  };
  try {
    const s = slash("prestige");
    await respond(s.interaction);
    assert.match(content(s.out.payload), /PRESTIGE.*COMPLETE/);
    assert.match(content(s.out.payload), /2.25×/);
    const b = component("prestige_confirm");
    await handleComponent(b.interaction);
    assert.match(content(b.out.payload), /PRESTIGE.*COMPLETE/);
    assert.equal(calls, 2);
  } finally {
    store.prestige = old;
  }
});
