"use strict";
require("dotenv").config();
const fs = require("node:fs/promises");
const path = require("node:path");
const { pool } = require("./store");
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL first.");
  const sql = await fs.readFile(path.join(__dirname, "schema.sql"), "utf8");
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query(sql);
    await db.query("COMMIT");
    console.log("[Coffee] PostgreSQL schema ready");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
    await pool.end();
  }
}
main().catch(async (error) => { console.error(error); await pool.end().catch(console.error); process.exitCode = 1; });
