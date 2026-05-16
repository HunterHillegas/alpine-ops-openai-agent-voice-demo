import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApiApp } from "./app";

type Envelope<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
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
