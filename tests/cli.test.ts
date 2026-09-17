import { describe, expect, it } from "vitest";
import { main, parseEnv, parseLimit } from "../src/cli.js";

describe("parseLimit", () => {
  it("defaults to 50", () => expect(parseLimit([])).toBe(50));
  it("parses --limit N and clamps to 1..100", () => {
    expect(parseLimit(["--limit", "12"])).toBe(12);
    expect(parseLimit(["--limit", "0"])).toBe(1);
    expect(parseLimit(["--limit", "500"])).toBe(100);
  });
  it("ignores positional args", () => expect(parseLimit(["run"])).toBe(50));
});

describe("parseEnv", () => {
  it("uses defaults for optional values", () => {
    const env = parseEnv(
      {
        X_CLIENT_ID: "cid",
        X_CLIENT_SECRET: "cs",
        X_REDIRECT_URI: "http://127.0.0.1:4321/cb",
      },
      "/h",
    );
    expect(env.callbackPort).toBe(4321);
    expect(env.tokenFile).toBe("/h/.cache/priorityfeed/tokens.json");
    expect(env.cacheFile).toBe("/h/.cache/priorityfeed/score-cache.json");
    expect(env.typesafeApiKey).toBeUndefined();
  });
  it("reads api key and overrides from env", () => {
    const env = parseEnv(
      {
        TYPESAFE_API_KEY: "tsk",
        X_CALLBACK_PORT: "9000",
        X_TOKEN_FILE: "/x/t.json",
        CACHE_FILE: "/x/c.json",
      },
      "/h",
    );
    expect(env.typesafeApiKey).toBe("tsk");
    expect(env.callbackPort).toBe(9000);
    expect(env.tokenFile).toBe("/x/t.json");
    expect(env.cacheFile).toBe("/x/c.json");
  });
});

describe("main", () => {
  it("prints usage and returns 0 with no args", async () => {
    const code = await main([]);
    expect(code).toBe(0);
  });
  it("rejects an unknown command with 1", async () => {
    const code = await main(["frobnicate"]);
    expect(code).toBe(1);
  });
  it("errors and exits 1 on run without tokens", async () => {
    const code = await main(
      ["run"],
      { TYPESAFE_API_KEY: "k", X_TOKEN_FILE: "/nonexistent/t.json" },
      "/h",
    );
    expect(code).toBe(1);
  });
});