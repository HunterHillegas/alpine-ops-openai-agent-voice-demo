import { createCompanyApi } from "@alpine/company-api";
import type { CompanyState } from "@alpine/mock-data";
import { evalFixtures, type EvalFixture } from "./index";

export interface EvalResult {
  id: string;
  passed: boolean;
  missingTools: string[];
  forbiddenToolsSeen: string[];
  missingLabels: string[];
  stateErrors: string[];
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
  const countedTools = replay.data.events.filter((event) => event.type === "tool_call").flatMap((event) => event.toolName ? [event.toolName] : []);
  const toolCountErrors = toolCountExpectationErrors(fixture, countedTools);
  const missingLabels = fixture.expectedEventLabels.filter((label) => !labels.includes(label));
  const stateErrors = stateExpectationErrors(fixture, replay.data);

  return {
    id: fixture.id,
    passed: !missingTools.length && !forbiddenToolsSeen.length && !toolCountErrors.length && !missingLabels.length && !stateErrors.length,
    missingTools: [...missingTools, ...toolCountErrors],
      forbiddenToolsSeen,
      missingLabels,
      stateErrors,
      outcome: fixture.expectedOutcome
    };
  });
}

function toolCountExpectationErrors(fixture: EvalFixture, tools: string[]): string[] {
  return Object.entries(fixture.expectedToolCounts ?? {}).flatMap(([toolName, expectedCount]) => {
    const actualCount = tools.filter((item) => item === toolName).length;
    return actualCount === expectedCount ? [] : [`expected ${toolName} ${expectedCount} time(s), saw ${actualCount}`];
  });
}

function stateExpectationErrors(fixture: EvalFixture, state: CompanyState): string[] {
  const errors: string[] = [];
  const expected = fixture.expectedState;
  if (state.workOrders.length !== expected.workOrderCount) {
    errors.push(`expected ${expected.workOrderCount} work order(s), saw ${state.workOrders.length}`);
  }

  const pendingApprovalActions = state.approvals.filter((approval) => approval.status === "pending").map((approval) => approval.action);
  if (JSON.stringify(pendingApprovalActions) !== JSON.stringify(expected.pendingApprovalActions)) {
    errors.push(`expected pending approvals ${expected.pendingApprovalActions.join(",") || "none"}, saw ${pendingApprovalActions.join(",") || "none"}`);
  }

  if (expected.approvedApprovalActions) {
    const approvedApprovalActions = state.approvals.filter((approval) => approval.status === "approved").map((approval) => approval.action).reverse();
    if (JSON.stringify(approvedApprovalActions) !== JSON.stringify(expected.approvedApprovalActions)) {
      errors.push(`expected approved approvals ${expected.approvedApprovalActions.join(",") || "none"}, saw ${approvedApprovalActions.join(",") || "none"}`);
    }
  }

  if (expected.caseSummaryCount !== undefined && state.caseSummaries.length !== expected.caseSummaryCount) {
    errors.push(`expected ${expected.caseSummaryCount} case summary record(s), saw ${state.caseSummaries.length}`);
  }

  if (expected.customerMessageCount !== undefined && state.customerMessages.length !== expected.customerMessageCount) {
    errors.push(`expected ${expected.customerMessageCount} customer message record(s), saw ${state.customerMessages.length}`);
  }

  if (expected.customerMessageStatuses) {
    const statuses = state.customerMessages.map((message) => message.status).sort();
    const expectedStatuses = [...expected.customerMessageStatuses].sort();
    if (JSON.stringify(statuses) !== JSON.stringify(expectedStatuses)) {
      errors.push(`expected customer message statuses ${expectedStatuses.join(",") || "none"}, saw ${statuses.join(",") || "none"}`);
    }
  }

  for (const [ticketId, status] of Object.entries(expected.ticketStatuses ?? {})) {
    const ticket = state.tickets.find((item) => item.ticketId === ticketId);
    if (ticket?.status !== status) errors.push(`expected ${ticketId} status ${status}, saw ${ticket?.status ?? "missing"}`);
  }

  for (const [partId, quantity] of Object.entries(expected.inventoryQuantities ?? {})) {
    const part = state.inventory.find((item) => item.partId === partId);
    if (part?.quantity !== quantity) errors.push(`expected ${partId} quantity ${quantity}, saw ${part?.quantity ?? "missing"}`);
  }

  return errors;
}

function failedFixture(fixture: EvalFixture, errors: string[]): EvalResult {
  return {
    id: fixture.id,
    passed: false,
    missingTools: errors,
    forbiddenToolsSeen: [],
    missingLabels: [],
    stateErrors: [],
    outcome: fixture.expectedOutcome
  };
}
