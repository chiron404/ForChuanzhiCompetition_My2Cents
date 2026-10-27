import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const source = readFileSync("src/lib/sample.ts", "utf8");
mkdirSync("public/samples", { recursive: true });
for (const [key, name] of [
  ["SAMPLE_TEXT", "校园二手交易平台-V2.0.md"],
  ["CONFLICT_TEXT", "校园二手交易平台-V2.1.md"],
]) {
  const match = source.match(
    new RegExp("export const " + key + " = `([\\s\\S]*?)`;"),
  );
  if (!match) throw new Error("Missing sample " + key);
  writeFileSync("public/samples/" + name, match[1], "utf8");
}
