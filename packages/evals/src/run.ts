import { runEvalFixtures } from "./runner";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const results = runEvalFixtures();
const passed = results.filter((result) => result.passed).length;
const report = {
  generatedAt: new Date().toISOString(),
  passed,
  failed: results.length - passed,
  total: results.length,
  results
};
const resultsPath = resolve("packages/evals/results/latest.json");

mkdirSync(dirname(resultsPath), { recursive: true });
writeFileSync(resultsPath, JSON.stringify(report, null, 2) + "\\n");

console.log(JSON.stringify(report, null, 2));
console.error("Wrote " + resultsPath);
if (report.failed > 0) process.exitCode = 1;
