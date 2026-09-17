import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "../../src/cli.js";
import { runLogin } from "../../src/x/auth.js";

const dirs: string[] = [];
async function tmpd(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), "qa-auth-"));
  dirs.push(d);
  return d;
}
afterEach(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));

describe("qa: authz ordering and token-file failure modes", () => {
  it("runLogin throws on state mismatch BEFORE any token exchange happens", async () => {
    const d = await tmpd();
    const tokenFile = join(d, "t.json");
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ access_token: "AT" }), { status: 200 }),
    );
    const startServer = async () => ({ code: "C", state: "WRONG" });

    await expect(
      runLogin({
        clientId: "c",
        clientSecret: "s",
        redirectUri: "http://127.0.0.1:4321/cb",
        callbackPort: 4321,
        tokenFile,
        fetchImpl: fetchSpy as unknown as typeof fetch,
        startServer,
      }),
    ).rejects.toThrow(/state/);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("a corrupt token file makes the CLI fail with exit code 1, not crash", async () => {
    const d = await tmpd();
    const tokenFile = join(d, "tokens.json");
    await writeFile(tokenFile, "{ not json", "utf8");

    await expect(
      main(["run"], { TYPESAFE_API_KEY: "k", X_TOKEN_FILE: tokenFile }, "/h"),
    ).resolves.toBe(1);
  });
});