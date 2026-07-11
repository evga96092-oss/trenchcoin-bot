import Database from "better-sqlite3";
const file = process.argv[2];
if (!file) throw new Error("Usage: npm run restore:validate -- <backup.sqlite>");
const db = new Database(file, { readonly: true });
const integrity = db.pragma("integrity_check", { simple: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((row) => row.name);
db.close();
if (integrity !== "ok") throw new Error(`Backup integrity failed: ${integrity}`);
console.log(JSON.stringify({ valid: true, tables }));
