import { tool } from "@openai/agents";
import { RealtimeAgent, RealtimeSession, type RealtimeItem } from "@openai/agents/realtime";
import { realtimeInstructions, realtimeModel } from "@alpine/agents";
import { z } from "zod";
import { companyClient, type RealtimeSessionResponse } from "./companyClient";

export type VoiceConnection = "disconnected" | "connecting" | "live" | "mock";

export interface RealtimeConsoleCallbacks {
  onConnectionChange: (state: VoiceConnection) => void;
  onAssistantText: (text: string) => void;
  onUserText: (text: string) => void;
  onError: (message: string) => void;
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
        execute: async (params) => companyClient.requestHumanApproval(params)
      })
    ]
  });
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
    callbacks.onAssistantText("Interrupted. Listening for the next dispatcher instruction.");
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
