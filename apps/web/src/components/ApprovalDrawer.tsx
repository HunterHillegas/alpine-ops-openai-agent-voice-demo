import type { Approval } from "@alpine/mock-data";

export function ApprovalDrawer({ approvals, onApprove, onReject }: { approvals: Approval[]; onApprove: (approval: Approval) => void; onReject: (approval: Approval) => void }) {
  return (
    <section className="approval-drawer">
      <div>
        <span>Approval queue</span>
        <strong>{approvals.length ? `${approvals.length} pending` : "No pending side effects"}</strong>
      </div>
      <div className="approval-list">
        {approvals.length === 0 ? (
          <p>Read-only lookups can run automatically. Ticket writes, internal notes, scheduling, cancellation, refund, part reservation, and message send wait here.</p>
        ) : approvals.map((approval) => (
          <article key={approval.approvalId}>
            <b>{approval.action}</b>
            <p>{approval.summary}</p>
            <button onClick={() => onApprove(approval)}>Approve and run</button>
            <button className="secondary" onClick={() => onReject(approval)}>Reject</button>
          </article>
        ))}
      </div>
    </section>
  );
}
