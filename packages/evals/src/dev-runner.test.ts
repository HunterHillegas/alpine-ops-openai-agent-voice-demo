import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

import { createDevRunner, type DevCommand } from "../../../scripts/dev-runner.mjs";
import { parseDotenv, startLiveDev, validateLiveDevEnv } from "../../../scripts/dev-with-env.mjs";

class FakeChildProcess extends EventEmitter {
  readonly killSignals: string[] = [];

  kill(signal: string) {
    this.killSignals.push(signal);
    return true;
  }
}

describe("dev runner", () => {
  it("terminates the sibling dev process when one exits", () => {
    const commands: DevCommand[] = [
      { name: "api", command: "npm", args: ["run", "dev:api"] },
      { name: "web", command: "npm", args: ["run", "dev:web"] }
    ];
    const children: FakeChildProcess[] = [];
    const exitCodes: number[] = [];
    const processRef = new EventEmitter() as EventEmitter & {
      exit(code?: number): never;
    };
    processRef.exit = (code = 0) => {
      exitCodes.push(code);
      throw new Error("process exit");
    };

    const runner = createDevRunner({
      commands,
      spawnProcess: () => {
        const child = new FakeChildProcess();
        children.push(child);
        return child as never;
      },
      processRef,
      killTimeoutMs: 10
    });

    runner.start();

    children[1]?.emit("exit", 0, null);

    expect(children[0]?.killSignals).toEqual(["SIGTERM"]);

    expect(() => children[0]?.emit("exit", null, "SIGTERM")).toThrow("process exit");
    expect(exitCodes).toEqual([0]);
  });
});

describe("live dev env loader", () => {
  it("parses dotenv lines without exposing values", () => {
    expect(parseDotenv("OPENAI_API_KEY=sk-proj-examplelivekey123\nexport PORT=8787\nQUOTED=\"hello # not comment\"\nPLAIN=value # comment")).toEqual({
      OPENAI_API_KEY: "sk-proj-examplelivekey123",
      PORT: "8787",
      QUOTED: "hello # not comment",
      PLAIN: "value"
    });
  });

  it("blocks live dev startup when the key is missing", () => {
    expect(validateLiveDevEnv({})).toEqual({
      ok: false,
      message: "OPENAI_API_KEY is missing or still a placeholder. Add it to .env, then run npm run dev:live."
    });
  });

  it("starts the existing dev runner when the key is present", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const starts: string[] = [];
    const exits: number[] = [];
    const env: NodeJS.ProcessEnv = {};
    const processRef = {
      exit: (code = 0) => {
        exits.push(code);
      }
    };

    const started = startLiveDev({
      env,
      envPath: "/definitely/not/here/.env",
      runner: {
        start: () => starts.push("started")
      },
      processRef
    });

    expect(started).toBe(false);
    expect(starts).toEqual([]);
    expect(exits).toEqual([1]);

    env.OPENAI_API_KEY = "sk-proj-examplelivekey123";
    const startedWithKey = startLiveDev({
      env,
      envPath: "/definitely/not/here/.env",
      runner: {
        start: () => starts.push("started")
      },
      processRef
    });

    expect(startedWithKey).toBe(true);
    expect(starts).toEqual(["started"]);

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
