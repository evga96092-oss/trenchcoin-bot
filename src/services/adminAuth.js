import crypto from "node:crypto";
import { config } from "../config.js";

export function isAdminAuthorized(header = "") {
  if (!config.adminApiToken || !header.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(config.adminApiToken);
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

export function requireAdmin(req, res, next) {
  if (!isAdminAuthorized(req.headers.authorization || "")) return res.status(401).json({ error: "admin_unauthorized" });
  res.setHeader("Cache-Control", "no-store");
  return next();
}
