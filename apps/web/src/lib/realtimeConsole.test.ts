import { describe, expect, it } from "vitest";
import { approvalForModel, bindRealtimeSessionEvents, buildAlpineRealtimeAgent, extractClientSecret, type RealtimeConsoleCallbacks } from "./realtimeConsole";

describe("realtime console integration", () => {
  it("builds the triage agent with specialist handoffs and core tools", () => {
    const agent = buildAlpineRealtimeAgent();

    expect(agent.name).toBe("Realtime Triage Agent");
    expect(agent.handoffs.map((handoff) => ("agentName" in handoff ? handoff.agentName : handoff.name))).toEqual([
      "Customer Context Agent",
      "Diagnostics Agent",
      "Dispatch Agent",
      "Policy and Billing Agent",
      "Message Composer Agent"
    ]);
    expect(agent.tools.map((tool) => tool.name)).toEqual(["waitForMoreAudio", "getAsset", "requestHumanApproval"]);
  });

  it("exposes write tools only on bounded specialists with approval-token parameters", () => {
    const agent = buildAlpineRealtimeAgent();
    const customer = agent.handoffs.find((handoff) => ("agentName" in handoff ? handoff.agentName : handoff.name) === "Customer Context Agent");
    const dispatch = agent.handoffs.find((handoff) => ("agentName" in handoff ? handoff.agentName : handoff.name) === "Dispatch Agent");
    const policy = agent.handoffs.find((handoff) => ("agentName" in handoff ? handoff.agentName : handoff.name) === "Policy and Billing Agent");

    expect(toolNames(customer)).toEqual(["searchCustomers", "getCustomer", "getCustomerAssets", "getOpenTickets", "getServiceHistory", "createTicket", "updateTicket"]);
    const diagnostics = agent.handoffs.find((handoff) => ("agentName" in handoff ? handoff.agentName : handoff.name) === "Diagnostics Agent");
    expect(toolNames(diagnostics)).toEqual(["getAssetTelemetry", "getKnownIssuePatterns", "checkFirmwareStatus", "estimateRepairPlan"]);
    expect(toolNames(dispatch)).toContain("createWorkOrder");
    expect(toolNames(dispatch)).toContain("reservePart");
    expect(toolNames(policy)).toContain("getPolicy");
    expect(toolNames(policy)).toContain("cancelAppointment");
    expect(toolNames(policy)).toContain("createCreditMemo");
    const composer = agent.handoffs.find((handoff) => ("agentName" in handoff ? handoff.agentName : handoff.name) === "Message Composer Agent");
    expect(toolNames(composer)).toContain("saveInternalNote");
    expect(toolNames(composer)).toContain("createCaseSummary");
    expect(toolNames(composer)).toContain("saveCustomerMessage");
    expect(toolNames(composer)).toContain("sendCustomerMessage");
  });

  it("extracts ephemeral client secrets without exposing server keys", () => {
    expect(extractClientSecret({ mode: "mock", data: { client_secret: "nope" } })).toBeNull();
    expect(extractClientSecret({ mode: "live", data: { client_secret: { value: "eph_123" } } })).toBe("eph_123");
    expect(extractClientSecret({ mode: "live", data: { value: "eph_456" } })).toBe("eph_456");
  });

  it("does not expose approval tokens to the realtime model", () => {
    const visibleApproval = approvalForModel({
      approvalId: "apr_123",
      token: "tok_secret",
      action: "createWorkOrder",
      summary: "Schedule Marco Diaz.",
      payload: { ticketId: "TCK-1044" },
      status: "pending",
      createdAt: "2026-05-16T12:00:00-07:00"
    });

    expect(visibleApproval).toEqual({
      approvalId: "apr_123",
      action: "createWorkOrder",
      summary: "Schedule Marco Diaz.",
      status: "pending",
      message: "Approval card created in the UI. Do not call the write tool or claim completion until the dispatcher approves it."
    });
    expect(JSON.stringify(visibleApproval)).not.toContain("tok_secret");
    expect(JSON.stringify(visibleApproval)).not.toContain("ticketId");
  });

  it("maps realtime history events into visible user and assistant transcripts", () => {
    const source = new FakeRealtimeSource();
    const callbacks = callbackRecorder();
    bindRealtimeSessionEvents(source, callbacks);

    source.emit("history_updated", [
      messageItem("user", "Customer says charger C H G dash 8821 died."),
      messageItem("assistant", "Please confirm the normalized asset ID is CHG-8821.")
    ]);
    source.emit("history_updated", [
      messageItem("assistant", "Please confirm the normalized asset ID is CHG-8821."),
      messageItem("user", "Confirmed CHG-8821.")
    ]);

    expect(callbacks.assistantText).toContain("Please confirm the normalized asset ID is CHG-8821.");
    expect(callbacks.userText).toContain("Confirmed CHG-8821.");
  });

  it("refreshes state and surfaces approval, interruption, and error events", async () => {
    const source = new FakeRealtimeSource();
    const callbacks = callbackRecorder();
    bindRealtimeSessionEvents(source, callbacks);

    await source.emit("agent_tool_end");
    await source.emit("tool_approval_requested");
    await source.emit("audio_interrupted");
    await source.emit("error", { error: new Error("session failed") });

    expect(callbacks.refreshCount).toBe(2);
    expect(callbacks.assistantText).toContain("Approval requested. Review the drawer before any side effect runs.");
    expect(callbacks.interruptions).toContain("Interrupted. Listening for the next dispatcher instruction.");
    expect(callbacks.errors).toContain("session failed");
  });
});

function toolNames(agent: unknown) {
  return ((agent as { tools?: Array<{ name: string }> } | undefined)?.tools ?? []).map((tool) => tool.name);
}

function messageItem(role: "assistant" | "user", text: string) {
  return {
    type: "message",
    role,
    content: [{ type: "text", text }]
  };
}

function callbackRecorder() {
  const callbacks = {
    assistantText: [] as string[],
    userText: [] as string[],
    interruptions: [] as string[],
    errors: [] as string[],
    refreshCount: 0,
    onConnectionChange: () => undefined,
    onAssistantText: (text: string) => callbacks.assistantText.push(text),
    onUserText: (text: string) => callbacks.userText.push(text),
    onError: (message: string) => callbacks.errors.push(message),
    onInterruption: (message: string) => callbacks.interruptions.push(message),
    onRefreshState: () => {
      callbacks.refreshCount += 1;
    }
  };
  return callbacks satisfies RealtimeConsoleCallbacks & {
    assistantText: string[];
    userText: string[];
    interruptions: string[];
    errors: string[];
    refreshCount: number;
  };
}

class FakeRealtimeSource {
  private handlers = new Map<string, Array<(...args: unknown[]) => void | Promise<void>>>();

  on(event: string, handler: (...args: unknown[]) => void | Promise<void>) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
  }

  async emit(event: string, ...args: unknown[]) {
    for (const handler of this.handlers.get(event) ?? []) {
      await handler(...args);
    }
  }
}
