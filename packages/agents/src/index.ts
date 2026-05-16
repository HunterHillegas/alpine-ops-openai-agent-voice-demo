import { z } from "zod";

export const realtimeModel = {
  model: "gpt-realtime-2",
  reasoning: { effort: "low" as const },
  voice: "marin"
};

export const agentRoster = [
  {
    name: "Realtime Triage Agent",
    responsibility: "Own live voice, exact-entity capture, short preambles, routing, and write-action confirmation."
  },
  {
    name: "Customer Context Agent",
    responsibility: "Resolve customers, assets, tickets, and account context."
  },
  {
    name: "Diagnostics Agent",
    responsibility: "Interpret telemetry, firmware warnings, known issue patterns, likely parts, severity, and urgency."
  },
  {
    name: "Dispatch Agent",
    responsibility: "Find qualified technicians, appointment windows, inventory, and work-order proposals."
  },
  {
    name: "Policy and Billing Agent",
    responsibility: "Check warranty, explain charges, cancellation/refund policy, and approval requirements."
  },
  {
    name: "Message Composer Agent",
    responsibility: "Draft customer messages, internal notes, and final case summaries grounded in tool results."
  }
] as const;

export const exactAssetIdSchema = z.string().regex(/^[A-Z]{3}-\d{4}$/, "Use exact normalized asset ID like CHG-8821.");
export const exactEmailSchema = z.string().email().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Use a complete email address.");
export const exactPhoneSchema = z.string().regex(/^\+1-\d{3}-\d{3}-\d{4}$/, "Use normalized US phone like +1-805-555-0147.");

export const toolDefinitions = [
  readTool("searchCustomers", "Search customers by exact or partial name once the spoken name is clear.", z.object({ query: z.string().min(2) })),
  readTool("getCustomer", "Fetch one resolved customer by internal customer ID.", z.object({ customerId: z.string().min(1) })),
  readTool("getCustomerAssets", "List assets owned by one customer.", z.object({ customerId: z.string().min(1) })),
  readTool("getOpenTickets", "List open tickets for one customer.", z.object({ customerId: z.string().min(1) })),
  readTool("getServiceHistory", "List prior service visits for one customer.", z.object({ customerId: z.string().min(1) })),
  readTool("getAsset", "Fetch one asset. Requires confirmed exact asset ID.", z.object({ assetId: exactAssetIdSchema })),
  readTool("getAssetTelemetry", "Fetch recent telemetry for a confirmed exact asset ID.", z.object({ assetId: exactAssetIdSchema })),
  readTool("getKnownIssuePatterns", "Fetch known issue patterns for a product model.", z.object({ productModel: z.string().min(3) })),
  readTool("checkFirmwareStatus", "Check firmware version and telemetry warnings for a confirmed asset.", z.object({ assetId: exactAssetIdSchema })),
  readTool("estimateRepairPlan", "Estimate likely part, severity, and diagnostic steps for a confirmed asset.", z.object({ assetId: exactAssetIdSchema })),
  readTool("getWarrantyStatus", "Check warranty coverage for a confirmed exact asset ID.", z.object({ assetId: exactAssetIdSchema })),
  readTool("getPolicy", "Fetch policy notes by policy ID.", z.object({ policyId: z.string().min(1) })),
  readTool("checkPartInventory", "Check available stock for a specific part ID.", z.object({ partId: z.string().min(3) })),
  readTool("findTechnicians", "Find qualified technicians by certification, region, and optional van part.", z.object({ certification: z.string(), region: z.string(), partId: z.string().optional() })),
  writeTool("createTicket", "Create a service ticket only after explicit confirmation and UI approval.", z.object({ customerId: z.string(), assetId: exactAssetIdSchema, priority: z.enum(["low", "normal", "high", "urgent"]), summary: z.string(), notes: z.array(z.string()).optional(), approvalToken: z.string() })),
  writeTool("updateTicket", "Update a service ticket only after explicit confirmation and UI approval.", z.object({ ticketId: z.string(), status: z.enum(["open", "triaged", "scheduled", "cancelled", "resolved"]).optional(), priority: z.enum(["low", "normal", "high", "urgent"]).optional(), summary: z.string().optional(), note: z.string().optional(), approvalToken: z.string() })),
  writeTool("createWorkOrder", "Schedule a work order after UI approval succeeds.", z.object({ ticketId: z.string(), technicianId: z.string(), windowId: z.string(), reservedParts: z.array(z.string()), customerChargeCents: z.number().int().nonnegative(), approvalToken: z.string() })),
  writeTool("reservePart", "Reserve inventory after UI approval succeeds.", z.object({ partId: z.string(), quantity: z.number().int().positive(), approvalToken: z.string() })),
  writeTool("cancelAppointment", "Cancel an appointment only after explicit confirmation and UI approval.", z.object({ ticketId: z.string(), approvalToken: z.string() })),
  writeTool("createCreditMemo", "Create a mocked credit memo only after explicit confirmation and UI approval.", z.object({ customerId: z.string(), amountCents: z.number().int().positive(), reason: z.string(), approvalToken: z.string() })),
  writeTool("saveInternalNote", "Save mocked internal dispatch notes only after UI approval.", z.object({ ticketId: z.string(), body: z.string(), approvalToken: z.string() })),
  readTool("createCaseSummary", "Create a grounded case summary from current mock case data.", z.object({ ticketId: z.string() })),
  writeTool("saveCustomerMessage", "Save a mocked customer message only after explicit confirmation and UI approval.", z.object({ customerId: z.string(), channel: z.enum(["sms", "email"]), body: z.string(), approvalToken: z.string() })),
  writeTool("sendCustomerMessage", "Mark a saved mock customer message as sent only after explicit confirmation and UI approval.", z.object({ messageId: z.string(), approvalToken: z.string() })),
  {
    name: "waitForMoreAudio",
    kind: "utility",
    description: "No-op tool for silence, background noise, side conversations, or incomplete audio.",
    requiresApproval: false,
    schema: z.object({ reason: z.string().optional() })
  },
  {
    name: "requestHumanApproval",
    kind: "utility",
    description: "Create a pending approval card for any write-side effect.",
    requiresApproval: false,
    schema: z.object({ action: z.string(), summary: z.string(), payload: z.unknown() })
  }
] as const;

export const realtimeInstructions = [
  "Role: You are Alpine FieldOps' dispatcher voice agent for EV charger and battery service.",
  "Style: Speak in short operational updates. Never say 'let me think'. Do not expose private reasoning.",
  "Preambles: Before multi-step tool work, say one concise action-oriented sentence.",
  "Exact IDs: Confirm asset IDs, ticket numbers, phone numbers, emails, and appointment windows before lookup or writes.",
  "Unclear audio: If a value is partial or corrected mid-utterance, use waitForMoreAudio or ask for one missing value at a time.",
  "Routing: Use Customer Context for identity/account, Diagnostics for telemetry/failure, Policy/Billing for warranty/refund/cancellation, Dispatch for scheduling/inventory, Message Composer for customer copy.",
  "Write actions: Summarize the intended change, request human approval, and only claim completion after the write tool succeeds.",
  "Failures: State the failure briefly and offer the next safe step. Never invent unavailable tools or data."
].join("\n");

export function normalizeSpokenAssetId(input: string): { status: "complete"; assetId: string } | { status: "partial"; reason: string } {
  const upper = input.toUpperCase().replace(/DASH|HYPHEN/g, "-").replace(/\s+/g, "");
  const letters = upper.match(/[A-Z]{3}/)?.[0];
  const digits = upper.match(/\d{4}/)?.[0];
  if (!letters || !digits) return { status: "partial", reason: "Need three-letter prefix and four digits." };
  const assetId = `${letters}-${digits}`;
  const parsed = exactAssetIdSchema.safeParse(assetId);
  return parsed.success ? { status: "complete", assetId } : { status: "partial", reason: parsed.error.issues[0]?.message ?? "Invalid asset ID." };
}

export function normalizeSpokenPhone(input: string): { status: "complete"; phone: string } | { status: "partial"; reason: string } {
  const digits = input.replace(/\D/g, "");
  const withoutCountry = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (withoutCountry.length !== 10) return { status: "partial", reason: "Need a complete 10-digit US phone number." };
  const phone = `+1-${withoutCountry.slice(0, 3)}-${withoutCountry.slice(3, 6)}-${withoutCountry.slice(6)}`;
  const parsed = exactPhoneSchema.safeParse(phone);
  return parsed.success ? { status: "complete", phone } : { status: "partial", reason: parsed.error.issues[0]?.message ?? "Invalid phone number." };
}

export function normalizeSpokenEmail(input: string): { status: "complete"; email: string } | { status: "partial"; reason: string } {
  const email = input
    .toLowerCase()
    .replace(/\s+at\s+/g, "@")
    .replace(/\s+dot\s+/g, ".")
    .replace(/\s+/g, "")
    .replace(/,/g, ".");
  const parsed = exactEmailSchema.safeParse(email);
  return parsed.success ? { status: "complete", email } : { status: "partial", reason: "Need a complete email address with mailbox, domain, and top-level domain." };
}

function readTool(name: string, description: string, schema: z.ZodType) {
  return { name, kind: "read", description, requiresApproval: false, schema } as const;
}

function writeTool(name: string, description: string, schema: z.ZodType) {
  return { name, kind: "write", description, requiresApproval: true, schema } as const;
}
