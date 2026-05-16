import type { EventLogEntry } from "@alpine/mock-data";
import { formatEventArgs } from "../lib/traceFormat";

export function ActivityRail({ events }: { events: EventLogEntry[] }) {
  const groups = groupEventsByAgent(events);

  return (
    <aside className="panel activity-rail">
      <div className="panel-heading">
        <span>Agent activity</span>
        <strong>{events.length} events</strong>
      </div>
      <div className="event-list">
        {groups.map((group) => (
          <section className="agent-event-group" key={group.agentName} aria-label={group.agentName}>
            <div className="agent-group-heading">
              <h3>{group.agentName}</h3>
              <span>{group.events.length}</span>
            </div>
            {group.events.map((event) => (
              <article className={`event-card ${event.type}`} key={event.eventId}>
                <div>
                  <time>{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                  <b>{event.type}</b>
                </div>
                <h4>{event.label}</h4>
                <p>{event.toolName ?? event.handoffTarget ?? event.type}</p>
                {event.args && <code className="event-args">{formatEventArgs(event.args)}</code>}
                {event.resultSummary && <small>{event.resultSummary}</small>}
                {event.approvalStatus && <small>{event.approvalStatus}</small>}
                {event.error && <small className="event-error">{event.error}</small>}
              </article>
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
}

export function groupEventsByAgent(events: EventLogEntry[]) {
  const groups = new Map<string, EventLogEntry[]>();
  for (const event of events) {
    groups.set(event.agentName, [...(groups.get(event.agentName) ?? []), event]);
  }
  return [...groups.entries()].map(([agentName, groupEvents]) => ({ agentName, events: groupEvents }));
}
