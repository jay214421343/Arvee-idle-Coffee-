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

test("item choices support more than 25 items with searchable autocomplete", async () => {
  const cmd = idle.toJSON();
  const give = cmd.options.find((option) => option.name === "give");
  const sell = cmd.options.find((option) => option.name === "market")
    .options.find((option) => option.name === "sell");
  assert.equal(give.options.find((option) => option.name === "item").autocomplete, true);
  assert.equal(sell.options.find((option) => option.name === "item").autocomplete, true);
  let values = [];
  const interaction = {
    isAutocomplete: () => true, commandName: "idle",
    options: { getFocused: () => ({ name: "item", value: "Companion" }) },
    respond: async (choices) => { values = choices; }
  };
  assert.equal(await handleAutocomplete(interaction),true);
  assert.ok(values.some((item) => item.value === "companion_egg" && item.name === "Companion Egg"));
  assert.ok(values.every((item) => item.name.length <= 100));
  interaction.options.getFocused = () => ({ name: "item", value: "" });
  await handleAutocomplete(interaction);
  assert.ok(values.length <= 25, "Discord autocomplete choices must fit the limit");
});
