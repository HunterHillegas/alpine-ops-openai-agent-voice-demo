import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { scenarioTranscripts, type Approval, type CompanyState, type DemoScenario, type TranscriptTurn } from "@alpine/mock-data";
import { ActivityRail } from "./components/ActivityRail";
import { TopBar, type ThemeId } from "./components/TopBar";
import { companyClient } from "./lib/companyClient";
import { scenarioForTextFallback } from "./lib/mockTextFallback";
import type { AlpineRealtimeConsole, VoiceConnection } from "./lib/realtimeConsole";
import "./styles.css";
import "./cockpit.css";
import "./themes.css";

function App() {
  const [state, setState] = useState<CompanyState | null>(null);
  const [scenarios, setScenarios] = useState<DemoScenario[]>([]);
  const [scenarioId, setScenarioId] = useState("dead-charger-outage");
  const [theme, setTheme] = useState<ThemeId>("nextstep");
  const [connection, setConnection] = useState<VoiceConnection>("disconnected");
  const [userText, setUserText] = useState("");
  const [assistantText, setAssistantText] = useState("Ready for a dispatch request. Load a scenario or connect voice.");
  const [transcriptTurns, setTranscriptTurns] = useState<TranscriptTurn[]>([]);
  const [micMode, setMicMode] = useState<"push-to-talk" | "open-mic">("push-to-talk");
  const [bargeInStatus, setBargeInStatus] = useState("Idle");
  const [error, setError] = useState<string | null>(null);
  const realtimeRef = useRef<AlpineRealtimeConsole | null>(null);

  useEffect(() => {
    void refresh();
    void companyClient.scenarios().then(setScenarios).catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => () => realtimeRef.current?.disconnect(), []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);

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
    setBargeInStatus("Idle");
    setAssistantText("Demo data reset. Scenario seed restored.");
  }

  async function replay() {
    const next = await companyClient.replay(scenarioId);
    const replayTranscript = scenarioTranscripts[scenarioId] ?? [];
    setState(next);
    setTranscriptTurns(replayTranscript);
    setBargeInStatus("No interruption during replay.");
    setAssistantText(replayTranscript.findLast((turn) => turn.speaker === "assistant")?.text ?? next.events[0]?.label ?? "Scenario replay loaded.");
  }

  async function submitTextFallback(event: React.FormEvent) {
    event.preventDefault();
    const message = userText.trim();
    if (!message) return;
    setUserText("");
    if (connection === "live") {
      const realtime = await getRealtimeConsole();
      realtime.sendText(message);
      return;
    }

    const fallbackScenarioId = scenarioForTextFallback(message, scenarioId);
    setScenarioId(fallbackScenarioId);
    const next = await companyClient.replay(fallbackScenarioId);
    const replayTranscript = scenarioTranscripts[fallbackScenarioId] ?? [];
    setState(next);
    setTranscriptTurns([{ speaker: "dispatcher", text: message }, ...replayTranscript]);
    setBargeInStatus("Text fallback replay.");
    setAssistantText(replayTranscript.findLast((turn) => turn.speaker === "assistant")?.text ?? next.events[0]?.label ?? "Text fallback replay loaded.");
  }

  async function getRealtimeConsole() {
    if (realtimeRef.current) return realtimeRef.current;

    const { AlpineRealtimeConsole } = await import("./lib/realtimeConsole");
    realtimeRef.current = new AlpineRealtimeConsole({
      onConnectionChange: setConnection,
      onAssistantText: setAssistantText,
      onUserText: setUserText,
      onError: setError,
      onInterruption: setBargeInStatus,
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
      const workOrder = await companyClient.createWorkOrder({ ...(approved.payload as object), approvalToken: approved.token }) as { workOrderId: string };
      const workOrderPayload = approved.payload as { ticketId?: string };
      const ticketForMessage = state?.tickets.find((item) => item.ticketId === workOrderPayload.ticketId);
      if (ticketForMessage) {
        const draft = await companyClient.draftCustomerMessage({
          customerId: ticketForMessage.customerId,
          workOrderId: workOrder.workOrderId,
          channel: "sms",
          topic: "scheduled warranty repair"
        }) as { body: string };
        await companyClient.requestHumanApproval({
          action: "saveCustomerMessage",
          summary: "Save the customer SMS draft for the approved dispatch.",
          payload: { customerId: ticketForMessage.customerId, channel: "sms", body: draft.body }
        });
      }
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
      const savedMessage = await companyClient.saveCustomerMessage({ ...(approved.payload as object), approvalToken: approved.token }) as { messageId: string };
      await companyClient.requestHumanApproval({
        action: "sendCustomerMessage",
        summary: "Mock-send the saved customer SMS.",
        payload: { messageId: savedMessage.messageId }
      });
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
    return <main className="boot" data-theme={theme}>Alpine FieldOps booting console...</main>;
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <TopBar
        connection={connection}
        scenarioId={scenarioId}
        scenarios={scenarios}
        setScenarioId={setScenarioId}
        theme={theme}
        setTheme={setTheme}
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
          micMode={micMode}
          setMicMode={setMicMode}
          bargeInStatus={bargeInStatus}
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

function VoicePanel(props: {
  connection: string;
  userText: string;
  setUserText: (value: string) => void;
  assistantText: string;
  transcriptTurns: TranscriptTurn[];
  micMode: "push-to-talk" | "open-mic";
  setMicMode: (mode: "push-to-talk" | "open-mic") => void;
  bargeInStatus: string;
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
        <button className={`control-button ${props.micMode === "push-to-talk" ? "active" : ""}`} aria-pressed={props.micMode === "push-to-talk"} onClick={() => props.setMicMode("push-to-talk")}>Push to talk</button>
        <button className={`control-button secondary ${props.micMode === "open-mic" ? "active" : ""}`} aria-pressed={props.micMode === "open-mic"} onClick={() => props.setMicMode("open-mic")}>Open mic</button>
      </div>
      <div className="barge-indicator">
        <label>Mic mode</label>
        <p>{props.micMode === "open-mic" ? "Open mic standby" : "Push-to-talk armed"}</p>
        <label>Barge-in</label>
        <p>{props.bargeInStatus}</p>
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

createRoot(document.getElementById("root")!).render(<App />);
