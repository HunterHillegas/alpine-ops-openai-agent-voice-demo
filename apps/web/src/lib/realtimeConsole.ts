import { tool } from "@openai/agents";
import { RealtimeAgent, RealtimeSession, type RealtimeItem } from "@openai/agents/realtime";
import { realtimeInstructions, realtimeModel } from "@alpine/agents";
import { z } from "zod";
import type { Approval } from "@alpine/mock-data";
import { companyClient, type RealtimeSessionResponse } from "./companyClient";

export type VoiceConnection = "disconnected" | "connecting" | "live" | "mock";

export interface RealtimeConsoleCallbacks {
  onConnectionChange: (state: VoiceConnection) => void;
  onAssistantText: (text: string) => void;
  onUserText: (text: string) => void;
  onError: (message: string) => void;
  onInterruption: (message: string) => void;
  onRefreshState: () => void | Promise<void>;
}

export class AlpineRealtimeConsole {
  private session: RealtimeSession | null = null;
  private mode: VoiceConnection = "disconnected";

  constructor(private readonly callbacks: RealtimeConsoleCallbacks) {}

  async connect() {
    this.callbacks.onConnectionChange("connecting");
    const credential = await companyClient.realtimeSession();
    const secret = extractClientSecret(credential);

    if (!secret) {
      this.mode = "mock";
      this.callbacks.onConnectionChange("mock");
      this.callbacks.onAssistantText("Mock voice mode active. Set OPENAI_API_KEY on the API server for live WebRTC.");
      return;
    }

    const session = new RealtimeSession(buildAlpineRealtimeAgent(), {
      transport: "webrtc",
      model: realtimeModel.model,
      workflowName: "Alpine FieldOps Voice Console",
      traceMetadata: { app: "alpine-fieldops-voice-agent" }
    });

    wireSessionEvents(session, this.callbacks);
    await session.connect({ apiKey: secret, model: realtimeModel.model });
    this.session = session;
    this.mode = "live";
    this.callbacks.onConnectionChange("live");
    this.callbacks.onAssistantText("Live voice session connected.");
  }

  disconnect() {
    this.session?.close();
    this.session = null;
    this.mode = "disconnected";
    this.callbacks.onConnectionChange("disconnected");
    this.callbacks.onAssistantText("Voice session disconnected.");
  }

  sendText(message: string) {
    if (!message.trim()) return;
    this.callbacks.onUserText(message);
    if (this.mode !== "live" || !this.session) {
      this.callbacks.onAssistantText("Text fallback captured. Run a replay or connect live voice to execute agent tools.");
      return;
    }
    this.session.sendMessage(message);
  }
}

export function buildAlpineRealtimeAgent() {
  const customerContextAgent = new RealtimeAgent({
    name: "Customer Context Agent",
    instructions: "Resolve customer identity, assets, open tickets, and service history. Return concise account context only.",
    tools: [
      tool({
        name: "searchCustomers",
        description: "Search customers by name after the spoken name is clear.",
        parameters: z.object({ query: z.string().min(2) }),
        execute: async ({ query }) => companyClient.searchCustomers(query)
      }),
      tool({
        name: "getCustomer",
        description: "Fetch one resolved customer by internal customer ID.",
        parameters: z.object({ customerId: z.string().min(1) }),
        execute: async ({ customerId }) => companyClient.getCustomer(customerId)
      }),
      tool({
        name: "getCustomerAssets",
        description: "List assets owned by one resolved customer.",
        parameters: z.object({ customerId: z.string().min(1) }),
        execute: async ({ customerId }) => companyClient.getCustomerAssets(customerId)
      }),
      tool({
        name: "getOpenTickets",
        description: "List open tickets for one resolved customer.",
        parameters: z.object({ customerId: z.string().min(1) }),
        execute: async ({ customerId }) => companyClient.getOpenTickets(customerId)
      }),
      tool({
        name: "getServiceHistory",
        description: "List prior service visits for one resolved customer.",
        parameters: z.object({ customerId: z.string().min(1) }),
        execute: async ({ customerId }) => companyClient.getServiceHistory(customerId)
      }),
      tool({
        name: "createTicket",
        description: "Create a mocked service ticket only after explicit confirmation, UI approval, and approval token.",
        parameters: z.object({
          customerId: z.string(),
          assetId: assetIdSchema,
          priority: z.enum(["low", "normal", "high", "urgent"]),
          summary: z.string(),
          notes: z.array(z.string()).optional(),
          approvalToken: z.string()
        }),
        execute: async (params) => companyClient.createTicket(params)
      }),
      tool({
        name: "updateTicket",
        description: "Update a mocked service ticket only after explicit confirmation, UI approval, and approval token.",
        parameters: z.object({
          ticketId: z.string(),
          status: z.enum(["open", "triaged", "scheduled", "cancelled", "resolved"]).optional(),
          priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
          summary: z.string().optional(),
          note: z.string().optional(),
          approvalToken: z.string()
        }),
        execute: async (params) => companyClient.updateTicket(params)
      })
    ]
  });

  const diagnosticsAgent = new RealtimeAgent({
    name: "Diagnostics Agent",
    instructions: "Use telemetry and known symptom patterns to identify likely repair needs. Do not schedule work.",
    tools: [
      tool({
        name: "getAssetTelemetry",
        description: "Fetch recent telemetry for a confirmed exact asset ID.",
        parameters: z.object({ assetId: assetIdSchema }),
        execute: async ({ assetId }) => companyClient.getAssetTelemetry(assetId)
      }),
      tool({
        name: "getKnownIssuePatterns",
        description: "Fetch known issue patterns for a product model.",
        parameters: z.object({ productModel: z.string().min(3) }),
        execute: async ({ productModel }) => companyClient.getKnownIssuePatterns(productModel)
      }),
      tool({
        name: "checkFirmwareStatus",
        description: "Check firmware status and telemetry warnings for a confirmed exact asset ID.",
        parameters: z.object({ assetId: assetIdSchema }),
        execute: async ({ assetId }) => companyClient.checkFirmwareStatus(assetId)
      }),
      tool({
        name: "estimateRepairPlan",
        description: "Estimate likely part, severity, and safe repair steps for a confirmed exact asset ID.",
        parameters: z.object({ assetId: assetIdSchema }),
        execute: async ({ assetId }) => companyClient.estimateRepairPlan(assetId)
      })
    ]
  });

  const dispatchAgent = new RealtimeAgent({
    name: "Dispatch Agent",
    instructions: "Find qualified technicians and parts. Propose work orders, but request approval before side effects.",
    tools: [
      tool({
        name: "checkPartInventory",
        description: "Check available stock for a part ID.",
        parameters: z.object({ partId: z.string().min(3) }),
        execute: async ({ partId }) => companyClient.checkPartInventory(partId)
      }),
      tool({
        name: "findTechnicians",
        description: "Find qualified technicians by certification, region, and optional van part.",
        parameters: z.object({ certification: z.string(), region: z.string(), partId: z.string().optional() }),
        execute: async (params) => companyClient.findTechnicians({
          certification: params.certification,
          region: params.region,
          ...(params.partId ? { partId: params.partId } : {})
        })
      }),
      tool({
        name: "createWorkOrder",
        description: "Create a mocked work order only after the dispatcher approves the UI card and provides its approval token.",
        parameters: z.object({
          ticketId: z.string(),
          technicianId: z.string(),
          windowId: z.string(),
          reservedParts: z.array(z.string()),
          customerChargeCents: z.number().int().nonnegative(),
          approvalToken: z.string()
        }),
        execute: async (params) => companyClient.createWorkOrder(params)
      }),
      tool({
        name: "reservePart",
        description: "Reserve mocked inventory only after the dispatcher approves the UI card and provides its approval token.",
        parameters: z.object({
          partId: z.string(),
          quantity: z.number().int().positive(),
          approvalToken: z.string()
        }),
        execute: async (params) => companyClient.reservePart(params)
      })
    ]
  });

  const policyAgent = new RealtimeAgent({
    name: "Policy and Billing Agent",
    instructions: "Check warranty, charges, refunds, cancellations, and approval requirements. Do not claim writes succeeded before tools succeed.",
    tools: [
      tool({
        name: "getWarrantyStatus",
        description: "Check warranty coverage for a confirmed exact asset ID.",
        parameters: z.object({ assetId: assetIdSchema }),
        execute: async ({ assetId }) => companyClient.getWarrantyStatus(assetId)
      }),
      tool({
        name: "getPolicy",
        description: "Fetch policy notes by policy ID.",
        parameters: z.object({ policyId: z.string().min(1) }),
        execute: async ({ policyId }) => companyClient.getPolicy(policyId)
      }),
      tool({
        name: "cancelAppointment",
        description: "Cancel a mocked appointment only after explicit confirmation, UI approval, and approval token.",
        parameters: z.object({ ticketId: z.string(), approvalToken: z.string() }),
        execute: async (params) => companyClient.cancelAppointment(params)
      }),
      tool({
        name: "createCreditMemo",
        description: "Create a mocked credit memo only after explicit confirmation, UI approval, and approval token.",
        parameters: z.object({
          customerId: z.string(),
          amountCents: z.number().int().positive(),
          reason: z.string(),
          approvalToken: z.string()
        }),
        execute: async (params) => companyClient.createCreditMemo(params)
      })
    ]
  });

  const messageAgent = new RealtimeAgent({
    name: "Message Composer Agent",
    instructions: "Draft concise customer messages grounded in tool results. Do not send messages.",
    tools: [
      tool({
        name: "draftCustomerMessage",
        description: "Draft a mocked SMS or email. This does not send the message.",
        parameters: z.object({
          customerId: z.string(),
          workOrderId: z.string().optional(),
          channel: z.enum(["sms", "email"]),
          topic: z.string()
        }),
        execute: async (params) => companyClient.draftCustomerMessage({
          customerId: params.customerId,
          channel: params.channel,
          topic: params.topic,
          ...(params.workOrderId ? { workOrderId: params.workOrderId } : {})
        })
      }),
      tool({
        name: "saveInternalNote",
        description: "Save a mocked internal dispatch note only after UI approval and approval token.",
        parameters: z.object({
          ticketId: z.string(),
          body: z.string(),
          approvalToken: z.string()
        }),
        execute: async (params) => companyClient.saveInternalNote(params)
      }),
      tool({
        name: "createCaseSummary",
        description: "Create a grounded summary from the current mock case state.",
        parameters: z.object({ ticketId: z.string() }),
        execute: async (params) => companyClient.createCaseSummary(params)
      }),
      tool({
        name: "saveCustomerMessage",
        description: "Save a mocked customer message only after the dispatcher approves the UI card and provides its approval token.",
        parameters: z.object({
          customerId: z.string(),
          channel: z.enum(["sms", "email"]),
          body: z.string(),
          approvalToken: z.string()
        }),
        execute: async (params) => companyClient.saveCustomerMessage(params)
      }),
      tool({
        name: "sendCustomerMessage",
        description: "Mark a saved customer message as sent in the mock system only after explicit UI approval.",
        parameters: z.object({
          messageId: z.string(),
          approvalToken: z.string()
        }),
        execute: async (params) => companyClient.sendCustomerMessage(params)
      })
    ]
  });

  return new RealtimeAgent({
    name: "Realtime Triage Agent",
    voice: realtimeModel.voice,
    instructions: realtimeInstructions,
    handoffs: [customerContextAgent, diagnosticsAgent, dispatchAgent, policyAgent, messageAgent],
    tools: [
      tool({
        name: "waitForMoreAudio",
        description: "No-op for silence, background noise, side conversations, or incomplete audio.",
        parameters: z.object({ reason: z.string().optional() }),
        execute: async ({ reason }) => ({ status: "waiting", reason: reason ?? "incomplete audio" })
      }),
      tool({
        name: "getAsset",
        description: "Fetch one asset after confirming the exact normalized asset ID.",
        parameters: z.object({ assetId: assetIdSchema }),
        execute: async ({ assetId }) => companyClient.getAsset(assetId)
      }),
      tool({
        name: "requestHumanApproval",
        description: "Create a UI approval card before a write action such as schedule, cancel, refund, reserve, or send.",
        parameters: z.object({
          action: z.string(),
          summary: z.string(),
          payload: z.unknown()
        }),
        execute: async (params) => approvalForModel(await companyClient.requestHumanApproval(params))
      })
    ]
  });
}

export function approvalForModel(approval: Approval) {
  return {
    approvalId: approval.approvalId,
    action: approval.action,
    summary: approval.summary,
    status: approval.status,
    message: "Approval card created in the UI. Do not call the write tool or claim completion until the dispatcher approves it."
  };
}

export function extractClientSecret(response: RealtimeSessionResponse): string | null {
  if (response.mode !== "live") return null;
  const data = response.data as Record<string, unknown> | null;
  if (!data) return null;
  const direct = data.client_secret;
  if (typeof direct === "string") return direct;
  if (direct && typeof direct === "object") {
    const nested = direct as Record<string, unknown>;
    if (typeof nested.value === "string") return nested.value;
    if (typeof nested.secret === "string") return nested.secret;
  }
  if (typeof data.value === "string") return data.value;
  return null;
}

function wireSessionEvents(session: RealtimeSession, callbacks: RealtimeConsoleCallbacks) {
  session.on("history_updated", (history) => {
    const latest = [...history].reverse().find((item) => item.type === "message");
    const text = latest ? messageText(latest) : "";
    if (!text) return;
    if (latest?.role === "assistant") callbacks.onAssistantText(text);
    if (latest?.role === "user") callbacks.onUserText(text);
  });
  session.on("agent_tool_end", async () => {
    await callbacks.onRefreshState();
  });
  session.on("tool_approval_requested", async () => {
    callbacks.onAssistantText("Approval requested. Review the drawer before any side effect runs.");
    await callbacks.onRefreshState();
  });
  session.on("audio_interrupted", () => {
    const message = "Interrupted. Listening for the next dispatcher instruction.";
    callbacks.onInterruption(message);
    callbacks.onAssistantText(message);
  });
  session.on("error", (error) => {
    callbacks.onError(errorMessage(error.error));
  });
}

function messageText(item: Extract<RealtimeItem, { type: "message" }>) {
  return item.content
    .map((content) => {
      if ("text" in content) return content.text;
      if ("transcript" in content && content.transcript) return content.transcript;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const assetIdSchema = z.string().regex(/^[A-Z]{3}-\d{4}$/, "Confirm the exact normalized asset ID before lookup.");
