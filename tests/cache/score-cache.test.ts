import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findCached, loadCache, prune, save, type ScoreCache } from "../../src/cache/score-cache.js";
import type { FeedItem } from "../../src/x/types.js";

const WINDOW_MS = 42 * 60 * 60 * 1000; // keep in sync with WINDOW in module if you export it

const dirs: string[] = [];
async function tmpdir2(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), "score-cache-"));
  dirs.push(d);
  return d;
}
function file(d: string): string { return join(d, "cache.json"); }

function item(id: string, createdAt: string): FeedItem {
  return { id, text: "x", authorId: "222", authorUsername: "alice", authorName: "Alice",
    createdAt, likeCount: 0, retweetCount: 0, replyCount: 0, quoteCount: 0,
    quotedTweetCount: 0, isReplyToMe: false, isRetweet: false, hasLinks: false, mentionsMe: false };
}
function like(now: Date, hoursAgo: number): string {
  return new Date(now.getTime() - hoursAgo * 60 * 60 * 1000).toISOString();
}

afterEach(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));

describe("loadCache", () => {
  it("returns an empty cache when the file does not exist", async () => {
    const d = await tmpdir2();
    await expect(loadCache(file(d))).resolves.toEqual({ posts: {} });
  });

  it("returns an empty cache for corrupt JSON", async () => {
    const d = await tmpdir2();
    const f = file(d);
    const { writeFile } = await import("node:fs/promises");
    await writeFile(f, "{ not json");
    await expect(loadCache(f)).resolves.toEqual({ posts: {} });
  });
});

describe("prune", () => {
  it("drops records older than the window", () => {
    const now = new Date("2026-09-17T12:00:00Z");
    const cache: ScoreCache = {
      posts: {
        fresh: { urgency: 2, replyProb: 0.8, createdAt: like(now, 1) },
        stale: { urgency: 3, replyProb: 1, createdAt: like(now, 50) },
      },
    };
    expect(prune(cache, now).posts).toHaveProperty("fresh");
    expect(prune(cache, now).posts).not.toHaveProperty("stale");
  });
});

describe("findCached", () => {
  it("returns valid matches and hides stale ones", () => {
    const now = new Date("2026-09-17T12:00:00Z");
    const cache: ScoreCache = {
      posts: {
        fresh: { urgency: 2, replyProb: 0.8, createdAt: like(now, 1) },
        old: { urgency: 3, replyProb: 1, createdAt: like(now, 100) },
      },
    };
    const items = [item("fresh", like(now, 1)), item("old", like(now, 100)), item("miss", like(now, 1))];
    const found = findCached(cache, items, now);
    expect(found.get("fresh")).toEqual({ urgency: 2, replyProb: 0.8 });
    expect(found.has("old")).toBe(false);
    expect(found.has("miss")).toBe(false);
  });
});

describe("save", () => {
  it("persists the cache and reloads it", async () => {
    const d = await tmpdir2();
    const f = file(d);
    const cache: ScoreCache = {
      posts: { p1: { urgency: 1.8, replyProb: 0.4, createdAt: "2026-09-17T00:00:00Z" } },
    };
    await save(cache, f);
    const raw = JSON.parse(await readFile(f, "utf8"));
    expect(raw.version).toBe(1);
    expect(raw.posts.p1.urgency).toBe(1.8);
    await expect(loadCache(f)).resolves.toEqual(cache);
  });
});