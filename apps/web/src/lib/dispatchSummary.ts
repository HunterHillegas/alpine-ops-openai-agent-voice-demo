import type { CaseSummary, CompanyState } from "@alpine/mock-data";

export function ticketIdForCustomerMessage(state: CompanyState | null, messageId: string): string | undefined {
  const message = state?.customerMessages.find((item) => item.messageId === messageId);
  if (!message) return undefined;
  return state?.tickets.find((item) => item.customerId === message.customerId)?.ticketId;
}

export function dispatchSummaryText(state: CompanyState | null, messageId: string, summary?: CaseSummary): string {
  const message = state?.customerMessages.find((item) => item.messageId === messageId);
  const customer = state?.customers.find((item) => item.id === message?.customerId);
  const ticket = state?.tickets.find((item) => item.customerId === customer?.id);
  const workOrder = state?.workOrders.find((item) => item.ticketId === ticket?.ticketId);
  const technician = state?.technicians.find((item) => item.techId === workOrder?.technicianId);

  if (!customer || !ticket || !workOrder || !technician) {
    return summary
      ? `Mock customer message sent. Final case summary: ${summary.body}`
      : "Mock customer message sent. Dispatch record updated.";
  }

  const partList = workOrder.reservedParts.length ? workOrder.reservedParts.join(", ") : "no parts";
  return `${customer.name}: ${ticket.ticketId} scheduled with ${technician.name} on ${workOrder.appointmentWindow.date} ${workOrder.appointmentWindow.start}-${workOrder.appointmentWindow.end}. Reserved ${partList}; customer message mock-sent.`;
}
