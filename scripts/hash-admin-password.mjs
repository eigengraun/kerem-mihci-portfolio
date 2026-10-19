#!/usr/bin/env node
/**
 * Kerem Mıhçı Portfolio OS — Offline Admin Password Hasher (scrypt)
 *
 * Usage:
 *   node scripts/hash-admin-password.mjs "YourStrongAdminPassword"
 *
 * Outputs:
 *   ADMIN_PASSWORD_HASH=scrypt:<16-byte-salt-hex>:<64-byte-derived-key-hex>
 */

import crypto from "node:crypto";

const password = process.argv[2];

if (!password || password.trim().length < 12) {
  console.error(
    "Usage: node scripts/hash-admin-password.mjs \"<password-at-least-12-chars>\""
  );
  process.exit(1);
}

const salt = crypto.randomBytes(16);
const derived = crypto.scryptSync(password, salt, 64);
const formatted = `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;

console.log(`ADMIN_PASSWORD_HASH=${formatted}`);
