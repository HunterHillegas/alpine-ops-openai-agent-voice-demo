import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { realtimeModel } from "@alpine/agents";
import type { Approval, CompanyState, DemoScenario, EventLogEntry } from "@alpine/mock-data";
import { companyClient } from "./lib/companyClient";
import type { AlpineRealtimeConsole, VoiceConnection } from "./lib/realtimeConsole";
import "./styles.css";

function App() {
  const [state, setState] = useState<CompanyState | null>(null);
  const [scenarios, setScenarios] = useState<DemoScenario[]>([]);
  const [scenarioId, setScenarioId] = useState("dead-charger-outage");
  const [connection, setConnection] = useState<VoiceConnection>("disconnected");
  const [userText, setUserText] = useState("");
  const [assistantText, setAssistantText] = useState("Ready for a dispatch request. Load a scenario or connect voice.");
  const [error, setError] = useState<string | null>(null);
  const realtimeRef = useRef<AlpineRealtimeConsole | null>(null);

  useEffect(() => {
    void refresh();
    void companyClient.scenarios().then(setScenarios).catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => () => realtimeRef.current?.disconnect(), []);

  const customer = useMemo(() => state?.customers.find((item) => item.id === "cus_amelia_brooks") ?? state?.customers[0], [state]);
  const asset = useMemo(() => state?.assets.find((item) => item.customerId === customer?.id), [state, customer]);
  const ticket = useMemo(() => state?.tickets.find((item) => item.customerId === customer?.id), [state, customer]);
  const telemetry = useMemo(() => state?.telemetry.filter((point) => point.assetId === asset?.assetId) ?? [], [state, asset]);
  const pendingApprovals = state?.approvals.filter((approval) => approval.status === "pending") ?? [];
  const selectedScenario = scenarios.find((scenario) => scenario.id === scenarioId);

  async function refresh() {
    const next = await companyClient.state();
    setState(next);
  }

  async function connectVoice() {
    setError(null);
    try {
      if (connection === "live" || connection === "mock") {
        realtimeRef.current?.disconnect();
        return;
      }
      const realtime = await getRealtimeConsole();
      await realtime.connect();
    } catch (err) {
      setConnection("disconnected");
      setError(err instanceof Error ? err.message : "Unable to connect realtime session.");
    }
  }

  async function resetDemo() {
    const next = await companyClient.reset(scenarioId);
    setState(next);
    setAssistantText("Demo data reset. Scenario seed restored.");
  }

  async function replay() {
    const next = await companyClient.replay(scenarioId);
    setState(next);
    setAssistantText(next.events[0]?.label ?? "Scenario replay loaded.");
  }

  async function submitTextFallback(event: React.FormEvent) {
    event.preventDefault();
    if (!userText.trim()) return;
    const realtime = await getRealtimeConsole();
    realtime.sendText(userText);
    setUserText("");
  }

  async function getRealtimeConsole() {
    if (realtimeRef.current) return realtimeRef.current;

    const { AlpineRealtimeConsole } = await import("./lib/realtimeConsole");
    realtimeRef.current = new AlpineRealtimeConsole({
      onConnectionChange: setConnection,
      onAssistantText: setAssistantText,
      onUserText: setUserText,
      onError: setError,
      onRefreshState: refresh
    });

    return realtimeRef.current;
  }

  async function approveAndRun(approval: Approval) {
    const approved = await companyClient.approve(approval.approvalId);
    if (approved.action === "createWorkOrder") {
      await companyClient.createWorkOrder({ ...(approved.payload as object), approvalToken: approved.token });
    }
    if (approved.action === "cancelAppointment") {
      await companyClient.cancelAppointment({ ...(approved.payload as object), approvalToken: approved.token });
    }
    if (approved.action === "createCreditMemo") {
      await companyClient.createCreditMemo({ ...(approved.payload as object), approvalToken: approved.token });
    }
    if (approved.action === "reservePart") {
      await companyClient.reservePart({ ...(approved.payload as object), approvalToken: approved.token });
    }
    if (approved.action === "saveCustomerMessage") {
      await companyClient.saveCustomerMessage({ ...(approved.payload as object), approvalToken: approved.token });
    }
    if (approved.action === "sendCustomerMessage") {
      await companyClient.sendCustomerMessage({ ...(approved.payload as object), approvalToken: approved.token });
    }
    await refresh();
  }

  async function reject(approval: Approval) {
    await companyClient.reject(approval.approvalId);
    await refresh();
  }

  if (!state) {
    return <main className="boot">Alpine FieldOps booting console...</main>;
  }

  return (
    <main className="app-shell">
      <TopBar
        connection={connection}
        scenarioId={scenarioId}
        scenarios={scenarios}
        setScenarioId={setScenarioId}
        onConnect={connectVoice}
        onReset={resetDemo}
        onReplay={replay}
      />

      {error && <div className="error-banner">{error}</div>}

      <section className="console-grid">
        <VoicePanel
          connection={connection}
          userText={userText}
          setUserText={setUserText}
          assistantText={assistantText}
          selectedScenario={selectedScenario}
          onSubmitTextFallback={submitTextFallback}
        />
        <CaseWorkspace customer={customer} asset={asset} ticket={ticket} telemetry={telemetry} state={state} />
        <ActivityRail events={state.events} />
      </section>

      <ApprovalDrawer approvals={pendingApprovals} onApprove={approveAndRun} onReject={reject} />
    </main>
  );
}

function TopBar(props: {
  connection: string;
  scenarioId: string;
  scenarios: DemoScenario[];
  setScenarioId: (id: string) => void;
  onConnect: () => void;
  onReset: () => void;
  onReplay: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">AF</div>
        <div>
          <h1>Alpine FieldOps</h1>
          <p>Voice Console</p>
        </div>
      </div>
      <div className="topbar-controls">
        <span className={`status-pill ${props.connection}`}>{props.connection}</span>
        <span className="model-pill">{realtimeModel.model} · {realtimeModel.reasoning.effort}</span>
        <select value={props.scenarioId} onChange={(event) => props.setScenarioId(event.target.value)} aria-label="Load scenario">
          {props.scenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>{scenario.name}</option>
          ))}
        </select>
        <button onClick={props.onReplay}>Run replay</button>
        <button onClick={props.onReset}>Reset data</button>
        <button className="primary-action" onClick={props.onConnect}>{props.connection === "live" || props.connection === "mock" ? "Disconnect" : "Connect voice"}</button>
      </div>
    </header>
  );
}

function VoicePanel(props: {
  connection: string;
  userText: string;
  setUserText: (value: string) => void;
  assistantText: string;
  selectedScenario: DemoScenario | undefined;
  onSubmitTextFallback: (event: React.FormEvent) => void;
}) {
  return (
    <section className="panel voice-panel">
      <div className="panel-heading">
        <span>Live voice</span>
        <strong>{props.connection === "live" ? "WebRTC" : "Demo mode"}</strong>
      </div>
      <div className={`voice-orb ${props.connection}`}>
        <span />
        <b>48A</b>
      </div>
      <div className="mic-row">
        <button className="control-button">Push to talk</button>
        <button className="control-button secondary">Open mic</button>
      </div>
      <div className="transcript">
        <label>User transcript</label>
        <p>{props.selectedScenario?.openingPrompt ?? "No scenario loaded."}</p>
      </div>
      <div className="transcript assistant">
        <label>Assistant spoken response</label>
        <p>{props.assistantText}</p>
      </div>
      <form className="fallback-form" onSubmit={props.onSubmitTextFallback}>
        <input value={props.userText} onChange={(event) => props.setUserText(event.target.value)} placeholder="Text fallback for no-mic testing" />
        <button>Send</button>
      </form>
    </section>
  );
}

function CaseWorkspace({ customer, asset, ticket, telemetry, state }: {
  customer: CompanyState["customers"][number] | undefined;
  asset: CompanyState["assets"][number] | undefined;
  ticket: CompanyState["tickets"][number] | undefined;
  telemetry: CompanyState["telemetry"];
  state: CompanyState;
}) {
  const warrantyActive = asset ? new Date(asset.warrantyExpiration) >= new Date("2026-05-16") : false;
  const part = state.inventory.find((item) => item.partId === "PCB-48A-R3");
  const tech = state.technicians.find((item) => item.techId === "tech_marco_diaz");
  const workOrder = state.workOrders[0];

  return (
    <section className="workspace">
      <div className="workspace-header">
        <div>
          <h2>Active case workspace</h2>
          <p>{ticket?.summary ?? "No active ticket selected"}</p>
        </div>
        <span className="priority">{ticket?.priority ?? "normal"}</span>
      </div>

      <div className="workspace-grid">
        <InfoPanel title="Customer" value={customer?.name} meta={customer?.address}>
          <dl>
            <div><dt>Phone</dt><dd>{customer?.phone}</dd></div>
            <div><dt>Email</dt><dd>{customer?.email}</dd></div>
            <div><dt>Contact</dt><dd>{customer?.preferredContact}</dd></div>
          </dl>
        </InfoPanel>
        <InfoPanel title="Asset" value={asset?.assetId} meta={asset?.productModel}>
          <dl>
            <div><dt>Status</dt><dd>{asset?.status}</dd></div>
            <div><dt>Firmware</dt><dd>{asset?.firmwareVersion}</dd></div>
            <div><dt>Install</dt><dd>{asset?.installDate}</dd></div>
          </dl>
        </InfoPanel>
        <InfoPanel title="Warranty" value={warrantyActive ? "Active" : "Expired"} meta={asset?.warrantyExpiration}>
          <p className="plain-note">{warrantyActive ? "Parts and labor covered when telemetry supports hardware failure." : "Estimate customer charge before scheduling."}</p>
        </InfoPanel>
        <InfoPanel title="Inventory" value={part ? `${part.quantity} local` : "Unknown"} meta="PCB-48A-R3">
          <p className="plain-note">{part?.partName}</p>
        </InfoPanel>
      </div>

      <div className="lower-grid">
        <section className="chart-panel">
          <div className="panel-heading">
            <span>Recent telemetry</span>
            <strong>{telemetry.length} points</strong>
          </div>
          <div className="telemetry-chart">
            {telemetry.map((point) => (
              <div className="bar" key={point.timestamp} style={{ height: `${Math.max(18, point.voltage / 2.4)}%` }}>
                <span>{point.voltage}V</span>
              </div>
            ))}
          </div>
          <p className="chart-caption">{telemetry[0]?.faultType ?? "No fault"} · {telemetry[0]?.firmwareWarnings.join(", ") ?? "no warnings"}</p>
        </section>

        <section className="timeline-panel">
          <div className="panel-heading">
            <span>Service timeline</span>
            <strong>{ticket?.ticketId}</strong>
          </div>
          <ol>
            <li><span>07:45</span>Outage recovery attempted</li>
            <li><span>08:00</span>Voltage drop and ground-fault loop</li>
            <li><span>Now</span>Dispatch proposal pending approval</li>
          </ol>
        </section>

        <section className="plan-panel">
          <div className="panel-heading">
            <span>Work-order plan</span>
            <strong>{workOrder?.workOrderId ?? "proposal"}</strong>
          </div>
          <p>{tech?.name ?? "Qualified technician"} · tomorrow 10:00-12:00 · control-board replacement · warranty charge $0.</p>
          <div className="follow-up">
            <span>Customer follow-up draft</span>
            <p>Hi Amelia, Alpine FieldOps found an active warranty and likely control-board fault. We can send Marco tomorrow between 10:00 and 12:00 with the needed part.</p>
          </div>
        </section>
      </div>
    </section>
  );
}

function InfoPanel({ title, value, meta, children }: { title: string; value: string | undefined; meta: string | undefined; children: React.ReactNode }) {
  return (
    <article className="info-panel">
      <span>{title}</span>
      <h3>{value ?? "—"}</h3>
      <p>{meta ?? "No data"}</p>
      {children}
    </article>
  );
}

function ActivityRail({ events }: { events: EventLogEntry[] }) {
  return (
    <aside className="panel activity-rail">
      <div className="panel-heading">
        <span>Agent activity</span>
        <strong>{events.length} events</strong>
      </div>
      <div className="event-list">
        {events.map((event) => (
          <article className={`event-card ${event.type}`} key={event.eventId}>
            <div>
              <time>{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
              <b>{event.agentName}</b>
            </div>
            <h4>{event.label}</h4>
            <p>{event.toolName ?? event.handoffTarget ?? event.type}</p>
            {event.resultSummary && <small>{event.resultSummary}</small>}
            {event.error && <small className="event-error">{event.error}</small>}
          </article>
        ))}
      </div>
    </aside>
  );
}

function ApprovalDrawer({ approvals, onApprove, onReject }: { approvals: Approval[]; onApprove: (approval: Approval) => void; onReject: (approval: Approval) => void }) {
  return (
    <section className="approval-drawer">
      <div>
        <span>Approval queue</span>
        <strong>{approvals.length ? `${approvals.length} pending` : "No pending side effects"}</strong>
      </div>
      <div className="approval-list">
        {approvals.length === 0 ? (
          <p>Read-only lookups can run automatically. Scheduling, cancellation, refund, part reservation, and message send wait here.</p>
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

createRoot(document.getElementById("root")!).render(<App />);
