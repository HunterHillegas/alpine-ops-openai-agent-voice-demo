import type { DevCommand } from "./dev-runner.mjs";

export declare const LIVE_DEV_COMMANDS: DevCommand[];

export declare function parseDotenv(content: string): Record<string, string>;

export declare function loadDotenv(path?: string, env?: NodeJS.ProcessEnv): {
  loaded: boolean;
  path: string;
  values: Record<string, string>;
};

export declare function validateLiveDevEnv(env?: NodeJS.ProcessEnv):
  | { ok: true }
  | { ok: false; message: string };

export declare function startLiveDev(options?: {
  env?: NodeJS.ProcessEnv;
  envPath?: string;
  runner?: {
    start(): void;
  };
  processRef?: {
    exit(code?: number): void;
  };
}): boolean;
