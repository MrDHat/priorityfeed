import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { run } from "../../src/app/run.js";
import type { PostScorer } from "../../src/judge/ports.js";
import type { TimelineSource } from "../../src/x/ports.js";
import type { FeedItem, Me } from "../../src/x/types.js";

const me: Me = { id: "111", username: "bob", name: "Bob" };

const dirs: string[] = [];
async function tmpd(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), "qa-fallback-"));
  dirs.push(d);
  return d;
}
afterEach(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));

function item(id: string, over: Partial<FeedItem> = {}): FeedItem {
  return {
    id,
    text: "x",
    authorId: "222",
    authorUsername: "alice",
    authorName: "Alice",
    createdAt: "2026-09-17T12:00:00Z",
    likeCount: 0,
    retweetCount: 0,
    replyCount: 0,
    quoteCount: 0,
    quotedTweetCount: 0,
    isReplyToMe: false,
    isRetweet: false,
    hasLinks: false,
    mentionsMe: false,
    ...over,
  };
}

describe("qa: scorer failure fallback (plan Task 10)", () => {
  it("a scorer failure is non-fatal: run ranks with deterministic signals and returns", async () => {
    const d = await tmpd();
    const cacheFile = join(d, "scores.json");
    const items = [item("a", { mentionsMe: true })];
    const scorer: PostScorer = {
      judge: vi.fn(async () => {
        throw new Error("typesafe down");
      }),
    };
    const src: TimelineSource = { fetchTimeline: vi.fn(async () => ({ me, items })) };

    const result = await run({
      source: src,
      scorer,
      cacheFile,
      now: () => new Date("2026-09-17T12:00:00Z"),
      limit: 10,
    });

    expect(result.total).toBe(1);
    expect(result.rendered).toContain("@alice");
    expect(result.rendered).toContain("20%");
    expect(result.warnings.join("\n")).toContain("scoring failed");
  });
});