import {
  type Approval,
  type Asset,
  type CompanyState,
  type EventLogEntry,
  type Ticket,
  type WorkOrder,
  createSeedState,
  event,
  getScenario
} from "@alpine/mock-data";
import { estimateRepairPlan, firmwareStatus } from "./diagnostics";
import { replayDemoScenario } from "./replay";
import type { ApiResult, CompanyApi } from "./types";
export type { FirmwareStatus, RepairPlan } from "./diagnostics";
export type * from "./types";

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

    getServiceHistory: (customerId) => {
      const history = state.serviceHistory.filter((item) => item.customerId === customerId);
      addEvent(event("Customer Context Agent", "tool_call", "Service history lookup", { toolName: "getServiceHistory", args: { customerId }, resultSummary: `${history.length} visit(s)` }));
      return success(clone(history));
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

    getKnownIssuePatterns: (productModel) => {
      const patterns = state.knownIssuePatterns.filter((pattern) => pattern.productModel === productModel);
      addEvent(event("Diagnostics Agent", "tool_call", "Known issue pattern lookup", { toolName: "getKnownIssuePatterns", args: { productModel }, resultSummary: `${patterns.length} pattern(s)` }));
      return success(clone(patterns));
    },

    checkFirmwareStatus: (assetId) => {
      const asset = state.assets.find((item) => item.assetId === assetId);
      addEvent(event("Diagnostics Agent", "tool_call", "Firmware status check", { toolName: "checkFirmwareStatus", args: { assetId } }));
      if (!asset) return failure("asset_not_found", `No asset found for ${assetId}.`);
      return success(firmwareStatus(asset, state.telemetry.filter((point) => point.assetId === assetId)));
    },

    estimateRepairPlan: (assetId) => {
      const asset = state.assets.find((item) => item.assetId === assetId);
      addEvent(event("Diagnostics Agent", "tool_result", "Repair plan estimated", { toolName: "estimateRepairPlan", args: { assetId } }));
      if (!asset) return failure("asset_not_found", `No asset found for ${assetId}.`);
      return success(estimateRepairPlan(state, asset));
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
      addEvent(event("Safety / Approval Layer", "approval", "Approval requested", {
        toolName: "requestHumanApproval",
        args: { action, payload },
        resultSummary: summary,
        approvalStatus: "pending"
      }));
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

    createTicket: ({ customerId, assetId, priority, summary, notes = [], approvalToken }) => {
      const approval = requireApprovedToken(approvalToken, "createTicket");
      if (!approval.ok) return approval;
      const customer = state.customers.find((item) => item.id === customerId);
      const asset = state.assets.find((item) => item.assetId === assetId && item.customerId === customerId);
      if (!customer) return failure("customer_not_found", `No customer found for ${customerId}.`);
      if (!asset) return failure("asset_not_found", `No asset ${assetId} found for ${customerId}.`);

      const ticket: Ticket = {
        ticketId: `TCK-${Math.floor(2000 + Math.random() * 7000)}`,
        customerId,
        assetId,
        status: "open",
        priority,
        summary,
        notes
      };
      state.tickets.unshift(ticket);
      addEvent(event("Customer Context Agent", "state_change", "Ticket created", {
        toolName: "createTicket",
        args: { customerId, assetId, priority, summary },
        resultSummary: ticket.ticketId
      }));
      return success(clone(ticket));
    },

    updateTicket: ({ ticketId, status, priority, summary, note, approvalToken }) => {
      const approval = requireApprovedToken(approvalToken, "updateTicket");
      if (!approval.ok) return approval;
      const ticket = state.tickets.find((item) => item.ticketId === ticketId);
      if (!ticket) return failure("ticket_not_found", `No ticket found for ${ticketId}.`);

      if (status) ticket.status = status;
      if (priority) ticket.priority = priority;
      if (summary) ticket.summary = summary;
      if (note) ticket.notes.push(note);

      addEvent(event("Customer Context Agent", "state_change", "Ticket updated", {
        toolName: "updateTicket",
        args: { ticketId, status, priority, summary, note },
        resultSummary: `${ticket.ticketId} is ${ticket.status}`
      }));
      return success(clone(ticket));
    },

    createWorkOrder: ({ ticketId, technicianId, windowId, reservedParts, customerChargeCents, approvalToken }) => {
      const approval = requireApprovedToken(approvalToken, "createWorkOrder");
      if (!approval.ok) return approval;
      const ticket = state.tickets.find((item) => item.ticketId === ticketId);
      const technician = state.technicians.find((item) => item.techId === technicianId);
      const appointmentWindow = technician?.schedule.find((window) => window.windowId === windowId);
      if (!ticket) return failure("ticket_not_found", `No ticket found for ${ticketId}.`);
      if (!technician || !appointmentWindow || !appointmentWindow.available) return failure("window_unavailable", "Technician window is no longer available.");
      const partCounts = countParts(reservedParts);
      for (const [partId, quantity] of Object.entries(partCounts)) {
        const part = state.inventory.find((item) => item.partId === partId);
        if (!part) return failure("part_not_found", `No part found for ${partId}.`);
        if (part.quantity < quantity) return failure("part_out_of_stock", `${partId} has only ${part.quantity} available.`);
      }
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
      for (const [partId, quantity] of Object.entries(partCounts)) {
        const part = state.inventory.find((item) => item.partId === partId);
        if (part) part.quantity -= quantity;
      }
      state.workOrders.unshift(workOrder);
      addEvent(event("Dispatch Agent", "state_change", "Work order created", {
        toolName: "createWorkOrder",
        args: { ticketId, technicianId, windowId, reservedParts, customerChargeCents },
        resultSummary: `${workOrder.workOrderId} scheduled with ${technician.name}`
      }));
      if (reservedParts.length) {
        addEvent(event("Dispatch Agent", "state_change", "Part reserved", {
          toolName: "createWorkOrder",
          args: { reservedParts },
          resultSummary: reservedParts.join(", ")
        }));
      }
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

    saveInternalNote: ({ ticketId, body, approvalToken }) => {
      const approval = requireApprovedToken(approvalToken, "saveInternalNote");
      if (!approval.ok) return approval;
      const ticket = state.tickets.find((item) => item.ticketId === ticketId);
      if (!ticket) return failure("ticket_not_found", `No ticket found for ${ticketId}.`);
      const note = { noteId: `NOTE-${Math.floor(1000 + Math.random() * 9000)}`, ticketId, body, createdAt: new Date().toISOString() };
      state.internalNotes.unshift(note);
      addEvent(event("Message Composer Agent", "state_change", "Internal note saved", { toolName: "saveInternalNote", args: { ticketId }, resultSummary: note.noteId }));
      return success(clone(note));
    },

    createCaseSummary: ({ ticketId }) => {
      const ticket = state.tickets.find((item) => item.ticketId === ticketId);
      if (!ticket) return failure("ticket_not_found", `No ticket found for ${ticketId}.`);
      const asset = state.assets.find((item) => item.assetId === ticket.assetId);
      const plan = asset ? estimateRepairPlan(state, asset) : undefined;
      const body = `${ticket.ticketId}: ${ticket.summary}. ${plan?.summary ?? "No repair plan available."}`;
      const summary = { summaryId: `SUM-${Math.floor(1000 + Math.random() * 9000)}`, ticketId, body, createdAt: new Date().toISOString() };
      state.caseSummaries.unshift(summary);
      addEvent(event("Message Composer Agent", "tool_result", "Case summary created", { toolName: "createCaseSummary", args: { ticketId }, resultSummary: body }));
      return success(clone(summary));
    },

    saveCustomerMessage: ({ customerId, channel, body, approvalToken }) => {
      const approval = requireApprovedToken(approvalToken, "saveCustomerMessage");
      if (!approval.ok) return approval;
      const customer = state.customers.find((item) => item.id === customerId);
      if (!customer) return failure("customer_not_found", `No customer found for ${customerId}.`);
      const message = {
        messageId: `MSG-${Math.floor(1000 + Math.random() * 9000)}`,
        customerId,
        channel,
        body,
        status: "saved" as const,
        createdAt: new Date().toISOString()
      };
      state.customerMessages.unshift(message);
      addEvent(event("Message Composer Agent", "state_change", "Customer message saved", {
        toolName: "saveCustomerMessage",
        args: { customerId, channel },
        resultSummary: message.messageId
      }));
      return success({ messageId: message.messageId, status: message.status });
    },

    sendCustomerMessage: ({ messageId, approvalToken }) => {
      const approval = requireApprovedToken(approvalToken, "sendCustomerMessage");
      if (!approval.ok) return approval;
      const message = state.customerMessages.find((item) => item.messageId === messageId);
      if (!message) return failure("message_not_found", `No message found for ${messageId}.`);
      message.status = "sent";
      message.sentAt = new Date().toISOString();
      addEvent(event("Message Composer Agent", "state_change", "Customer message sent", {
        toolName: "sendCustomerMessage",
        args: { messageId },
        resultSummary: "Mock send complete"
      }));
      return success({ messageId, status: message.status });
    },

    replayScenario: (scenarioId) => success(replayDemoScenario(api, scenarioId, addEvent)),

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

function countParts(partIds: string[]): Record<string, number> {
  return partIds.reduce<Record<string, number>>((counts, partId) => {
    counts[partId] = (counts[partId] ?? 0) + 1;
    return counts;
  }, {});
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
