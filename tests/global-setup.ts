import { execSync } from "node:child_process";

/** Applique les migrations sur la base de TEST (jamais la base de dev). Les tests vident ensuite les tables entre chaque cas. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:5432/upclose_test";
  if (!/test/i.test(url)) throw new Error("TEST_DATABASE_URL doit pointer vers une base dont le nom contient « test ».");
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
