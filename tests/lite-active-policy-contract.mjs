import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const targets = process.argv.slice(2).map((target) => resolve(target));

assert.ok(
  targets.length >= 3,
  "usage: node tests/lite-active-policy-contract.mjs <omo-bridge> <topology-memory> <multi-perspective-skill>",
);

const documents = targets.map((target) => ({
  target,
  content: readFileSync(target, "utf8"),
}));
const combined = documents.map(({ content }) => content).join("\n");

const perTargetSemantics = [
  [
    "One capable agent is the default.",
    "Select only the workflow stages that materially improve the result.",
    "When substantial work directly matches an available skill, load that skill as a reference before acting.",
    "Loading a skill means consulting its guidance, not following every step verbatim.",
    "Start with at most one primary workflow skill. Load another only when the task enters a distinct phase or a separate risk boundary requires it.",
  ],
  [
    "Multi-perspective consultation is opt-in by ambiguity, stakes, or explicit user request.",
    "One capable agent is the default.",
    "Use additional model perspectives only when independent judgment could materially change the conclusion.",
    "Use two perspectives when disagreement would be informative; use three only for high-stakes unresolved decisions.",
  ],
  [
    "Multi-perspective consultation is opt-in by ambiguity, stakes, or explicit user request.",
    "One capable agent is the default.",
    "Use two perspectives when disagreement would be informative; use three only for high-stakes unresolved decisions.",
  ],
];

for (const [index, expectedSemantics] of perTargetSemantics.entries()) {
  const { target, content } = documents[index];
  for (const expected of expectedSemantics) {
    assert.ok(content.includes(expected), `${target}: active policy missing: ${expected}`);
  }
}

for (const forbidden of [
  "Multi-perspective consultation is the default thinking mode",
  "Default-on multi-lens consultation",
  "When to Use (default-on)",
  "multi-perspective consultation is the default",
  "Single-shotting nontrivial questions wastes",
  "**Default on.**",
  "Single-shotting nontrivial design / investigation / research is exactly the wasted-diversity pattern",
]) {
  assert.ok(!combined.includes(forbidden), `active policy retained: ${forbidden}`);
}

console.log(JSON.stringify({ ok: true, targets }, null, 2));
