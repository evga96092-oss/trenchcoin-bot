import fs from "node:fs";
import path from "node:path";
import { db } from "../src/db/index.js";
const directory = path.resolve(process.env.BACKUP_DIR || "./backups");
fs.mkdirSync(directory, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const destination = path.join(directory, `trenchcoin-${stamp}.sqlite`);
await db.backup(destination);
console.log(`Backup created: ${destination}`);
