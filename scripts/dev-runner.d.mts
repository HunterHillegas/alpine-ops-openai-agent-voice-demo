import type { ChildProcess, SpawnOptions } from "node:child_process";
import type { EventEmitter } from "node:events";

export type DevCommand = {
  name: string;
  command: string;
  args: string[];
};

export declare const DEFAULT_DEV_COMMANDS: DevCommand[];

export declare function createDevRunner(options?: {
  commands?: DevCommand[];
  spawnProcess?: (
    command: string,
    args: string[],
    options: SpawnOptions
  ) => ChildProcess;
  processRef?: EventEmitter & {
    exit(code?: number): never;
  };
  killTimeoutMs?: number;
}): {
  start(): void;
  terminate(code?: number): void;
};


