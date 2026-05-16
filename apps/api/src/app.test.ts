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

    const created = await app.inject({
      method: "POST",
      url: "/work-orders",
      payload: workOrderPayload(approval.token)
    });
    const createdBody = created.json<Envelope<{ status: string; workOrderId: string }>>();

    expect(createdBody.ok).toBe(true);
    if (!createdBody.ok) return;
    expect(createdBody.data.status).toBe("scheduled");
    expect(createdBody.data.workOrderId).toMatch(/^WO-/);
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
