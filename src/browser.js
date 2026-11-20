"use strict";
const crypto = require("node:crypto");
const { idle, respond, handleComponent } = require("./commands");
const { routeTutorial } = require("./tutorial-router");

function invalid(message = "Choose an action from your current Idle screen.") { throw Object.assign(new Error(message), { status: 400 }); }
function plain(value) { return JSON.parse(JSON.stringify(value)); }
function commandOptions(input) {
  const root = idle.toJSON();
  let definitions = root.options, selected;
  if (input.group != null) {
    const group = definitions.find(option => option.type === 2 && option.name === input.group);
    if (!group) invalid();
    definitions = group.options;
  }
  selected = definitions.find(option => option.type === 1 && option.name === input.command);
  if (!selected) invalid();
  const values = input.options || {};
  if (typeof values !== "object" || Array.isArray(values) || values === null) invalid();
  const fields = selected.options || [];
  if (Object.keys(values).some(key => !fields.some(field => field.name === key))) invalid();
  for (const field of fields) {
    const value = values[field.name];
    if (value == null) { if (field.required) invalid(`Provide ${field.name}.`); continue; }
    if (field.type === 3 && (typeof value !== "string" || value.length > (field.max_length || 200) || value.length < (field.min_length || 1))) invalid();
    if (field.type === 4 && (!Number.isSafeInteger(value) || value < (field.min_value ?? 0) || value > (field.max_value ?? 1000000))) invalid();
    if (field.type === 5 && typeof value !== "boolean") invalid();
    if (field.type === 6 && (typeof value !== "string" || !/^[0-9]{15,22}$/.test(value))) invalid();
    if (field.choices && !field.choices.some(choice => choice.value === value)) invalid();
  }
  const get = (name, required = false) => { const value = values[name] ?? null; if (required && value === null) invalid(`Provide ${name}.`); return value; };
  return {
    getSubcommandGroup: () => input.group || null, getSubcommand: () => input.command,
    getString: get, getInteger: get, getBoolean: get,
    getUser: (name, required) => { const id = get(name,required); return id ? { id, username: "Adventurer", bot: false, displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png" } : null; }
  };
}
function validate(input, userId) {
  if (!input || typeof input !== "object" || Array.isArray(input)) invalid();
  if (Object.keys(input).some(key => !["kind","command","group","options","customId","values"].includes(key))) invalid();
  if (input.kind === "command") return commandOptions(input);
  if (!["button","select"].includes(input.kind) || typeof input.customId !== "string" || input.customId.length > 100) invalid();
  const parts = input.customId.split(":");
  if (parts.length !== 5 || parts[0] !== "ai" || parts[1] !== "2" || parts[2] !== userId || !/^[a-z_]+$/.test(parts[3]) || !/^[a-zA-Z0-9_]*$/.test(parts[4])) invalid();
  if (input.kind === "select" && (!Array.isArray(input.values) || input.values.length !== 1 || typeof input.values[0] !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(input.values[0]))) invalid();
  return null;
}
async function run(user, input, handlers = { respond, handleComponent, routeTutorial }) {
  const options = validate(input, user.id);
  let output = null;
  const notices = [];
  const interaction = {
    user: { id: user.id, username: user.username, bot: false, displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png" },
    commandName: "idle", options, customId: input.customId, values: input.values || [],
    deferred: false, replied: false,
    isChatInputCommand: () => input.kind === "command", isAutocomplete: () => false,
    isButton: () => input.kind === "button", isStringSelectMenu: () => input.kind === "select",
    async deferReply() { this.deferred = true; }, async deferUpdate() { this.deferred = true; },
    async editReply(payload) { output = plain(payload); this.replied = true; },
    async reply(payload) { output = plain(payload); this.replied = true; },
    async followUp(payload) { notices.push(String(payload.content || "Action unavailable.")); }
  };
  if (input.kind === "command") await handlers.routeTutorial(interaction,handlers.respond);
  else await handlers.handleComponent(interaction);
  if (!output && !notices.length) invalid();
  return { view: output, notices };
}
async function execute(pool, user, input, requestId, runner = run) {
  validate(input,user.id);
  // Reserve before dispatch. A crash leaves an uncertain receipt, never an automatic
  // replay of a trade, prestige or consumable. Completed responses replay verbatim.
  const match = /^([a-z0-9]{8,12})\.([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/.exec(requestId || "");
  const issuedAt = match ? Number.parseInt(match[1],36) : 0;
  if (!match || issuedAt < Date.now()-86400000 || issuedAt > Date.now()+300000) invalid("Refresh and try again with a new action. Check your device clock if this continues.");
  const digest = crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const inserted = await pool.query("INSERT INTO browser_actions(user_id,request_id,input_hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING request_id", [user.id,requestId,digest]);
  if (!inserted.rowCount) {
    const row = (await pool.query("SELECT input_hash,response FROM browser_actions WHERE user_id=$1 AND request_id=$2",[user.id,requestId])).rows[0];
    if (row.input_hash !== digest) invalid("That action ID was already used for another action.");
    if (!row.response) throw Object.assign(new Error("This action is processing or its result is uncertain. Refresh your profile before doing it again."), {status:409});
    return row.response;
  }
  let result;
  try { result = await runner(user,input); }
  catch { result = { view:null,notices:["The action could not be completed. Refresh your profile before trying again."] }; }
  await pool.query("UPDATE browser_actions SET response=$3::jsonb WHERE user_id=$1 AND request_id=$2",[user.id,requestId,JSON.stringify(result)]);
  return result;
}
module.exports = { commandOptions, validate, run, execute };
