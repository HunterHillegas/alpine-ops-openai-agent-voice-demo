import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export const DEFAULT_DEV_COMMANDS = [
  { name: "api", command: "npm", args: ["run", "dev", "-w", "apps/api"] },
  { name: "web", command: "npm", args: ["run", "dev", "-w", "apps/web"] }
];

export function createDevRunner({
  commands = DEFAULT_DEV_COMMANDS,
  spawnProcess = spawn,
  processRef = process,
  killTimeoutMs = 5_000
} = {}) {
  const children = new Set();
  let shuttingDown = false;
  let exitCode = 0;
  let forceKillTimer;

  const clearForceKillTimer = () => {
    if (forceKillTimer) {
      clearTimeout(forceKillTimer);
      forceKillTimer = undefined;
    }
  };

  const maybeExit = () => {
    if (!shuttingDown || children.size > 0) return;

    clearForceKillTimer();
    processRef.exit(exitCode);
  };

  const terminate = (code = 0) => {
    if (shuttingDown) return;

    shuttingDown = true;
    exitCode = code;

    for (const child of children) {
      child.kill("SIGTERM");
    }

    forceKillTimer = setTimeout(() => {
      for (const child of children) {
        child.kill("SIGKILL");
      }
    }, killTimeoutMs);
    forceKillTimer.unref?.();

    maybeExit();
  };

  const start = () => {
    for (const { name, command, args } of commands) {
      const child = spawnProcess(command, args, { stdio: "inherit" });
      children.add(child);

      child.once("error", (error) => {
        console.error(`dev:${name} failed to start`, error);
        children.delete(child);
        terminate(1);
        maybeExit();
      });

      child.once("exit", (code, signal) => {
        children.delete(child);

        if (!shuttingDown) {
          const siblingExitCode = typeof code === "number" ? code : signal ? 1 : 0;
          terminate(siblingExitCode);
        }

        maybeExit();
      });
    }

    processRef.once("SIGINT", () => terminate(130));
    processRef.once("SIGTERM", () => terminate(143));
  };

  return { start, terminate };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createDevRunner().start();
}
