import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { realtimeModel } from "@alpine/agents";
import { scenarioTranscripts, type Approval, type CompanyState, type DemoScenario, type EventLogEntry, type TranscriptTurn } from "@alpine/mock-data";
import { companyClient } from "./lib/companyClient";
import type { AlpineRealtimeConsole, VoiceConnection } from "./lib/realtimeConsole";
import "./styles.css";
import "./cockpit.css";

function App() {
  const [state, setState] = useState<CompanyState | null>(null);
  const [scenarios, setScenarios] = useState<DemoScenario[]>([]);
  const [scenarioId, setScenarioId] = useState("dead-charger-outage");
  const [connection, setConnection] = useState<VoiceConnection>("disconnected");
  const [userText, setUserText] = useState("");
  const [assistantText, setAssistantText] = useState("Ready for a dispatch request. Load a scenario or connect voice.");
  const [transcriptTurns, setTranscriptTurns] = useState<TranscriptTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const realtimeRef = useRef<AlpineRealtimeConsole | null>(null);

  useEffect(() => {
    void refresh();
    void companyClient.scenarios().then(setScenarios).catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => () => realtimeRef.current?.disconnect(), []);

  const selectedScenario = scenarios.find((scenario) => scenario.id === scenarioId);
  const customer = useMemo(() => {
    if (!state) return undefined;
    if (selectedScenario?.primaryCustomerId) {
      return state.customers.find((item) => item.id === selectedScenario.primaryCustomerId);
    }
    if (selectedScenario?.primaryAssetId) {
      const scenarioAsset = state.assets.find((item) => item.assetId === selectedScenario.primaryAssetId);
      return state.customers.find((item) => item.id === scenarioAsset?.customerId);
    }
    return state.customers.find((item) => item.id === "cus_amelia_brooks") ?? state.customers[0];
  }, [state, selectedScenario]);
  const asset = useMemo(() => {
    if (selectedScenario?.primaryAssetId) {
      return state?.assets.find((item) => item.assetId === selectedScenario.primaryAssetId);
    }
    return state?.assets.find((item) => item.customerId === customer?.id);
  }, [state, customer, selectedScenario]);
  const ticket = useMemo(() => state?.tickets.find((item) => item.assetId === asset?.assetId) ?? state?.tickets.find((item) => item.customerId === customer?.id), [state, customer, asset]);
  const telemetry = useMemo(() => state?.telemetry.filter((point) => point.assetId === asset?.assetId) ?? [], [state, asset]);
  const pendingApprovals = state?.approvals.filter((approval) => approval.status === "pending") ?? [];

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
    setTranscriptTurns([]);
    setAssistantText("Demo data reset. Scenario seed restored.");
  }

  async function replay() {
    const next = await companyClient.replay(scenarioId);
    const replayTranscript = scenarioTranscripts[scenarioId] ?? [];
    setState(next);
    setTranscriptTurns(replayTranscript);
    setAssistantText(replayTranscript.findLast((turn) => turn.speaker === "assistant")?.text ?? next.events[0]?.label ?? "Scenario replay loaded.");
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
    if (approved.action === "createTicket") {
      await companyClient.createTicket({ ...(approved.payload as object), approvalToken: approved.token });
    }
    if (approved.action === "updateTicket") {
      await companyClient.updateTicket({ ...(approved.payload as object), approvalToken: approved.token });
    }
    if (approved.action === "createWorkOrder") {
      await companyClient.createWorkOrder({ ...(approved.payload as object), approvalToken: approved.token });
    }
    if (approved.action === "cancelAppointment") {
      await companyClient.cancelAppointment({ ...(approved.payload as object), approvalToken: approved.token });
    }
    if (approved.action === "createCreditMemo") {
      await companyClient.createCreditMemo({ ...(approved.payload as object), approvalToken: approved.token });
    }
    if (approved.action === "saveInternalNote") {
      await companyClient.saveInternalNote({ ...(approved.payload as object), approvalToken: approved.token });
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
    setAssistantText(`${approved.action} completed in the mock system.`);
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
          transcriptTurns={transcriptTurns}
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
  transcriptTurns: TranscriptTurn[];
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
      {props.transcriptTurns.length > 0 && (
        <div className="transcript transcript-feed">
          <label>Replay transcript</label>
          {props.transcriptTurns.map((turn, index) => (
            <p key={turn.speaker + index}><b>{turn.speaker}</b>{turn.text}</p>
          ))}
        </div>
      )}
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
  const likelyPartId = asset?.productModel.includes("AlpineVault Home 20") ? "INV-HOME20-R2" : "PCB-48A-R3";
  const part = state.inventory.find((item) => item.partId === likelyPartId);
  const tech = state.technicians.find((item) => item.vanInventory.includes(likelyPartId)) ?? state.technicians.find((item) => item.region === "Santa Barbara");
  const workOrder = state.workOrders.find((item) => item.ticketId === ticket?.ticketId) ?? state.workOrders[0];
  const customerMessages = state.customerMessages.filter((message) => message.customerId === customer?.id);
  const internalNotes = state.internalNotes.filter((note) => note.ticketId === ticket?.ticketId);
  const caseSummaries = state.caseSummaries.filter((summary) => summary.ticketId === ticket?.ticketId);
  const warrantyPolicy = state.policies.find((policy) => policy.policyId === "warranty-standard");
  const cancellationPolicy = state.policies.find((policy) => policy.policyId === "cancellation-refund");
  const schedule = tech?.schedule ?? [];

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
        <InfoPanel title="Inventory" value={part ? `${part.quantity} local` : "Unknown"} meta={likelyPartId}>
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

        <section className="policy-panel">
          <div className="panel-heading">
            <span>Policy notes</span>
            <strong>{warrantyActive ? warrantyPolicy?.policyId : cancellationPolicy?.policyId}</strong>
          </div>
          <p>{warrantyActive ? warrantyPolicy?.summary : cancellationPolicy?.summary}</p>
          <ul>
            {(warrantyActive ? warrantyPolicy?.rules : cancellationPolicy?.rules)?.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        </section>

        <section className="schedule-panel">
          <div className="panel-heading">
            <span>Technician schedule</span>
            <strong>{tech?.name ?? "Unassigned"}</strong>
          </div>
          <ul>
            {schedule.map((window) => (
              <li key={window.windowId}>
                <b>{window.start}-{window.end}</b>
                <span>{window.available ? "available" : "booked"} · {window.date}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="plan-panel">
          <div className="panel-heading">
            <span>Work-order plan</span>
            <strong>{workOrder?.workOrderId ?? "proposal"}</strong>
          </div>
          <p>{tech?.name ?? "Qualified technician"} · tomorrow 10:00-12:00 · {likelyPartId === "PCB-48A-R3" ? "control-board replacement" : "battery inverter diagnosis"} · {warrantyActive ? "warranty charge $0" : "charge estimate required"}.</p>
          <div className="follow-up">
            <span>Customer follow-up draft</span>
            <p>Hi {customer?.name.split(" ")[0] ?? "there"}, Alpine FieldOps found {warrantyActive ? "an active warranty" : "an expired warranty"} and {part?.quantity ? "local part availability" : "no local stock for the likely part"}. We can follow up with the next safe dispatch option.</p>
          </div>
          <div className="message-ledger">
            <span>Mock records</span>
            {caseSummaries.map((summary) => <p key={summary.summaryId}><b>summary</b> · {summary.body}</p>)}
            {internalNotes.map((note) => <p key={note.noteId}><b>note</b> · {note.body}</p>)}
            {customerMessages.map((message) => <p key={message.messageId}><b>{message.status}</b> · {message.channel} · {message.body}</p>)}
            {!caseSummaries.length && !internalNotes.length && !customerMessages.length && <p>No saved notes, summaries, or customer messages.</p>}
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
            {event.args && <code className="event-args">{formatEventArgs(event.args)}</code>}
            {event.resultSummary && <small>{event.resultSummary}</small>}
            {event.approvalStatus && <small>{event.approvalStatus}</small>}
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

function formatEventArgs(args: Record<string, unknown>) {
  const text = JSON.stringify(args, null, 2);
  return text.length > 360 ? `${text.slice(0, 357)}...` : text;
}

createRoot(document.getElementById("root")!).render(<App />);
