import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";

import { createDevRunner, type DevCommand } from "../../../scripts/dev-runner.mjs";

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
