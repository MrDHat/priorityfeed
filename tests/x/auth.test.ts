import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  codeChallenge,
  generateVerifier,
  loadTokens,
  makeAuthUrl,
  runLogin,
  saveTokens,
} from "../../src/x/auth.js";

const dirs: string[] = [];
async function tmp(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), "auth-"));
  dirs.push(d);
  return d;
}
afterEach(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));

describe("PKCE primitives", () => {
  it("derives a base64url challenge from the sha256 of the verifier", () => {
    const v = generateVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
    expect(codeChallenge(v)).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(codeChallenge(v)).not.toBe(v);
  });
  it("verifier is unpredictable across calls", () => {
    expect(generateVerifier()).not.toBe(generateVerifier());
  });
});

describe("makeAuthUrl", () => {
  it("builds the x.com authorize url with PKCE and scope", () => {
    const url = makeAuthUrl(
      {
        clientId: "cid",
        clientSecret: "cs",
        redirectUri: "http://127.0.0.1:4321/cb",
        callbackPort: 4321,
        tokenFile: "x",
      },
      "st8",
      "ch90",
    );
    expect(url).toMatch(/^https:\/\/x\.com\/i\/oauth2\/authorize\?/);
    expect(url).toContain("response_type=code");
    expect(url).toContain("client_id=cid");
    expect(url).toContain(`redirect_uri=${encodeURIComponent("http://127.0.0.1:4321/cb")}`);
    expect(url).toContain("scope=tweet.read+users.read+offline.access");
    expect(url).toContain("state=st8");
    expect(url).toContain("code_challenge_method=S256");
    expect(url).toContain("code_challenge=ch90");
  });

  it("honors an overridden authBaseUrl", () => {
    const url = makeAuthUrl(
      { clientId: "c", clientSecret: "s", redirectUri: "x", callbackPort: 1, tokenFile: "t", authBaseUrl: "https://example.test" },
      "st8",
      "ch90",
    );
    expect(url).toMatch(/^https:\/\/example\.test\/i\/oauth2\/authorize\?/);
  });
});

describe("token persistence", () => {
  it("round-trips tokens through a JSON file, creating parent dirs", async () => {
    const d = await tmp();
    const file = join(d, "nested", "tokens.json");
    const tokens = { access_token: "a", refresh_token: "r", expires_at: 12345 };
    await saveTokens(tokens, file);
    expect(await loadTokens(file)).toEqual(tokens);
  });

  it("returns null for a missing or malformed token file", async () => {
    const d = await tmp();
    expect(await loadTokens(join(d, "missing.json"))).toBeNull();
    const malformed = join(d, "malformed.json");
    await writeFile(malformed, "{ not json", "utf8");
    expect(await loadTokens(malformed)).toBeNull();
    const noAccess = join(d, "no-access.json");
    await writeFile(noAccess, JSON.stringify({ refresh_token: "r" }), "utf8");
    expect(await loadTokens(noAccess)).toBeNull();
  });
});

describe("runLogin", () => {
  it("exchanges an authorization code and persists tokens", async () => {
    const d = await tmp();
    const tokenFile = join(d, "t.json");
    const captured: Array<{ url: string; form: URLSearchParams }> = [];

    const fakeFetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      captured.push({ url: String(url), form: new URLSearchParams(String(init?.body ?? "")) });
      return new Response(
        JSON.stringify({ access_token: "AT", refresh_token: "RT", expires_in: 7200 }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const startServer = async ({ port, expectedState }: { port: number; expectedState: string }) => {
      expect(port).toBe(4321);
      return { code: "FAKE_CODE", state: expectedState };
    };

    const tokens = await runLogin({
      clientId: "cid",
      clientSecret: "cs",
      redirectUri: "http://127.0.0.1:4321/cb",
      callbackPort: 4321,
      tokenFile,
      fetchImpl: fakeFetch,
      startServer,
    });

    expect(tokens.access_token).toBe("AT");
    expect(tokens.refresh_token).toBe("RT");
    expect(tokens.expires_at).toBeGreaterThan(Date.now() / 1000 + 7100);

    expect(captured).toHaveLength(1);
    expect(captured[0]?.url).toBe("https://api.x.com/2/oauth2/token");
    const form = captured[0]?.form;
    expect(form?.get("grant_type")).toBe("authorization_code");
    expect(form?.get("code")).toBe("FAKE_CODE");
    expect(form?.get("redirect_uri")).toBe("http://127.0.0.1:4321/cb");
    expect(form?.get("client_id")).toBe("cid");
    expect(form?.get("client_secret")).toBe("cs");
    expect(form?.get("code_verifier")).toMatch(/^[A-Za-z0-9_-]{43,128}$/);

    expect(await loadTokens(tokenFile)).toEqual(tokens);
  });

  it("rejects when the callback returns a mismatched state", async () => {
    const d = await tmp();
    const tokenFile = join(d, "t.json");
    const startServer = async () => ({ code: "C", state: "WRONG" });
    const fakeFetch = async (): Promise<Response> =>
      new Response(JSON.stringify({ access_token: "AT" }), { status: 200 });

    await expect(
      runLogin({
        clientId: "c",
        clientSecret: "s",
        redirectUri: "http://127.0.0.1:4321/cb",
        callbackPort: 4321,
        tokenFile,
        fetchImpl: fakeFetch,
        startServer,
      }),
    ).rejects.toThrow(/state/);
  });
});