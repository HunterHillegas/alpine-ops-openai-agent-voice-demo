const missing: string[] = [];

if (!process.env.OPENAI_API_KEY) missing.push("OPENAI_API_KEY");

if (missing.length) {
  console.error(`Live voice verification requires ${missing.join(", ")}.`);
  console.error("Run with a real key: OPENAI_API_KEY=sk-... npm run test:live");
  process.exit(1);
}

console.log("Live voice preflight passed: OPENAI_API_KEY is present.");
