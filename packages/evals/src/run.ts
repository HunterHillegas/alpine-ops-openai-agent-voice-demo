import { runEvalFixtures } from "./runner";

const results = runEvalFixtures();
const passed = results.filter((result) => result.passed).length;
const report = {
  passed,
  failed: results.length - passed,
  total: results.length,
  results
};

console.log(JSON.stringify(report, null, 2));
if (report.failed > 0) process.exitCode = 1;
