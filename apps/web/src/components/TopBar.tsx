import { realtimeModel } from "@alpine/agents";
import type { DemoScenario } from "@alpine/mock-data";

export type ThemeId = "nextstep" | "platinum";

const themes: { id: ThemeId; name: string }[] = [
  { id: "nextstep", name: "NeXTSTEP" },
  { id: "platinum", name: "MacOS 8 Platinum" }
];

export function TopBar(props: {
  connection: string;
  scenarioId: string;
  scenarios: DemoScenario[];
  setScenarioId: (id: string) => void;
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
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
        <label className="theme-picker">
          <span>Theme</span>
          <select value={props.theme} onChange={(event) => props.setTheme(event.target.value as ThemeId)} aria-label="Theme">
            {themes.map((theme) => (
              <option key={theme.id} value={theme.id}>{theme.name}</option>
            ))}
          </select>
        </label>
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
