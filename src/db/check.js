import { db } from "./index.js";

const tables = db.prepare(`
  SELECT name FROM sqlite_master
  WHERE type = 'table'
  ORDER BY name
`).all();

console.log(`SQLite ready: ${tables.map((row) => row.name).join(", ")}`);
