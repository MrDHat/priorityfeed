#!/usr/bin/env node
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { run } from "./app/run.js";
import { TypeSafeScorer } from "./judge/scorer.js";
import { XTimelineSource } from "./x/source.js";
import { loadTokens, refreshTokens, runLogin, saveTokens } from "./x/auth.js";
import type { LoginOptions } from "./x/auth.js";

const DEFAULT_LIMIT = 50;
const DEFAULT_CALLBACK_PORT = 4321;
const REFRESH_SKEW_S = 300;
const USAGE = `usage: priorityfeed <command> [options]

commands:
  login                authorize with X and save your access token
  run [--limit N]      fetch, score, and render your priority feed (N in 1..100, default 50)
  help                 show this help`;

export interface EnvConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  callbackPort: number;
  tokenFile: string;
  cacheFile: string;
  typesafeApiKey?: string;
}

export function parseEnv(
  env: NodeJS.ProcessEnv = process.env,
  homeDir: string = homedir(),
): EnvConfig {
  const cacheRoot = join(homeDir, ".cache", "priorityfeed");
  return {
    clientId: env.X_CLIENT_ID,
    clientSecret: env.X_CLIENT_SECRET,
    redirectUri: env.X_REDIRECT_URI,
    callbackPort: Number(env.X_CALLBACK_PORT ?? String(DEFAULT_CALLBACK_PORT)),
    tokenFile: env.X_TOKEN_FILE ?? join(cacheRoot, "tokens.json"),
    cacheFile: env.CACHE_FILE ?? join(cacheRoot, "score-cache.json"),
    typesafeApiKey: env.TYPESAFE_API_KEY,
  };
}

export function parseLimit(argv: string[]): number {
  const idx = argv.indexOf("--limit");
  if (idx < 0) return DEFAULT_LIMIT;
  const raw = argv[idx + 1];
  if (raw === undefined) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(100, Math.max(1, n));
}

function secret(v: string | undefined): string | undefined {
  return v !== undefined && v.trim() !== "" ? v : undefined;
}

function loginOptions(env: EnvConfig): LoginOptions {
  return {
    clientId: env.clientId ?? "",
    clientSecret: env.clientSecret ?? "",
    redirectUri: env.redirectUri ?? "",
    callbackPort: env.callbackPort,
    tokenFile: env.tokenFile,
  };
}

export async function main(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
  homeDir: string = homedir(),
): Promise<number> {
  const [command] = argv;
  const e = parseEnv(env, homeDir);

  if (command === undefined || command === "help") {
    console.log(USAGE);
    return 0;
  }
  if (command !== "login" && command !== "run") {
    console.error(USAGE);
    return 1;
  }

  if (command === "login") {
    return cmdLogin(e);
  }
  return cmdRun(e, parseLimit(argv));
}

async function cmdLogin(env: EnvConfig): Promise<number> {
  if (!secret(env.clientId) || !secret(env.clientSecret) || !secret(env.redirectUri)) {
    console.error("Missing required env vars: X_CLIENT_ID, X_CLIENT_SECRET, X_REDIRECT_URI.");
    return 1;
  }
  await runLogin(loginOptions(env));
  console.log(`Saved access token to ${env.tokenFile}`);
  return 0;
}

async function cmdRun(env: EnvConfig, limit: number): Promise<number> {
  const tokens = await loadTokens(env.tokenFile);
  if (!tokens) {
    console.error("Not logged in. Run 'priorityfeed login' first.");
    return 1;
  }

  const refreshed = await maybeRefresh(env, tokens);
  const accessToken = refreshed?.access_token ?? tokens.access_token;

  const apiKey = secret(env.typesafeApiKey);
  if (!apiKey) {
    console.error("Missing required env var: TYPESAFE_API_KEY.");
    return 1;
  }

  const source = new XTimelineSource(accessToken);
  const scorer = new TypeSafeScorer(new TypeSafeClient({ apiKey }));
  const result = await run({
    source,
    scorer,
    cacheFile: env.cacheFile,
    now: () => new Date(),
    limit,
  });
  console.log(result.rendered);
  return 0;
}

async function maybeRefresh(
  env: EnvConfig,
  tokens: { access_token: string; refresh_token?: string; expires_at?: number },
): Promise<{ access_token: string } | null> {
  if (typeof tokens.expires_at !== "number") return null;
  const expired = Date.now() / 1000 > tokens.expires_at - REFRESH_SKEW_S;
  if (!expired) return null;
  if (!tokens.refresh_token) return null;
  if (!secret(env.clientId) || !secret(env.clientSecret)) return null;

  const updated = await refreshTokens(loginOptions(env), tokens.refresh_token);
  await saveTokens(updated, env.tokenFile);
  console.log("Refreshed access token.");
  return updated;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main()
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}