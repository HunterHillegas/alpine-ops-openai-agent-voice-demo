import {
  type Approval,
  type Asset,
  type CompanyState,
  type Customer,
  type EventLogEntry,
  type InventoryItem,
  type Technician,
  type TelemetryPoint,
  type Ticket,
  type WorkOrder,
  createSeedState,
  event,
  getScenario
} from "@alpine/mock-data";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string; matches?: unknown[] };

export interface CompanyApi {
  getState(): CompanyState;
  reset(scenarioId?: string): CompanyState;
  searchCustomers(query: string): ApiResult<Customer[]>;
  getCustomer(customerId: string): ApiResult<Customer>;
  getCustomerAssets(customerId: string): ApiResult<Asset[]>;
  getOpenTickets(customerId: string): ApiResult<Ticket[]>;
  getAsset(assetId: string): ApiResult<Asset>;
  getAssetTelemetry(assetId: string): ApiResult<TelemetryPoint[]>;
  getWarrantyStatus(assetId: string): ApiResult<{ active: boolean; expiration: string; summary: string }>;
  getPolicy(policyId: string): ApiResult<{ policyId: string; title: string; summary: string; rules: string[] }>;
  checkPartInventory(partId: string): ApiResult<InventoryItem>;
  findTechnicians(params: { certification: string; region: string; partId?: string }): ApiResult<Technician[]>;
  requestHumanApproval(params: { action: string; summary: string; payload: unknown }): Approval;
  approve(approvalId: string): ApiResult<Approval>;
  reject(approvalId: string): ApiResult<Approval>;
  createWorkOrder(params: CreateWorkOrderInput): ApiResult<WorkOrder>;
  reservePart(params: { partId: string; quantity: number; approvalToken: string }): ApiResult<InventoryItem>;
  cancelAppointment(params: { ticketId: string; approvalToken: string }): ApiResult<Ticket>;
  createCreditMemo(params: { customerId: string; amountCents: number; reason: string; approvalToken: string }): ApiResult<{ creditMemoId: string; customerId: string; amountCents: number }>;
  draftCustomerMessage(params: { customerId: string; workOrderId?: string; channel: "sms" | "email"; topic: string }): ApiResult<{ draftId: string; body: string }>;
  replayScenario(scenarioId: string): ApiResult<CompanyState>;
  addEvent(entry: EventLogEntry): EventLogEntry;
}

export interface CreateWorkOrderInput {
  ticketId: string;
  technicianId: string;
  windowId: string;
  reservedParts: string[];
  customerChargeCents: number;
  approvalToken: string;
}

export function createCompanyApi(initialState: CompanyState = createSeedState()): CompanyApi {
  let state = clone(initialState);

  const addEvent = (entry: EventLogEntry) => {
    state.events.unshift(entry);
    return entry;
  };

  const requireApprovedToken = (token: string, action: string): ApiResult<Approval> => {
    const approval = state.approvals.find((item) => item.token === token && item.action === action);
    if (!approval) return failure("approval_missing", `Missing approval token for ${action}.`);
    if (approval.status !== "approved") return failure("approval_not_approved", `Approval for ${action} is ${approval.status}.`);
    return success(approval);
  };

  const api: CompanyApi = {
    getState: () => clone(state),

    reset: (scenarioId) => {
      state = createSeedState();
      const scenario = scenarioId ? getScenario(scenarioId) : undefined;
      addEvent(event(
        "Demo Controller",
        "state_change",
        scenario ? `Loaded scenario: ${scenario.name}` : "Demo data reset",
        scenario ? { args: { scenarioId } } : {}
      ));
      return clone(state);
    },

    searchCustomers: (query) => {
      const normalized = query.trim().toLowerCase();
      const matches = state.customers.filter((customer) => customer.name.toLowerCase().includes(normalized));
      addEvent(event("Customer Context Agent", "tool_call", "Customer search", {
        toolName: "searchCustomers",
        args: { query },
        resultSummary: `${matches.length} match(es)`
      }));
      if (matches.length > 1) {
        return { ok: false, code: "ambiguous_customer", message: "Multiple customers match. Ask for one disambiguating value.", matches };
      }
      return success(clone(matches));
    },

    getCustomer: (customerId) => {
      const customer = state.customers.find((item) => item.id === customerId);
      addEvent(event("Customer Context Agent", "tool_call", "Customer lookup", { toolName: "getCustomer", args: { customerId } }));
      return customer ? success(clone(customer)) : failure("customer_not_found", `No customer found for ${customerId}.`);
    },

    getCustomerAssets: (customerId) => {
      const assets = state.assets.filter((asset) => asset.customerId === customerId);
      addEvent(event("Customer Context Agent", "tool_call", "Asset list", { toolName: "getCustomerAssets", args: { customerId }, resultSummary: `${assets.length} asset(s)` }));
      return success(clone(assets));
    },

    getOpenTickets: (customerId) => {
      const tickets = state.tickets.filter((ticket) => ticket.customerId === customerId && ticket.status !== "resolved" && ticket.status !== "cancelled");
      addEvent(event("Customer Context Agent", "tool_call", "Open ticket lookup", { toolName: "getOpenTickets", args: { customerId }, resultSummary: `${tickets.length} open ticket(s)` }));
      return success(clone(tickets));
    },

    getAsset: (assetId) => {
      if (!/^([A-Z]{3})-\d{4}$/.test(assetId)) {
        addEvent(event("Safety / Approval Layer", "guardrail", "Blocked partial asset lookup", { args: { assetId }, error: "Exact asset IDs must match ABC-1234." }));
        return failure("invalid_asset_id", "Asset lookup requires exact normalized ID like CHG-8821.");
      }
      const asset = state.assets.find((item) => item.assetId === assetId);
      addEvent(event("Customer Context Agent", "tool_call", "Asset lookup", { toolName: "getAsset", args: { assetId } }));
      return asset ? success(clone(asset)) : failure("asset_not_found", `No asset found for ${assetId}.`);
    },

    getAssetTelemetry: (assetId) => {
      const points = state.telemetry.filter((point) => point.assetId === assetId);
      addEvent(event("Diagnostics Agent", "tool_call", "Telemetry lookup", { toolName: "getAssetTelemetry", args: { assetId }, resultSummary: `${points.length} recent point(s)` }));
      return points.length ? success(clone(points)) : failure("telemetry_not_found", `No telemetry found for ${assetId}.`);
    },

    getWarrantyStatus: (assetId) => {
      const asset = state.assets.find((item) => item.assetId === assetId);
      addEvent(event("Policy and Billing Agent", "tool_call", "Warranty policy check", { toolName: "getWarrantyStatus", args: { assetId } }));
      if (!asset) return failure("asset_not_found", `No asset found for ${assetId}.`);
      const active = new Date(asset.warrantyExpiration) >= new Date("2026-05-16");
      return success({ active, expiration: asset.warrantyExpiration, summary: active ? "Active warranty; parts and labor covered." : "Warranty expired; estimate customer charge before scheduling." });
    },

    getPolicy: (policyId) => {
      const policy = state.policies.find((item) => item.policyId === policyId);
      addEvent(event("Policy and Billing Agent", "tool_call", "Policy lookup", { toolName: "getPolicy", args: { policyId } }));
      return policy ? success(clone(policy)) : failure("policy_not_found", `No policy found for ${policyId}.`);
    },

    checkPartInventory: (partId) => {
      const item = state.inventory.find((part) => part.partId === partId);
      addEvent(event("Dispatch Agent", "tool_call", "Inventory check", { toolName: "checkPartInventory", args: { partId }, resultSummary: item ? `${item.quantity} available` : "not found" }));
      return item ? success(clone(item)) : failure("part_not_found", `No part found for ${partId}.`);
    },

    findTechnicians: ({ certification, region, partId }) => {
      const technicians = state.technicians.filter((tech) => tech.region === region && tech.certifications.includes(certification) && (!partId || tech.vanInventory.includes(partId)));
      addEvent(event("Dispatch Agent", "tool_call", "Qualified technician search", {
        toolName: "findTechnicians",
        args: { certification, region, partId },
        resultSummary: `${technicians.length} technician(s)`
      }));
      return success(clone(technicians));
    },

    requestHumanApproval: ({ action, summary, payload }) => {
      const approval: Approval = {
        approvalId: `apr_${Math.random().toString(36).slice(2, 9)}`,
        token: `tok_${Math.random().toString(36).slice(2, 12)}`,
        action,
        summary,
        payload,
        status: "pending",
        createdAt: new Date().toISOString()
      };
      state.approvals.unshift(approval);
      addEvent(event("Safety / Approval Layer", "approval", "Approval requested", { args: { action, payload }, resultSummary: summary, approvalStatus: "pending" }));
      return clone(approval);
    },

    approve: (approvalId) => {
      const approval = state.approvals.find((item) => item.approvalId === approvalId);
      if (!approval) return failure("approval_not_found", `No approval found for ${approvalId}.`);
      approval.status = "approved";
      addEvent(event("Dispatcher", "approval", "Approval granted", { args: { approvalId, action: approval.action }, approvalStatus: "approved" }));
      return success(clone(approval));
    },

    reject: (approvalId) => {
      const approval = state.approvals.find((item) => item.approvalId === approvalId);
      if (!approval) return failure("approval_not_found", `No approval found for ${approvalId}.`);
      approval.status = "rejected";
      addEvent(event("Dispatcher", "approval", "Approval rejected", { args: { approvalId, action: approval.action }, approvalStatus: "rejected" }));
      return success(clone(approval));
    },

    createWorkOrder: ({ ticketId, technicianId, windowId, reservedParts, customerChargeCents, approvalToken }) => {
      const approval = requireApprovedToken(approvalToken, "createWorkOrder");
      if (!approval.ok) return approval;
      const ticket = state.tickets.find((item) => item.ticketId === ticketId);
      const technician = state.technicians.find((item) => item.techId === technicianId);
      const appointmentWindow = technician?.schedule.find((window) => window.windowId === windowId);
      if (!ticket) return failure("ticket_not_found", `No ticket found for ${ticketId}.`);
      if (!technician || !appointmentWindow || !appointmentWindow.available) return failure("window_unavailable", "Technician window is no longer available.");
      const workOrder: WorkOrder = {
        workOrderId: `WO-${Math.floor(2000 + Math.random() * 7000)}`,
        ticketId,
        technicianId,
        appointmentWindow: { ...appointmentWindow, available: false },
        reservedParts,
        customerChargeCents,
        status: "scheduled"
      };
      appointmentWindow.available = false;
      ticket.status = "scheduled";
      ticket.linkedWorkOrderId = workOrder.workOrderId;
      state.workOrders.unshift(workOrder);
      addEvent(event("Dispatch Agent", "state_change", "Work order created", {
        toolName: "createWorkOrder",
        args: { ticketId, technicianId, windowId, reservedParts, customerChargeCents },
        resultSummary: `${workOrder.workOrderId} scheduled with ${technician.name}`
      }));
      return success(clone(workOrder));
    },

    reservePart: ({ partId, quantity, approvalToken }) => {
      const approval = requireApprovedToken(approvalToken, "reservePart");
      if (!approval.ok) return approval;
      const part = state.inventory.find((item) => item.partId === partId);
      if (!part) return failure("part_not_found", `No part found for ${partId}.`);
      if (part.quantity < quantity) return failure("part_out_of_stock", `${partId} has only ${part.quantity} available.`);
      part.quantity -= quantity;
      addEvent(event("Dispatch Agent", "state_change", "Part reserved", { toolName: "reservePart", args: { partId, quantity }, resultSummary: `${part.quantity} remaining` }));
      return success(clone(part));
    },

    cancelAppointment: ({ ticketId, approvalToken }) => {
      const approval = requireApprovedToken(approvalToken, "cancelAppointment");
      if (!approval.ok) return approval;
      const ticket = state.tickets.find((item) => item.ticketId === ticketId);
      if (!ticket) return failure("ticket_not_found", `No ticket found for ${ticketId}.`);
      ticket.status = "cancelled";
      addEvent(event("Policy and Billing Agent", "state_change", "Appointment cancelled", { toolName: "cancelAppointment", args: { ticketId } }));
      return success(clone(ticket));
    },

    createCreditMemo: ({ customerId, amountCents, reason, approvalToken }) => {
      const approval = requireApprovedToken(approvalToken, "createCreditMemo");
      if (!approval.ok) return approval;
      const customer = state.customers.find((item) => item.id === customerId);
      if (!customer) return failure("customer_not_found", `No customer found for ${customerId}.`);
      const credit = { creditMemoId: `CRM-${Math.floor(1000 + Math.random() * 9000)}`, customerId, amountCents };
      addEvent(event("Policy and Billing Agent", "state_change", "Credit memo created", { toolName: "createCreditMemo", args: { customerId, amountCents, reason }, resultSummary: credit.creditMemoId }));
      return success(credit);
    },

    draftCustomerMessage: ({ customerId, workOrderId, channel, topic }) => {
      const customer = state.customers.find((item) => item.id === customerId);
      if (!customer) return failure("customer_not_found", `No customer found for ${customerId}.`);
      const body = workOrderId
        ? `Hi ${customer.name.split(" ")[0]}, Alpine FieldOps scheduled your warranty repair under ${workOrderId}. Marco will arrive tomorrow between 10:00 and 12:00 with the needed control board.`
        : `Hi ${customer.name.split(" ")[0]}, Alpine FieldOps reviewed your ${topic}. Reply here if you want us to make any changes before we save it.`;
      addEvent(event("Message Composer Agent", "tool_result", "Customer message drafted", { toolName: "draftCustomerMessage", args: { customerId, workOrderId, channel, topic }, resultSummary: body }));
      return success({ draftId: `msg_${Math.random().toString(36).slice(2, 9)}`, body });
    },

    replayScenario: (scenarioId) => {
      api.reset(scenarioId);
      if (scenarioId === "dead-charger-outage") {
        addEvent(event("Realtime Triage Agent", "heard_entity", "Heard asset ID candidate: CHG-8821", { args: { candidate: "CHG-8821" } }));
        addEvent(event("Realtime Triage Agent", "confirmation", "Confirmed exact identifier", { args: { assetId: "CHG-8821" } }));
        api.searchCustomers("Amelia Brooks");
        api.getAsset("CHG-8821");
        api.getAssetTelemetry("CHG-8821");
        api.getWarrantyStatus("CHG-8821");
        api.checkPartInventory("PCB-48A-R3");
        api.findTechnicians({ certification: "charger_service", region: "Santa Barbara", partId: "PCB-48A-R3" });
        api.requestHumanApproval({
          action: "createWorkOrder",
          summary: "Schedule Marco Diaz tomorrow 10:00-12:00 for warranty control-board replacement on CHG-8821.",
          payload: { ticketId: "TCK-1044", technicianId: "tech_marco_diaz", windowId: "win_marco_1012", reservedParts: ["PCB-48A-R3"], customerChargeCents: 0 }
        });
        addEvent(event("Realtime Triage Agent", "summary", "Ready for dispatcher approval: active warranty, likely control-board fault, Marco Diaz available tomorrow 10:00-12:00."));
      } else if (scenarioId === "refund-cancellation") {
        api.getPolicy("cancellation-refund");
        api.getOpenTickets("cus_noah_reed");
        api.requestHumanApproval({
          action: "cancelAppointment",
          summary: "Cancel Noah Reed's pending install. Refund still requires a separate credit-memo approval.",
          payload: { ticketId: "TCK-1048" }
        });
      } else if (scenarioId === "unclear-asset-id") {
        addEvent(event("Realtime Triage Agent", "heard_entity", "Heard partial asset ID: CHG-8...", { args: { candidate: "CHG-8" } }));
        addEvent(event("Safety / Approval Layer", "guardrail", "Lookup blocked until exact asset ID is confirmed", { error: "Partial spoken ID" }));
      } else if (scenarioId === "part-out-of-stock") {
        api.searchCustomers("Maya Chen");
        api.getAsset("BAT-7712");
        api.getAssetTelemetry("BAT-7712");
        api.checkPartInventory("INV-HOME20-R2");
        addEvent(event("Dispatch Agent", "failure", "Part out of stock; no reservation attempted", { toolName: "checkPartInventory", args: { partId: "INV-HOME20-R2" }, error: "quantity=0" }));
      }
      return success(api.getState());
    },

    addEvent
  };

  return api;
}

export async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function success<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

function failure(code: string, message: string): ApiResult<never> {
  return { ok: false, code, message };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function fetchJson<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "content-type": "application/json", ...init?.headers },
    ...init
  });
  const payload = (await response.json()) as T;
  if (!response.ok) throw new Error(JSON.stringify(payload));
  return payload;
}
