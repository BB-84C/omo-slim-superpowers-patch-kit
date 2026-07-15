import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const defaultBridge = resolve(repoRoot, "prompt-bridges", "orchestrator_append.md");
const bridgePaths = process.argv.slice(2);
const targets = bridgePaths.length > 0
  ? bridgePaths.map((bridgePath) => resolve(bridgePath))
  : [defaultBridge];

const requiredSemantics = [
  "Select only the workflow stages that materially improve the result.",
  "When substantial work directly matches an available skill, load that skill as a reference before acting.",
  "Loading a skill means consulting its guidance, not following every step verbatim. Apply the parts relevant to the task; exact step-by-step execution is not mandatory unless the skill explicitly marks a safety, permission, or verification gate as binding.",
  "Start with at most one primary workflow skill. Load another only when the task enters a distinct phase or a separate risk boundary requires it.",
  "One capable agent is the default.",
  "Use additional model perspectives only when independent judgment could materially change the conclusion.",
  "Use two perspectives when disagreement would be informative; use three only for high-stakes unresolved decisions.",
  "Do not add review loops that cannot change the outcome.",
  "permission gates for external or irreversible actions",
  "semantic verification for substantive claims",
  "integration review where failure risk justifies it",
  "Best-of-N is opt-in",
  "Lead user-facing updates with the product or operational outcome",
];

const forbiddenPressure = [
  "Using one model when several are available is wasted diversity.",
  "Preserve the Superpowers order:",
  "Do not skip review loops to save time.",
  "DEFAULT ON",
  "N is proportional to stakes",
  "defaults to the multi-perspective-consultation",
  "[override→",
];

for (const target of targets) {
  const prompt = readFileSync(target, "utf8");

  for (const expected of requiredSemantics) {
    assert.ok(
      prompt.includes(expected),
      `${target}: missing Lite semantic: ${expected}`,
    );
  }

  for (const forbidden of forbiddenPressure) {
    assert.ok(
      !prompt.includes(forbidden),
      `${target}: retained stock pressure phrase: ${forbidden}`,
    );
  }
}

console.log(JSON.stringify({ ok: true, targets }, null, 2));
