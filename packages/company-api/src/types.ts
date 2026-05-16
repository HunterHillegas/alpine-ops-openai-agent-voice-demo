import type {
  Approval,
  Asset,
  CaseSummary,
  CompanyState,
  Customer,
  EventLogEntry,
  InternalNote,
  InventoryItem,
  KnownIssuePattern,
  Technician,
  TelemetryPoint,
  Ticket,
  WorkOrder
} from "@alpine/mock-data";
import type { FirmwareStatus, RepairPlan } from "./diagnostics";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string; matches?: unknown[] };

export interface CompanyApi {
  getState(): CompanyState;
  reset(scenarioId?: string): CompanyState;
  searchCustomers(query: string): ApiResult<Customer[]>;
  getCustomer(customerId: string): ApiResult<Customer>;
  getCustomerAssets(customerId: string): ApiResult<Asset[]>;
  getOpenTickets(customerId: string): ApiResult<Ticket[]>;
  getServiceHistory(customerId: string): ApiResult<CompanyState["serviceHistory"]>;
  getAsset(assetId: string): ApiResult<Asset>;
  getAssetTelemetry(assetId: string): ApiResult<TelemetryPoint[]>;
  getKnownIssuePatterns(productModel: string): ApiResult<KnownIssuePattern[]>;
  checkFirmwareStatus(assetId: string): ApiResult<FirmwareStatus>;
  estimateRepairPlan(assetId: string): ApiResult<RepairPlan>;
  getWarrantyStatus(assetId: string): ApiResult<{ active: boolean; expiration: string; summary: string }>;
  getPolicy(policyId: string): ApiResult<{ policyId: string; title: string; summary: string; rules: string[] }>;
  checkPartInventory(partId: string): ApiResult<InventoryItem>;
  findTechnicians(params: { certification: string; region: string; partId?: string }): ApiResult<Technician[]>;
  requestHumanApproval(params: RequestHumanApprovalInput): Approval;
  approve(approvalId: string): ApiResult<Approval>;
  reject(approvalId: string): ApiResult<Approval>;
  createTicket(params: CreateTicketInput): ApiResult<Ticket>;
  updateTicket(params: UpdateTicketInput): ApiResult<Ticket>;
  createWorkOrder(params: CreateWorkOrderInput): ApiResult<WorkOrder>;
  reservePart(params: ReservePartInput): ApiResult<InventoryItem>;
  cancelAppointment(params: CancelAppointmentInput): ApiResult<Ticket>;
  createCreditMemo(params: CreateCreditMemoInput): ApiResult<CreditMemoResult>;
  draftCustomerMessage(params: DraftCustomerMessageInput): ApiResult<DraftCustomerMessageResult>;
  saveInternalNote(params: SaveInternalNoteInput): ApiResult<InternalNote>;
  createCaseSummary(params: { ticketId: string }): ApiResult<CaseSummary>;
  saveCustomerMessage(params: SaveCustomerMessageInput): ApiResult<SaveCustomerMessageResult>;
  sendCustomerMessage(params: SendCustomerMessageInput): ApiResult<SendCustomerMessageResult>;
  replayScenario(scenarioId: string): ApiResult<CompanyState>;
  addEvent(entry: EventLogEntry): EventLogEntry;
}

export interface RequestHumanApprovalInput {
  action: string;
  summary: string;
  payload: unknown;
}

export interface CreateWorkOrderInput {
  ticketId: string;
  technicianId: string;
  windowId: string;
  reservedParts: string[];
  customerChargeCents: number;
  approvalToken: string;
}

export interface CreateTicketInput {
  customerId: string;
  assetId: string;
  priority: Ticket["priority"];
  summary: string;
  notes?: string[] | undefined;
  approvalToken: string;
}

export interface UpdateTicketInput {
  ticketId: string;
  status?: Ticket["status"] | undefined;
  priority?: Ticket["priority"] | undefined;
  summary?: string | undefined;
  note?: string | undefined;
  approvalToken: string;
}

export interface ReservePartInput {
  partId: string;
  quantity: number;
  approvalToken: string;
}

export interface CancelAppointmentInput {
  ticketId: string;
  approvalToken: string;
}

export interface CreateCreditMemoInput {
  customerId: string;
  amountCents: number;
  reason: string;
  approvalToken: string;
}

export interface CreditMemoResult {
  creditMemoId: string;
  customerId: string;
  amountCents: number;
}

export interface DraftCustomerMessageInput {
  customerId: string;
  workOrderId?: string | undefined;
  channel: "sms" | "email";
  topic: string;
}

export interface DraftCustomerMessageResult {
  draftId: string;
  body: string;
}

export interface SaveInternalNoteInput {
  ticketId: string;
  body: string;
  approvalToken: string;
}

export interface SaveCustomerMessageInput {
  customerId: string;
  channel: "sms" | "email";
  body: string;
  approvalToken: string;
}

export interface SaveCustomerMessageResult {
  messageId: string;
  status: "saved";
}

export interface SendCustomerMessageInput {
  messageId: string;
  approvalToken: string;
}

export interface SendCustomerMessageResult {
  messageId: string;
  status: "sent";
}
