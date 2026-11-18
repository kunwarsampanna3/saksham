// Creates .env.local for a fresh copy of Saksham (used by GitHub Codespaces, also fine on a laptop).
// - copies .env.example
// - fills SESSION_SECRET with a new random value
// - in a Codespace, sets APP_ORIGIN to the Codespace's forwarded https address
// Never overwrites an existing .env.local.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (existsSync(".env.local")) {
  console.log(".env.local already exists — left unchanged.");
  process.exit(0);
}

let env = readFileSync(".env.example", "utf8");
env = env.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${randomBytes(48).toString("base64url")}`);

const { CODESPACE_NAME, GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN } = process.env;
if (CODESPACE_NAME && GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) {
  const origin = `https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`;
  env = env.replace(/^APP_ORIGIN=.*$/m, `APP_ORIGIN=${origin}`);
  console.log(`Codespace detected — APP_ORIGIN=${origin}`);
}

writeFileSync(".env.local", env);
console.log("Created .env.local (demo mode on). Run: npm run dev");
