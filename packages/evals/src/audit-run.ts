import { runCompletionAudit } from "./audit";

const strict = process.argv.includes("--strict");
const audit = runCompletionAudit();

console.log(JSON.stringify(audit, null, 2));
if (strict && audit.status !== "passed") process.exitCode = 1;
