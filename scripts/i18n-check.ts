// Lists t("…") literals in src/ that have no English translation.
// Usage: npm run i18n:check
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { en, enPatterns } from "../src/lib/i18n/en";

const known = (k: string) => k in en || enPatterns.some(([re]) => re.test(k));
const files: string[] = [];
(function walk(d: string) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f) && !p.includes("i18n")) files.push(p);
  }
})("src");

const re = /\bt\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g;
const missing = new Set<string>();
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(re)) {
    const key = m[2].replace(/\\(["'`])/g, "$1");
    if (m[1] === "`" && key.includes("${")) continue;
    if (!known(key) && /[a-zA-Zàâçéèêëîïôûùüÿœ]/.test(key)) missing.add(`${f}: ${key}`);
  }
}
for (const k of missing) console.log(k);
console.log(`${missing.size} missing`);
process.exit(missing.size ? 1 : 0);
