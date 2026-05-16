import { createSeedState, type CaseSummary } from "@alpine/mock-data";
import { describe, expect, it } from "vitest";
import { dispatchSummaryText, ticketIdForCustomerMessage } from "./dispatchSummary";

describe("dispatch summary helpers", () => {
  it("resolves the ticket behind a saved customer message", () => {
    const state = createSeedState();
    state.customerMessages.push({
      messageId: "MSG-1000",
      customerId: "cus_amelia_brooks",
      channel: "sms",
      body: "Dispatch update",
      status: "saved",
      createdAt: "2026-05-16T12:00:00-07:00"
    });

    expect(ticketIdForCustomerMessage(state, "MSG-1000")).toBe("TCK-1044");
  });

  it("formats the final browser-flow dispatch summary", () => {
    const state = createSeedState();
    state.workOrders.push({
      workOrderId: "WO-1000",
      ticketId: "TCK-1044",
      technicianId: "tech_marco_diaz",
      appointmentWindow: { windowId: "win_marco_1012", date: "2026-05-17", start: "10:00", end: "12:00", available: false },
      reservedParts: ["PCB-48A-R3"],
      customerChargeCents: 0,
      status: "scheduled"
    });
    state.customerMessages.push({
      messageId: "MSG-1000",
      customerId: "cus_amelia_brooks",
      channel: "sms",
      body: "Dispatch update",
      status: "sent",
      createdAt: "2026-05-16T12:00:00-07:00",
      sentAt: "2026-05-16T12:05:00-07:00"
    });

    expect(dispatchSummaryText(state, "MSG-1000")).toBe(
      "Amelia Brooks: TCK-1044 scheduled with Marco Diaz on 2026-05-17 10:00-12:00. Reserved PCB-48A-R3; customer message mock-sent."
    );
  });

  it("falls back to the generated case summary when local state is incomplete", () => {
    const summary: CaseSummary = {
      summaryId: "SUM-1000",
      ticketId: "TCK-1044",
      body: "TCK-1044: Charger offline after utility outage. Control-board replacement recommended.",
      createdAt: "2026-05-16T12:00:00-07:00"
    };

    expect(dispatchSummaryText(null, "MSG-404", summary)).toContain("Final case summary: TCK-1044");
  });
});
