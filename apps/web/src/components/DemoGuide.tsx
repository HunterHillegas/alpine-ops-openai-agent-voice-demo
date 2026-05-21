export function DemoGuide({ connection, pendingApprovals, scenarioName, onConnect, onReplay }: {
  connection: string;
  pendingApprovals: number;
  scenarioName: string | undefined;
  onConnect: () => void;
  onReplay: () => void;
}) {
  const voiceLabel = connection === "live" || connection === "mock" ? "Disconnect voice" : "Connect voice";
  const approvalLabel = pendingApprovals === 1 ? "1 action" : `${pendingApprovals} actions`;

  return (
    <section className="demo-guide" aria-label="Demo runbook">
      <div className="guide-intro">
        <span>Demo runbook</span>
        <h2>Run the field-service voice agent in three moves.</h2>
      </div>
      <ol className="guide-steps">
        <li>
          <b>1</b>
          <div>
            <strong>Pick the dispatch case</strong>
            <p>{scenarioName ?? "Load a scenario from the header."}</p>
          </div>
        </li>
        <li>
          <b>2</b>
          <div>
            <strong>Send the agent work</strong>
            <p>Use live voice, typed fallback, or instant replay.</p>
            <div className="guide-actions">
              <button className="primary-action" onClick={onReplay}>Run selected replay</button>
              <button onClick={onConnect}>{voiceLabel}</button>
            </div>
          </div>
        </li>
        <li>
          <b>3</b>
          <div>
            <strong>Approve writes</strong>
            <p>{pendingApprovals ? `${approvalLabel} waiting in the bottom queue.` : "Writes appear in the bottom queue before they run."}</p>
          </div>
        </li>
      </ol>
    </section>
  );
}
