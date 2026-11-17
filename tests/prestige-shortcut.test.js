"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { dec } = require("../src/economy");
const store = require("../src/store");
const ui = require("../src/ui");
const { handleComponent } = require("../src/commands");
const owner = "123456789012345678";
test("prestige shortcut opens the existing confirmation view without prestiging", async () => {
  const originalProfile = store.profile, originalPrestige = store.prestige;
  let reads = 0, writes = 0, updated = null, deferred = false;
  store.profile = async (id) => {
    reads++;
    assert.equal(id, owner);
    return { balance: dec("1000000000"), prestige: 4 };
  };
  store.prestige = async () => { writes++; throw new Error("No prestige should occur on preview"); };
  try {
    const interaction = {
      customId: ui.custom(owner, "prestige"), user: { id: owner },
      isButton: () => true, isStringSelectMenu: () => false,
      deferUpdate: async () => { deferred = true; },
      editReply: async (payload) => { updated = payload; },
      followUp: async () => { throw new Error("No failure expected"); }
    };
    assert.equal(await handleComponent(interaction), true);
    assert.equal(deferred, true);
    assert.equal(reads, 1);
    assert.equal(writes, 0);
    const view = updated.components[0].toJSON();
    assert.match(JSON.stringify(view), /Confirm prestige/);
    assert.match(JSON.stringify(view), /ai:2:123456789012345678:prestige_confirm:/);
    assert.equal(view.type, 17);
  } finally {
    store.profile = originalProfile;
    store.prestige = originalPrestige;
  }
});
