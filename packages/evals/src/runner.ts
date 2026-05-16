import { createCompanyApi } from "@alpine/company-api";
import { evalFixtures, type EvalFixture } from "./index";

export interface EvalResult {
  id: string;
  passed: boolean;
  missingTools: string[];
  forbiddenToolsSeen: string[];
  missingLabels: string[];
  outcome: string;
}

export function runEvalFixtures(fixtures: EvalFixture[] = evalFixtures): EvalResult[] {
  return fixtures.map((fixture) => {
    const api = createCompanyApi();
    const replay = api.replayScenario(fixture.initialScenario);
    if (!replay.ok) return failedFixture(fixture, [replay.message]);

    const labels = replay.data.events.map((event) => event.label);
    const tools = replay.data.events.flatMap((event) => event.toolName ? [event.toolName] : []);
    const missingTools = fixture.expectedToolCalls.filter((toolName) => !tools.includes(toolName));
    const forbiddenToolsSeen = fixture.forbiddenToolCalls.filter((toolName) => tools.includes(toolName));
    const missingLabels = fixture.expectedEventLabels.filter((label) => !labels.includes(label));

    return {
      id: fixture.id,
      passed: !missingTools.length && !forbiddenToolsSeen.length && !missingLabels.length,
      missingTools,
      forbiddenToolsSeen,
      missingLabels,
      outcome: fixture.expectedOutcome
    };
  });
}

function failedFixture(fixture: EvalFixture, errors: string[]): EvalResult {
  return {
    id: fixture.id,
    passed: false,
    missingTools: errors,
    forbiddenToolsSeen: [],
    missingLabels: [],
    outcome: fixture.expectedOutcome
  };
}
