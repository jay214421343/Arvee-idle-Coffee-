"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { byId, generators, recipes } = require("../src/catalog");
const { dec, purchaseCost, settle, generatorRate, prestigeMultiplier, pretty, magnitudeSuffix } = require("../src/economy");
test("ARVEE operation catalogue retains stable database IDs", () => {
  assert.ok(generators.length > 20);
  assert.equal(byId.size, generators.length);
  assert.ok(byId.has("MSPS"));
});
test("generator prices grow by ownership and quantity", () => {
  const one = purchaseCost("100", 0, 1);
  assert.equal(one.toString(), "100");
  assert.ok(purchaseCost("100", 1, 1).gt(one));
  assert.ok(purchaseCost("100", 0, 2).gt(one));
  assert.throws(() => purchaseCost("100", 0, -1));
  assert.throws(() => purchaseCost("100", 0, 1001));
});
test("large IC amounts stay precise", () => {
  const huge = dec("1e230");
  assert.equal(huge.plus(1).minus(huge).toString(), "1");
  assert.ok(pretty(huge).length < 20);
});
test("passive IC settles whole seconds without losing fractional time", () => {
  const start = new Date("2026-01-01T00:00:00.100Z");
  const first = settle("10", "10", "3", start, new Date("2026-01-01T00:00:02.650Z"));
  assert.equal(first.earned.toString(), "6");
  assert.equal(first.balance.toString(), "16");
  assert.equal(first.settledAt.toISOString(), "2026-01-01T00:00:02.100Z");
  const second = settle(first.balance, first.totalEarned, "3", first.settledAt, new Date("2026-01-01T00:00:03.050Z"));
  assert.equal(second.earned.toString(), "0");
  assert.equal(second.settledAt.toISOString(), first.settledAt.toISOString());
});
test("generators and prestige multiply income", () => {
  assert.equal(generatorRate([{ generator_id: "MSPS", quantity: 4 }], 0).toString(), "4");
  assert.equal(generatorRate([{ generator_id: "MSPS", quantity: 4 }], 2).toString(), "6");
  assert.equal(prestigeMultiplier(3).toString(), "1.75");
});
test("crafting recipes refer to defined items", () => {
  const { items } = require("../src/catalog");
  for (const [id, ingredients] of Object.entries(recipes)) {
    assert.ok(items[id]);
    for (const [part, amount] of Object.entries(ingredients)) {
      assert.ok(items[part]);
      assert.ok(amount > 0);
    }
  }
});

test("all large numbers display compact prefixes instead of e+ notation", () => {
  const cases = [
    ["0", "0"], ["999", "999"], ["1000", "1K"], ["1234567", "1.23M"],
    ["1e9", "1B"], ["1e12", "1T"], ["1e30", "1No"],
    ["1e33", "1aa"], ["1e36", "1ab"], ["1e108", "1az"],
    ["3.29e222", "3.29cl"], ["-3.29e222", "-3.29cl"],
    ["1e2061", "1aaa"], ["1e2100", "1aan"]
  ];
  for (const [input, expected] of cases) assert.equal(pretty(input), expected, input);
  assert.equal(magnitudeSuffix(74), "cl");
  assert.equal(magnitudeSuffix(11), "aa");
  assert.throws(() => magnitudeSuffix(0), /Invalid magnitude/);
});
test("all operation costs, incomes and prices use readable suffixes", () => {
  for (const g of generators) {
    for (const amount of [g.cost, g.income, purchaseCost(g.cost, 100, 1)]) {
      const displayed = pretty(amount);
      assert.ok(displayed.length < 25, "oversized display: " + g.id);
      assert.doesNotMatch(displayed, /e[+-]?[0-9]+/i, "scientific notation: " + g.id);
      assert.match(displayed, /^-?[0-9]+(?:\.[0-9]+)?[A-Za-z]*$/);
    }
  }
});
