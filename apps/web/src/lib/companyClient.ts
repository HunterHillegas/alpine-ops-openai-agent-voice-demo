import type { Approval, CompanyState, DemoScenario } from "@alpine/mock-data";

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
  createTicket: (payload: unknown) => post("/tickets", payload),
  updateTicket: (payload: unknown) => post("/tickets/update", payload),
  createWorkOrder: (payload: unknown) => post("/work-orders", payload),
  reservePart: (payload: unknown) => post("/inventory/reservations", payload),
  cancelAppointment: (payload: unknown) => post("/appointments/cancel", payload),
  createCreditMemo: (payload: unknown) => post("/billing/credits", payload),
  saveInternalNote: (payload: unknown) => post("/notes/internal", payload),
  createCaseSummary: (payload: { ticketId: string }) => post("/case-summaries", payload),
  saveCustomerMessage: (payload: unknown) => post("/messages/save", payload),
  sendCustomerMessage: (payload: unknown) => post("/messages/send", payload),
  realtimeSession: () => postRaw<RealtimeSessionResponse>("/realtime/session", {}),
  searchCustomers: (query: string) => request<unknown>(`/customers/search?q=${encodeURIComponent(query)}`),
  getCustomer: (customerId: string) => request<unknown>(`/customers/${encodeURIComponent(customerId)}`),
  getCustomerAssets: (customerId: string) => request<unknown>(`/customers/${encodeURIComponent(customerId)}/assets`),
  getOpenTickets: (customerId: string) => request<unknown>(`/customers/${encodeURIComponent(customerId)}/tickets/open`),
  getServiceHistory: (customerId: string) => request<unknown>(`/customers/${encodeURIComponent(customerId)}/service-history`),
  getAsset: (assetId: string) => request<unknown>(`/assets/${encodeURIComponent(assetId)}`),
  getAssetTelemetry: (assetId: string) => request<unknown>(`/assets/${encodeURIComponent(assetId)}/telemetry`),
  getKnownIssuePatterns: (productModel: string) => request<unknown>(`/known-issues?productModel=${encodeURIComponent(productModel)}`),
  checkFirmwareStatus: (assetId: string) => request<unknown>(`/assets/${encodeURIComponent(assetId)}/firmware`),
  estimateRepairPlan: (assetId: string) => request<unknown>(`/assets/${encodeURIComponent(assetId)}/repair-plan`),
  getWarrantyStatus: (assetId: string) => request<unknown>(`/warranty/${encodeURIComponent(assetId)}`),
  getPolicy: (policyId: string) => request<unknown>(`/policies/${encodeURIComponent(policyId)}`),
  checkPartInventory: (partId: string) => request<unknown>(`/inventory/${encodeURIComponent(partId)}`),
  findTechnicians: (params: { certification: string; region: string; partId?: string }) => {
    const searchParams = new URLSearchParams({ certification: params.certification, region: params.region });
    if (params.partId) searchParams.set("partId", params.partId);
    return request<unknown>(`/technicians?${searchParams}`);
  },
  requestHumanApproval: (payload: { action: string; summary: string; payload: unknown }) => post<Approval>("/approvals", payload),
  draftCustomerMessage: (payload: { customerId: string; workOrderId?: string; channel: "sms" | "email"; topic: string }) => post<unknown>("/messages/draft", payload)
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
