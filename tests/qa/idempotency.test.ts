import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { run } from "../../src/app/run.js";
import { loadCache } from "../../src/cache/score-cache.js";
import type { PostJudgment, PostScorer } from "../../src/judge/ports.js";
import type { TimelineSource } from "../../src/x/ports.js";
import type { FeedItem, Me } from "../../src/x/types.js";

const me: Me = { id: "111", username: "bob", name: "Bob" };

const dirs: string[] = [];
async function tmpd(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), "qa-idem-"));
  dirs.push(d);
  return d;
}
afterEach(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));

function item(id: string, createdAt: string): FeedItem {
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

function freshScorer(): PostScorer {
  return {
    judge: vi.fn(async (posts: FeedItem[]): Promise<PostJudgment[]> =>
      posts.map((p) => ({ id: p.id, urgency: 3, replyProb: 1 })),
    ),
  };
}

function source(items: FeedItem[]): TimelineSource {
  return { fetchTimeline: vi.fn(async () => ({ me, items })) };
}

describe("qa: run() idempotency across the cache seam", () => {
  it("second run scores zero new posts and reuses every cached judgment", async () => {
    const d = await tmpd();
    const cacheFile = join(d, "scores.json");
    const items = [item("a", "2026-09-17T10:00:00Z"), item("b", "2026-09-17T11:00:00Z")];
    const scorer = freshScorer();
    const src = source(items);

    const first = await run({
      source: src,
      scorer,
      cacheFile,
      now: () => new Date("2026-09-17T12:00:00Z"),
      limit: 10,
    });
    expect(first.scored).toBe(2);
    expect(first.fromCache).toBe(0);

    const second = await run({
      source: src,
      scorer,
      cacheFile,
      now: () => new Date("2026-09-17T12:30:00Z"),
      limit: 10,
    });

    expect(scorer.judge).toHaveBeenCalledTimes(2);
    const calls = (scorer.judge as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0]![0] as FeedItem[]).toHaveLength(2);
    expect(calls[1]![0] as FeedItem[]).toHaveLength(0);
    expect(second.scored).toBe(0);
    expect(second.fromCache).toBe(2);
    expect(second.total).toBe(2);
  });

  it("the judgment persisted by run() is keyed by post id and reused as-is", async () => {
    const d = await tmpd();
    const cacheFile = join(d, "scores.json");
    const items = [item("a", "2026-09-17T10:00:00Z")];
    const scorer = freshScorer();
    const src = source(items);

    await run({
      source: src,
      scorer,
      cacheFile,
      now: () => new Date("2026-09-17T12:00:00Z"),
      limit: 10,
    });

    const cache = await loadCache(cacheFile);
    expect(cache.posts["a"]).toEqual({
      urgency: 3,
      replyProb: 1,
      createdAt: "2026-09-17T12:00:00.000Z",
    });

    const third = await run({
      source: src,
      scorer,
      cacheFile,
      now: () => new Date("2026-09-17T12:15:00Z"),
      limit: 10,
    });
    expect(third.scored).toBe(0);
    expect(third.fromCache).toBe(1);
  });

  it("a post scored one minute ago is not re-scored on the next run inside the cache window", async () => {
    const d = await tmpd();
    const cacheFile = join(d, "scores.json");
    const items = [item("old", "2026-09-15T10:00:00Z")];
    const scorer = freshScorer();
    const src = source(items);

    const first = await run({
      source: src,
      scorer,
      cacheFile,
      now: () => new Date("2026-09-17T12:00:00Z"),
      limit: 10,
    });
    expect(first.scored).toBe(1);

    const second = await run({
      source: src,
      scorer,
      cacheFile,
      now: () => new Date("2026-09-17T12:01:00Z"),
      limit: 10,
    });

    expect(second.scored).toBe(0);
    expect(second.fromCache).toBe(1);
  });
});