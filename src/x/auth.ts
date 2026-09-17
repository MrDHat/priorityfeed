import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname } from "node:path";

export interface XTokens {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

export type StartServer = (opts: {
  port: number;
  expectedState: string;
}) => Promise<{ code: string; state: string }>;

export interface LoginOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  callbackPort: number;
  tokenFile: string;
  authBaseUrl?: string;
  tokenBaseUrl?: string;
  fetchImpl?: typeof fetch;
  startServer?: StartServer;
}

export const STATE_BYTES = 16;

const DEFAULT_AUTH_BASE_URL = "https://x.com";
const DEFAULT_TOKEN_BASE_URL = "https://api.x.com";
const SCOPE = "tweet.read users.read offline.access";

export function generateVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function makeAuthUrl(opts: LoginOptions, state: string, challenge: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  const authBaseUrl = opts.authBaseUrl ?? DEFAULT_AUTH_BASE_URL;
  return `${authBaseUrl}/i/oauth2/authorize?${params.toString()}`;
}

export async function loadTokens(file: string): Promise<XTokens | null> {
  try {
    const raw = JSON.parse(await readFile(file, "utf8")) as XTokens;
    return raw?.access_token ? raw : null;
  } catch {
    return null;
  }
}

export async function saveTokens(t: XTokens, file: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(t, null, 2), "utf8");
}

export async function runLogin(opts: LoginOptions): Promise<XTokens> {
  const verifier = generateVerifier();
  const challenge = codeChallenge(verifier);
  const state = generateVerifier();
  const url = makeAuthUrl(opts, state, challenge);
  console.log(`Open this URL to authorize:\n  ${url}`);

  const start = opts.startServer ?? defaultStartServer;
  const { code, state: returnedState } = await start({
    port: opts.callbackPort,
    expectedState: state,
  });
  if (returnedState !== state) throw new Error("state mismatch in callback");
  if (!code) throw new Error("callback did not include an authorization code");

  const tokens = await requestTokens(opts, {
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: opts.redirectUri,
  });
  await saveTokens(tokens, opts.tokenFile);
  return tokens;
}

async function requestTokens(
  opts: LoginOptions,
  body: {
    grant_type: string;
    code?: string;
    code_verifier?: string;
    redirect_uri?: string;
    refresh_token?: string;
  },
): Promise<XTokens> {
  const params = new URLSearchParams();
  params.set("grant_type", body.grant_type);
  params.set("client_id", opts.clientId);
  params.set("client_secret", opts.clientSecret);
  if (body.code) params.set("code", body.code);
  if (body.code_verifier) params.set("code_verifier", body.code_verifier);
  if (body.redirect_uri) params.set("redirect_uri", body.redirect_uri);
  if (body.refresh_token) params.set("refresh_token", body.refresh_token);

  const tokenBaseUrl = opts.tokenBaseUrl ?? DEFAULT_TOKEN_BASE_URL;
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const res = await fetchImpl(`${tokenBaseUrl}/2/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) throw new Error(`token exchange failed: HTTP ${res.status}`);

  const json = (await res.json()) as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
  };
  return {
    access_token: String(json.access_token ?? ""),
    refresh_token: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
    expires_at:
      typeof json.expires_in === "number"
        ? Math.floor(Date.now() / 1000 + json.expires_in)
        : undefined,
  };
}

function defaultStartServer(opts: {
  port: number;
  expectedState: string;
}): Promise<{ code: string; state: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      res.writeHead(200, { "content-type": "text/html" });
      if (!code) {
        res.end("<p>This is the OAuth callback endpoint. You can close this tab.</p>");
        return;
      }
      res.end("<h2>Authorized. You can close this tab.</h2>");
      server.close();
      resolve({ code, state: state ?? "" });
    });
    server.on("error", reject);
    server.listen(opts.port, "127.0.0.1");
  });
}