"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { handleAutocomplete, idle } = require("../src/commands");
test("buy command offers named ARVEE operations without needing old aliases", async () => {
  const buy = idle.toJSON().options.find((option) => option.name === "buy");
  assert.ok(buy.options.find((option) => option.name === "generator").autocomplete);
  let choices = [];
  const interaction = {
    isAutocomplete: () => true,
    commandName: "idle",
    options: { getFocused: () => ({ name: "generator", value: "Rookie" }) },
    respond: async (value) => { choices = value; }
  };
  assert.equal(await handleAutocomplete(interaction), true);
  assert.ok(choices.some((entry) => entry.name === "Rookie Adventurer" && entry.value === "MSPS"));
  assert.ok(choices.every((entry) => entry.name.length <= 100));
});
