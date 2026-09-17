import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { run } from "../../src/app/run.js";
import type { PostJudgment, PostScorer } from "../../src/judge/ports.js";
import type { TimelineSource } from "../../src/x/ports.js";
import type { FeedItem, Me } from "../../src/x/types.js";

const me: Me = { id: "111", username: "bob", name: "Bob" };

function item(id: string, createdAt = "2026-09-01T00:00:00Z"): FeedItem {
  return {
    id,
    text: `post ${id}`,
    authorId: "222",
    authorUsername: "alice",
    authorName: "Alice",
    createdAt,
    likeCount: 0,
    retweetCount: 0,
    replyCount: 0,
    quoteCount: 0,
    quotedTweetCount: 0,
    isReplyToMe: false,
    isRetweet: false,
    hasLinks: false,
    mentionsMe: false,
  };
}

describe("run", () => {
  it("fetches, scores only uncached posts, and renders the ranked dashboard", async () => {
    const dir = await mkdtemp(join(tmpdir(), "app-run-"));
    try {
      const items = [item("new"), item("cached")];
      const cacheFile = join(dir, "c.json");
      const scorer: PostScorer = {
        judge: vi.fn(async (posts: FeedItem[]): Promise<PostJudgment[]> =>
          posts.map((p) => ({ id: p.id, urgency: 3, replyProb: 1 })),
        ),
      };
      const source: TimelineSource = { fetchTimeline: vi.fn(async () => ({ me, items })) };
      // Pre-seed the cache with "cached" having a recent createdAt so it survives prune/findCached
      const { save } = await import("../../src/cache/score-cache.js");
      await save(
        { posts: { cached: { urgency: 1, replyProb: 0.2, createdAt: "2026-09-01T23:45:00Z" } } },
        cacheFile,
      );

      const result = await run({
        source,
        scorer,
        cacheFile,
        now: () => new Date("2026-09-02T00:00:00Z"),
        limit: 10,
      });

      expect(scorer.judge).toHaveBeenCalledTimes(1); // only the new one
      expect(scorer.judge).toHaveBeenCalledWith([items[0]]);
      expect(result.scored).toBe(1);
      expect(result.fromCache).toBe(1);
      expect(result.total).toBe(2);
      expect(result.rendered).toContain("@alice");
      expect(result.rendered).toContain("post cached");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("writes back new judgments to the cache file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "app-run-"));
    try {
      const items = [item("new")];
      const cacheFile = join(dir, "c.json");
      const scorer: PostScorer = {
        judge: vi.fn(async (posts: FeedItem[]): Promise<PostJudgment[]> =>
          posts.map((p) => ({ id: p.id, urgency: 2, replyProb: 0.5 })),
        ),
      };
      const source: TimelineSource = { fetchTimeline: vi.fn(async () => ({ me, items })) };

      await run({
        source,
        scorer,
        cacheFile,
        now: () => new Date("2026-09-02T00:00:00Z"),
        limit: 10,
      });

      const { loadCache } = await import("../../src/cache/score-cache.js");
      const cache = await loadCache(cacheFile);
      expect(cache.posts["new"]).toEqual({
        urgency: 2,
        replyProb: 0.5,
        createdAt: "2026-09-02T00:00:00.000Z",
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("keeps surviving cached records when persisting", async () => {
    const dir = await mkdtemp(join(tmpdir(), "app-run-"));
    try {
      const items = [item("fresh"), item("new")];
      const cacheFile = join(dir, "c.json");
      const scorer: PostScorer = {
        judge: vi.fn(async (posts: FeedItem[]): Promise<PostJudgment[]> =>
          posts.map((p) => ({ id: p.id, urgency: 3, replyProb: 1 })),
        ),
      };
      const source: TimelineSource = { fetchTimeline: vi.fn(async () => ({ me, items })) };
      const { save } = await import("../../src/cache/score-cache.js");
      await save(
        { posts: { fresh: { urgency: 1, replyProb: 0.2, createdAt: "2026-09-01T23:45:00Z" } } },
        cacheFile,
      );

      await run({
        source,
        scorer,
        cacheFile,
        now: () => new Date("2026-09-02T00:00:00Z"),
        limit: 10,
      });

      const { loadCache } = await import("../../src/cache/score-cache.js");
      const cache = await loadCache(cacheFile);
      expect(cache.posts["fresh"]).toEqual({
        urgency: 1,
        replyProb: 0.2,
        createdAt: "2026-09-01T23:45:00Z",
      });
      expect(cache.posts["new"]).toBeDefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});