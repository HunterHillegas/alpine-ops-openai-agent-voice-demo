import type {
  Asset,
  Approval,
  CaseSummary,
  CompanyState,
  Customer,
  DemoScenario,
  InternalNote,
  InventoryItem,
  KnownIssuePattern,
  Technician,
  TelemetryPoint,
  Ticket,
  WorkOrder
} from "@alpine/mock-data";
import type {
  CancelAppointmentInput,
  CreateCreditMemoInput,
  CreateTicketInput,
  CreateWorkOrderInput,
  CreditMemoResult,
  DraftCustomerMessageInput,
  DraftCustomerMessageResult,
  FirmwareStatus,
  RepairPlan,
  RequestHumanApprovalInput,
  ReservePartInput,
  SaveCustomerMessageInput,
  SaveCustomerMessageResult,
  SaveInternalNoteInput,
  SendCustomerMessageInput,
  SendCustomerMessageResult,
  UpdateTicketInput
} from "@alpine/company-api";

export const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

type ApiEnvelope<T> = { ok: true; data: T; mode?: string } | { ok: false; code?: string; message?: string; data?: T; mode?: string };

export interface RealtimeSessionResponse {
  mode: "live" | "mock";
  data: unknown;
}

export const companyClient = {
  state: () => request<CompanyState>("/state"),
  scenarios: () => request<DemoScenario[]>("/scenarios"),
  reset: (scenarioId?: string) => post<CompanyState>("/reset", { scenarioId }),
  replay: (scenarioId: string) => post<CompanyState>(`/demo/replay/${scenarioId}`, {}),
  approve: (approvalId: string) => post<Approval>(`/approvals/${approvalId}/approve`, {}),
  reject: (approvalId: string) => post<Approval>(`/approvals/${approvalId}/reject`, {}),
  createTicket: (payload: CreateTicketInput) => post<Ticket>("/tickets", payload),
  updateTicket: (payload: UpdateTicketInput) => post<Ticket>("/tickets/update", payload),
  createWorkOrder: (payload: CreateWorkOrderInput) => post<WorkOrder>("/work-orders", payload),
  reservePart: (payload: ReservePartInput) => post<InventoryItem>("/inventory/reservations", payload),
  cancelAppointment: (payload: CancelAppointmentInput) => post<Ticket>("/appointments/cancel", payload),
  createCreditMemo: (payload: CreateCreditMemoInput) => post<CreditMemoResult>("/billing/credits", payload),
  saveInternalNote: (payload: SaveInternalNoteInput) => post<InternalNote>("/notes/internal", payload),
  createCaseSummary: (payload: { ticketId: string }) => post<CaseSummary>("/case-summaries", payload),
  saveCustomerMessage: (payload: SaveCustomerMessageInput) => post<SaveCustomerMessageResult>("/messages/save", payload),
  sendCustomerMessage: (payload: SendCustomerMessageInput) => post<SendCustomerMessageResult>("/messages/send", payload),
  realtimeSession: () => postRaw<RealtimeSessionResponse>("/realtime/session", {}),
  searchCustomers: (query: string) => request<Customer[]>(`/customers/search?q=${encodeURIComponent(query)}`),
  getCustomer: (customerId: string) => request<Customer>(`/customers/${encodeURIComponent(customerId)}`),
  getCustomerAssets: (customerId: string) => request<Asset[]>(`/customers/${encodeURIComponent(customerId)}/assets`),
  getOpenTickets: (customerId: string) => request<Ticket[]>(`/customers/${encodeURIComponent(customerId)}/tickets/open`),
  getServiceHistory: (customerId: string) => request<CompanyState["serviceHistory"]>(`/customers/${encodeURIComponent(customerId)}/service-history`),
  getAsset: (assetId: string) => request<Asset>(`/assets/${encodeURIComponent(assetId)}`),
  getAssetTelemetry: (assetId: string) => request<TelemetryPoint[]>(`/assets/${encodeURIComponent(assetId)}/telemetry`),
  getKnownIssuePatterns: (productModel: string) => request<KnownIssuePattern[]>(`/known-issues?productModel=${encodeURIComponent(productModel)}`),
  checkFirmwareStatus: (assetId: string) => request<FirmwareStatus>(`/assets/${encodeURIComponent(assetId)}/firmware`),
  estimateRepairPlan: (assetId: string) => request<RepairPlan>(`/assets/${encodeURIComponent(assetId)}/repair-plan`),
  getWarrantyStatus: (assetId: string) => request<{ active: boolean; expiration: string; summary: string }>(`/warranty/${encodeURIComponent(assetId)}`),
  getPolicy: (policyId: string) => request<{ policyId: string; title: string; summary: string; rules: string[] }>(`/policies/${encodeURIComponent(policyId)}`),
  checkPartInventory: (partId: string) => request<InventoryItem>(`/inventory/${encodeURIComponent(partId)}`),
  findTechnicians: (params: { certification: string; region: string; partId?: string }) => {
    const searchParams = new URLSearchParams({ certification: params.certification, region: params.region });
    if (params.partId) searchParams.set("partId", params.partId);
    return request<Technician[]>(`/technicians?${searchParams}`);
  },
  requestHumanApproval: (payload: RequestHumanApprovalInput) => post<Approval>("/approvals", payload),
  draftCustomerMessage: (payload: DraftCustomerMessageInput) => post<DraftCustomerMessageResult>("/messages/draft", payload)
};

export async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`);
  return unwrap<T>(await response.json());
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return unwrap<T>(await response.json());
}

async function postRaw<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as T;
  if (!response.ok) throw new Error(JSON.stringify(payload));
  return payload;
}

function unwrap<T>(payload: ApiEnvelope<T>): T {
  if (!payload.ok) throw new Error(payload.message ?? payload.code ?? "API request failed");
  return payload.data as T;
}
