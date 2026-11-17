"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { idle } = require("../src/commands");
const brand = require("../src/brand");
const config = require("../src/config");
const { generators } = require("../src/catalog");
const ecosystem = require("../ecosystem.config.cjs");
const ui = require("../src/ui");
test("ARVEE Idle branding and slash command are separate from main ARVEE", () => {
  assert.equal(brand.name, "ARVEE Idle");
  assert.equal(brand.command, "idle");
  assert.equal(brand.currency, "IC");
  assert.equal(idle.toJSON().name, "idle");
  assert.equal(generators.length, 56);
  assert.ok(generators.every((g) => g.description.length >= 45 && g.description.length <= 180));
  assert.equal(new Set(generators.map((g) => g.description)).size, generators.length);
});
test("PM2 uses the explicit Node runtime and only one isolated fork process", () => {
  assert.equal(ecosystem.apps.length, 1);
  const app = ecosystem.apps[0];
  assert.equal(app.name, "arvee-idle");
  assert.equal(app.cwd, config.projectRoot);
  assert.equal(app.instances, 1);
  assert.equal(app.exec_mode, "fork");
  assert.equal(app.watch, false);
  assert.ok(app.interpreter.endsWith("/arvee/.runtime/node-v22.23.5-darwin-x64/bin/node"));
  assert.ok(app.wait_ready);
});
test("refuse ARVEE main databases, accept a dedicated idle database", () => {
  const previous = process.env.DATABASE_URL;
  try {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/arvee_hub";
    assert.throws(() => config.validateDatabaseUrl(), /Refusing/);
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/arvee_game";
    assert.throws(() => config.validateDatabaseUrl(), /Refusing/);
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/arvee_idle";
    assert.equal(config.validateDatabaseUrl().database, "arvee_idle");
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});
test("UI component IDs are namespaced and new home shows ARVEE branding", () => {
  const id = ui.custom("123456789012345678", "shop", "1");
  assert.ok(id.startsWith("ai:2:"));
  const p = {
    balance: require("../src/economy").dec("100"), totalEarned: require("../src/economy").dec("100"),
    rate: require("../src/economy").dec("1"), prestige: 0, mineXp: 0, generators: []
  };
  const view = ui.home("123456789012345678", {
    username: "Adventurer", displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
  }, p);
  const serialized = JSON.stringify(view.toJSON());
  assert.match(serialized, /ARVEE IDLE/);
  assert.match(serialized, /IC/);
  assert.match(serialized, /arvee.world/);
});
test("command registration does not bulk-overwrite other slash commands", () => {
  const code = fs.readFileSync(require("node:path").join(config.projectRoot, "src/register.js"), "utf8");
  assert.match(code, /rest\.post\(/);
  assert.doesNotMatch(code, /rest\.put\(/);
});
