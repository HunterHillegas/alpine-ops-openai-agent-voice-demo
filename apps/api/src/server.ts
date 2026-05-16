import Fastify from "fastify";
import { realtimeInstructions, realtimeModel } from "@alpine/agents";
import { createCompanyApi, delay } from "@alpine/company-api";
import { scenarios } from "@alpine/mock-data";

const app = Fastify({ logger: true });
const company = createCompanyApi();
const port = Number(process.env.PORT ?? 8787);

app.addHook("onRequest", async (request, reply) => {
  const origin = request.headers.origin;
  const allowedOrigin = origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ? origin
    : process.env.ALLOWED_ORIGIN ?? "http://localhost:5173";

  reply.header("access-control-allow-origin", allowedOrigin);
  reply.header("access-control-allow-methods", "GET,POST,OPTIONS");
  reply.header("access-control-allow-headers", "content-type,authorization");
});

app.options("*", async (_request, reply) => reply.status(204).send());

app.get("/health", async () => ({ ok: true, service: "alpine-fieldops-api" }));
app.get("/scenarios", async () => ({ ok: true, data: scenarios }));
app.get("/state", async () => ({ ok: true, data: company.getState() }));
app.get("/events", async () => ({ ok: true, data: company.getState().events }));

app.post<{ Body: { scenarioId?: string } }>("/reset", async (request) => ({ ok: true, data: company.reset(request.body?.scenarioId) }));

app.post<{ Params: { scenarioId: string } }>("/demo/replay/:scenarioId", async (request) => {
  await delay(120);
  return company.replayScenario(request.params.scenarioId);
});

app.get<{ Querystring: { q?: string } }>("/customers/search", async (request) => company.searchCustomers(request.query.q ?? ""));
app.get<{ Params: { customerId: string } }>("/customers/:customerId", async (request) => company.getCustomer(request.params.customerId));
app.get<{ Params: { customerId: string } }>("/customers/:customerId/assets", async (request) => company.getCustomerAssets(request.params.customerId));
app.get<{ Params: { customerId: string } }>("/customers/:customerId/tickets/open", async (request) => company.getOpenTickets(request.params.customerId));
app.get<{ Params: { customerId: string } }>("/customers/:customerId/service-history", async (request) => company.getServiceHistory(request.params.customerId));
app.get<{ Params: { assetId: string } }>("/assets/:assetId", async (request) => company.getAsset(request.params.assetId));
app.get<{ Params: { assetId: string } }>("/assets/:assetId/telemetry", async (request) => {
  await delay(180);
  return company.getAssetTelemetry(request.params.assetId);
});
app.get<{ Params: { assetId: string } }>("/assets/:assetId/firmware", async (request) => company.checkFirmwareStatus(request.params.assetId));
app.get<{ Params: { assetId: string } }>("/assets/:assetId/repair-plan", async (request) => company.estimateRepairPlan(request.params.assetId));
app.get<{ Querystring: { productModel?: string } }>("/known-issues", async (request) => company.getKnownIssuePatterns(request.query.productModel ?? ""));
app.get<{ Params: { assetId: string } }>("/warranty/:assetId", async (request) => company.getWarrantyStatus(request.params.assetId));
app.get<{ Params: { policyId: string } }>("/policies/:policyId", async (request) => company.getPolicy(request.params.policyId));
app.get<{ Params: { partId: string } }>("/inventory/:partId", async (request) => company.checkPartInventory(request.params.partId));
app.get<{ Querystring: { certification?: string; region?: string; partId?: string } }>("/technicians", async (request) =>
  company.findTechnicians({
    certification: request.query.certification ?? "charger_service",
    region: request.query.region ?? "Santa Barbara",
    ...(request.query.partId ? { partId: request.query.partId } : {})
  })
);

app.post<{ Body: { action: string; summary: string; payload: unknown } }>("/approvals", async (request) => ({
  ok: true,
  data: company.requestHumanApproval(request.body)
}));
app.post<{ Params: { approvalId: string } }>("/approvals/:approvalId/approve", async (request) => company.approve(request.params.approvalId));
app.post<{ Params: { approvalId: string } }>("/approvals/:approvalId/reject", async (request) => company.reject(request.params.approvalId));

app.post<{
  Body: {
    customerId: string;
    assetId: string;
    priority: "low" | "normal" | "high" | "urgent";
    summary: string;
    notes?: string[];
    approvalToken: string;
  };
}>("/tickets", async (request) => company.createTicket(request.body));
app.post<{
  Body: {
    ticketId: string;
    status?: "open" | "triaged" | "scheduled" | "cancelled" | "resolved";
    priority?: "low" | "normal" | "high" | "urgent";
    summary?: string;
    note?: string;
    approvalToken: string;
  };
}>("/tickets/update", async (request) => company.updateTicket(request.body));
app.post<{
  Body: {
    ticketId: string;
    technicianId: string;
    windowId: string;
    reservedParts: string[];
    customerChargeCents: number;
    approvalToken: string;
  };
}>("/work-orders", async (request) => company.createWorkOrder(request.body));
app.post<{ Body: { partId: string; quantity: number; approvalToken: string } }>("/inventory/reservations", async (request) => company.reservePart(request.body));
app.post<{ Body: { ticketId: string; approvalToken: string } }>("/appointments/cancel", async (request) => company.cancelAppointment(request.body));
app.post<{ Body: { customerId: string; amountCents: number; reason: string; approvalToken: string } }>("/billing/credits", async (request) => company.createCreditMemo(request.body));
app.post<{ Body: { customerId: string; workOrderId?: string; channel: "sms" | "email"; topic: string } }>("/messages/draft", async (request) => company.draftCustomerMessage(request.body));
app.post<{ Body: { ticketId: string; body: string; approvalToken: string } }>("/notes/internal", async (request) => company.saveInternalNote(request.body));
app.post<{ Body: { ticketId: string } }>("/case-summaries", async (request) => company.createCaseSummary(request.body));
app.post<{ Body: { customerId: string; channel: "sms" | "email"; body: string; approvalToken: string } }>("/messages/save", async (request) => company.saveCustomerMessage(request.body));
app.post<{ Body: { messageId: string; approvalToken: string } }>("/messages/send", async (request) => company.sendCustomerMessage(request.body));

app.post("/realtime/session", async (_request, reply) => {
  if (!process.env.OPENAI_API_KEY) {
    return reply.status(200).send({
      ok: true,
      mode: "mock",
      data: {
        client_secret: null,
        model: realtimeModel.model,
        instructions: realtimeInstructions,
        note: "Set OPENAI_API_KEY to mint an ephemeral realtime session."
      }
    });
  }

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
        headers: {
          authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "content-type": "application/json",
          "OpenAI-Safety-Identifier": "alpine-fieldops-demo-dispatcher"
        },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model: realtimeModel.model,
        instructions: realtimeInstructions,
        audio: {
          output: { voice: realtimeModel.voice }
        }
      }
    })
  });

  const payload = await response.json();
  return reply.status(response.status).send({ ok: response.ok, mode: "live", data: payload });
});

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
