import { db } from "../src/db/index.js";
const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get();
const rows = exists ? db.prepare("SELECT version,name,applied_at FROM schema_migrations ORDER BY version").all() : [];
console.log(JSON.stringify({ initialized: Boolean(exists), applied: rows }, null, 2));
