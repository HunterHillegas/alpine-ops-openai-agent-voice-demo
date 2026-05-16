import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApiApp } from "./app";

type Envelope<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.unstubAllGlobals();
});

describe("api routes", () => {
  it("serves health and seeded state", async () => {
    app = buildApiApp({ logger: false });

    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ ok: true, service: "alpine-fieldops-api" });

    const state = await app.inject({ method: "GET", url: "/state" });
    expect(state.statusCode).toBe(200);
    expect(state.json<{ ok: true; data: { customers: unknown[]; assets: unknown[] } }>().data.customers).toHaveLength(4);
  });

  it("replays the main scenario without mutating writes before approval", async () => {
    app = buildApiApp({ logger: false });

    const replay = await app.inject({ method: "POST", url: "/demo/replay/dead-charger-outage" });
    const body = replay.json<Envelope<{ approvals: Array<{ action: string }>; workOrders: unknown[]; events: Array<{ label: string }> }>>();

    expect(replay.statusCode).toBe(200);
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    expect(body.data.workOrders).toHaveLength(0);
    expect(body.data.approvals[0]?.action).toBe("createWorkOrder");
    expect(body.data.events.map((event) => event.label)).toContain("Repair plan estimated");
  });

  it("requires an approved token before creating a work order through HTTP", async () => {
    app = buildApiApp({ logger: false });

    const denied = await app.inject({
      method: "POST",
      url: "/work-orders",
      payload: workOrderPayload("missing")
    });
    expect(denied.json<Envelope<unknown>>().ok).toBe(false);

    const approvalResponse = await app.inject({
      method: "POST",
      url: "/approvals",
      payload: {
        action: "createWorkOrder",
        summary: "Schedule Marco Diaz.",
        payload: workOrderPayload("")
      }
    });
    const approval = approvalResponse.json<{ ok: true; data: { approvalId: string; token: string } }>().data;
    await app.inject({ method: "POST", url: `/approvals/${approval.approvalId}/approve` });

    const outOfStock = await app.inject({
      method: "POST",
      url: "/work-orders",
      payload: { ...workOrderPayload(approval.token), reservedParts: ["INV-HOME20-R2"] }
    });
    expect(outOfStock.json<Envelope<unknown>>().ok).toBe(false);

    const created = await app.inject({
      method: "POST",
      url: "/work-orders",
      payload: workOrderPayload(approval.token)
    });
    const createdBody = created.json<Envelope<{ status: string; workOrderId: string }>>();
    const state = await app.inject({ method: "GET", url: "/state" });
    const stateBody = state.json<Envelope<{ inventory: Array<{ partId: string; quantity: number }>; events: Array<{ label: string }> }>>();

    expect(createdBody.ok).toBe(true);
    if (!createdBody.ok) return;
    expect(createdBody.data.status).toBe("scheduled");
    expect(createdBody.data.workOrderId).toMatch(/^WO-/);
    expect(expectOk(stateBody).inventory.find((part) => part.partId === "PCB-48A-R3")?.quantity).toBe(1);
    expect(expectOk(stateBody).events.map((event) => event.label)).toContain("Part reserved");
  });

  it("approval-gates ticket, inventory, billing, note, and message writes through HTTP", async () => {
    app = buildApiApp({ logger: false });

    const deniedReservation = await app.inject({
      method: "POST",
      url: "/inventory/reservations",
      payload: { partId: "PCB-48A-R3", quantity: 1, approvalToken: "missing" }
    });
    expect(deniedReservation.json<Envelope<unknown>>().ok).toBe(false);

    const reserve = await approve("reservePart", { partId: "PCB-48A-R3", quantity: 1 });
    const reserved = await app.inject({
      method: "POST",
      url: "/inventory/reservations",
      payload: { partId: "PCB-48A-R3", quantity: 1, approvalToken: reserve.token }
    });
    const reservedBody = expectOk(reserved.json<Envelope<{ quantity: number }>>());
    expect(reservedBody.quantity).toBe(1);

    const createTicket = await approve("createTicket", {
      customerId: "cus_amelia_brooks",
      assetId: "CHG-8821",
      priority: "high",
      summary: "Customer called back with outage details"
    });
    const createdTicket = await app.inject({
      method: "POST",
      url: "/tickets",
      payload: {
        customerId: "cus_amelia_brooks",
        assetId: "CHG-8821",
        priority: "high",
        summary: "Customer called back with outage details",
        approvalToken: createTicket.token
      }
    });
    const ticketBody = createdTicket.json<Envelope<{ ticketId: string; status: string }>>();
    expect(ticketBody.ok).toBe(true);
    if (!ticketBody.ok) return;

    const updateTicket = await approve("updateTicket", { ticketId: ticketBody.data.ticketId, status: "triaged", note: "Exact ID confirmed." });
    const updatedTicket = await app.inject({
      method: "POST",
      url: "/tickets/update",
      payload: { ticketId: ticketBody.data.ticketId, status: "triaged", note: "Exact ID confirmed.", approvalToken: updateTicket.token }
    });
    expect(expectOk(updatedTicket.json<Envelope<{ status: string }>>()).status).toBe("triaged");

    const cancel = await approve("cancelAppointment", { ticketId: "TCK-1048" });
    const cancelled = await app.inject({
      method: "POST",
      url: "/appointments/cancel",
      payload: { ticketId: "TCK-1048", approvalToken: cancel.token }
    });
    expect(expectOk(cancelled.json<Envelope<{ status: string }>>()).status).toBe("cancelled");

    const credit = await approve("createCreditMemo", { customerId: "cus_noah_reed", amountCents: 25000, reason: "Customer cancelled install." });
    const credited = await app.inject({
      method: "POST",
      url: "/billing/credits",
      payload: { customerId: "cus_noah_reed", amountCents: 25000, reason: "Customer cancelled install.", approvalToken: credit.token }
    });
    expect(expectOk(credited.json<Envelope<{ creditMemoId: string }>>()).creditMemoId).toMatch(/^CRM-/);

    const note = await approve("saveInternalNote", { ticketId: "TCK-1044", body: "Validated outage diagnostic path." });
    const savedNote = await app.inject({
      method: "POST",
      url: "/notes/internal",
      payload: { ticketId: "TCK-1044", body: "Validated outage diagnostic path.", approvalToken: note.token }
    });
    expect(expectOk(savedNote.json<Envelope<{ noteId: string }>>()).noteId).toMatch(/^NOTE-/);

    const draft = await app.inject({
      method: "POST",
      url: "/messages/draft",
      payload: { customerId: "cus_amelia_brooks", channel: "sms", topic: "warranty repair" }
    });
    expect(expectOk(draft.json<Envelope<{ body: string }>>()).body).toContain("Amelia");

    const saveMessage = await approve("saveCustomerMessage", { customerId: "cus_amelia_brooks", channel: "sms", body: "Repair scheduled." });
    const savedMessage = await app.inject({
      method: "POST",
      url: "/messages/save",
      payload: { customerId: "cus_amelia_brooks", channel: "sms", body: "Repair scheduled.", approvalToken: saveMessage.token }
    });
    const messageBody = savedMessage.json<Envelope<{ messageId: string; status: string }>>();
    const message = expectOk(messageBody);
    expect(message.status).toBe("saved");

    const sendMessage = await approve("sendCustomerMessage", { messageId: message.messageId });
    const sentMessage = await app.inject({
      method: "POST",
      url: "/messages/send",
      payload: { messageId: message.messageId, approvalToken: sendMessage.token }
    });
    expect(expectOk(sentMessage.json<Envelope<{ status: string }>>()).status).toBe("sent");
  });

  it("returns mock realtime mode without exposing server keys", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    app = buildApiApp({ logger: false });

    const response = await app.inject({ method: "POST", url: "/realtime/session" });
    const body = response.json<{ ok: true; mode: "mock"; data: { client_secret: null } }>();

    expect(response.statusCode).toBe(200);
    expect(body.mode).toBe("mock");
    expect(body.data.client_secret).toBeNull();

    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  });

  it("mints live realtime client secrets server-side without leaking the API key", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-server-side-only";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      id: "rt_test",
      client_secret: { value: "eph-client-secret" }
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    vi.stubGlobal("fetch", fetchMock);
    app = buildApiApp({ logger: false });

    const response = await app.inject({ method: "POST", url: "/realtime/session" });
    const body = response.json<{ ok: true; mode: "live"; data: { client_secret: { value: string } } }>();

    expect(response.statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.mode).toBe("live");
    expect(body.data.client_secret.value).toBe("eph-client-secret");
    expect(JSON.stringify(body)).not.toContain("sk-server-side-only");
    expect(fetchMock).toHaveBeenCalledOnce();

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) return;
    const [url, init] = firstCall as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const payload = JSON.parse(init.body as string) as { session: { model: string; instructions: string; audio: { output: { voice: string } } } };

    expect(url).toBe("https://api.openai.com/v1/realtime/client_secrets");
    expect(init.method).toBe("POST");
    expect(headers.authorization).toBe("Bearer sk-server-side-only");
    expect(headers["OpenAI-Safety-Identifier"]).toBe("alpine-fieldops-demo-dispatcher");
    expect(payload.session.model).toBe("gpt-realtime-2");
    expect(payload.session.instructions).toContain("Exact IDs");
    expect(payload.session.audio.output.voice).toBe("marin");

    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  });
});

async function approve(action: string, payload: unknown) {
  if (!app) throw new Error("API test app is not initialized.");
  const approvalResponse = await app.inject({
    method: "POST",
    url: "/approvals",
    payload: { action, summary: `Approve ${action}.`, payload }
  });
  const approval = approvalResponse.json<{ ok: true; data: { approvalId: string; token: string } }>().data;
  await app.inject({ method: "POST", url: `/approvals/${approval.approvalId}/approve` });
  return approval;
}

function expectOk<T>(envelope: Envelope<T>): T {
  expect(envelope.ok).toBe(true);
  if (!envelope.ok) throw new Error(envelope.message);
  return envelope.data;
}

function workOrderPayload(approvalToken: string) {
  return {
    ticketId: "TCK-1044",
    technicianId: "tech_marco_diaz",
    windowId: "win_marco_1012",
    reservedParts: ["PCB-48A-R3"],
    customerChargeCents: 0,
    approvalToken
  };
}
