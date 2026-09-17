import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { run } from "../../src/app/run.js";
import { TypeSafeScorer } from "../../src/judge/scorer.js";
import { XTimelineSource } from "../../src/x/source.js";
import type { FeedItem, Me } from "../../src/x/types.js";

const me: Me = { id: "111", username: "bob", name: "Bob" };

const dirs: string[] = [];
async function tmpd(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), "qa-pipeline-"));
  dirs.push(d);
  return d;
}
afterEach(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));

function fakeXdk() {
  const getMe = vi.fn().mockResolvedValue({ data: { id: "111", username: "bob", name: "Bob" } });
  const getTimeline = vi.fn().mockResolvedValue({
    data: [
      {
        id: "a",
        text: "deploy is broken, can you look?",
        authorId: "222",
        createdAt: "2026-09-17T12:00:00Z",
        publicMetrics: { replyCount: 1, likeCount: 0 },
        entities: { mentions: [{ username: "BOB" }] },
      },
      {
        id: "b",
        text: "beautiful sunset photos",
        authorId: "333",
        createdAt: "2026-09-17T11:00:00Z",
      },
    ],
    includes: {
      users: [
        { id: "222", username: "alice", name: "Alice" },
        { id: "333", username: "carol", name: "Carol" },
      ],
    },
  });
  return { getMe, getTimeline };
}

describe("qa: full pipeline normalize -> state -> score -> rank -> render -> cache", () => {
  it("scores, ranks by composite, renders, and persists a versioned cache file", async () => {
    const d = await tmpd();
    const cacheFile = join(d, "scores.json");
    const { getMe, getTimeline } = fakeXdk();
    const source = new XTimelineSource("tok", { users: { getMe, getTimeline } } as never);

    const captured: unknown[] = [];
    const systemOne = vi.fn(async (req: unknown) => {
      captured.push(req);
      return {
        answers: {
          read_0: { type: "score", score: 3, confidence: 0.9 },
          reply_0: { type: "noul", noul: 1, confidence: 0.9 },
          read_1: { type: "score", score: 0, confidence: 0.9 },
          reply_1: { type: "noul", noul: 0, confidence: 0.9 },
        },
      };
    });
    const scorer = new TypeSafeScorer({ systemOne } as never);

    const result = await run({
      source,
      scorer,
      cacheFile,
      now: () => new Date("2026-09-18T00:00:00Z"),
      limit: 10,
    });

    expect(getMe).toHaveBeenCalledTimes(1);
    expect(getTimeline).toHaveBeenCalledWith(
      "111",
      expect.objectContaining({ max_results: 10 }),
    );

    const state = (captured[0] as any).state;
    expect(state.posts).toHaveLength(2);
    expect(state.posts[0]).toEqual({
      id: "a",
      author: "@alice",
      text: "deploy is broken, can you look?",
      created_at: "2026-09-17T12:00:00Z",
      likes: 0,
      replies: 1,
      retweets: 0,
      quotes: 0,
      reply_to_me: false,
      is_retweet: false,
      mentions_me: true,
      has_links: false,
    });
    expect((captured[0] as any).questions.read_0.type).toBe("score");
    expect((captured[0] as any).questions.reply_0.type).toBe("noul");

    expect(result.scored).toBe(2);
    expect(result.fromCache).toBe(0);
    expect(result.total).toBe(2);
    expect(result.rendered).toContain("100% · ");
    expect(result.rendered).toContain("0% · ");
    expect(result.rendered).toContain("@alice");
    expect(result.rendered).toContain("@carol");
    expect(result.rendered.indexOf("@alice")).toBeLessThan(result.rendered.indexOf("@carol"));

    const { readFile } = await import("node:fs/promises");
    const raw = JSON.parse(await readFile(cacheFile, "utf8"));
    expect(raw.version).toBe(1);
    expect(raw.posts.a).toEqual({ urgency: 3, replyProb: 1, createdAt: "2026-09-18T00:00:00.000Z" });
    expect(raw.posts.b).toEqual({ urgency: 0, replyProb: 0, createdAt: "2026-09-18T00:00:00.000Z" });
  });

  it("returns an empty dashboard for an empty timeline", async () => {
    const d = await tmpd();
    const cacheFile = join(d, "scores.json");
    const getMe = vi.fn().mockResolvedValue({ data: { id: "111", username: "bob", name: "Bob" } });
    const getTimeline = vi.fn().mockResolvedValue({ data: [], includes: { users: [] } });
    const source = new XTimelineSource("tok", { users: { getMe, getTimeline } } as never);
    const scorer = { judge: vi.fn(async () => []) };

    const result = await run({
      source,
      scorer,
      cacheFile,
      now: () => new Date("2026-09-18T00:00:00Z"),
      limit: 10,
    });

    expect(scorer.judge).toHaveBeenCalledWith([]);
    expect(result.scored).toBe(0);
    expect(result.total).toBe(0);
    expect(result.rendered.trim()).toBe("");
  });

  it("recovers from a corrupt cache file instead of crashing", async () => {
    const d = await tmpd();
    const cacheFile = join(d, "scores.json");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(cacheFile, "{ definitely not json", "utf8");

    const getMe = vi.fn().mockResolvedValue({ data: { id: "111", username: "bob", name: "Bob" } });
    const getTimeline = vi.fn().mockResolvedValue({ data: [], includes: { users: [] } });
    const source = new XTimelineSource("tok", { users: { getMe, getTimeline } } as never);
    const scorer = { judge: vi.fn(async () => []) };

    await expect(
      run({
        source,
        scorer,
        cacheFile,
        now: () => new Date("2026-09-18T00:00:00Z"),
        limit: 10,
      }),
    ).resolves.toMatchObject({ scored: 0, total: 0 });
  });

  it("passes --limit through to the timeline source", async () => {
    const d = await tmpd();
    const cacheFile = join(d, "scores.json");
    const fetchTimeline = vi.fn(async (limit: number) => {
      const items: FeedItem[] = [];
      void limit;
      return { me, items };
    });
    const source = { fetchTimeline };
    const scorer = { judge: vi.fn(async () => []) };

    await run({
      source,
      scorer,
      cacheFile,
      now: () => new Date("2026-09-18T00:00:00Z"),
      limit: 37,
    });

    expect(fetchTimeline).toHaveBeenCalledWith(37);
  });
});

describe("qa: /me caching (plan Task 12 Step 5)", () => {
  it("fetches /me once even across repeated fetchTimeline calls (cached via preloadedMe/tokens)", async () => {
    const { getMe, getTimeline } = fakeXdk();
    const source = new XTimelineSource("tok", { users: { getMe, getTimeline } } as never);

    await source.fetchTimeline(10);
    await source.fetchTimeline(10);

    expect(getMe).toHaveBeenCalledTimes(1);
  });
});