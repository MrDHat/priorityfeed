import { findCached, loadCache, prune, save, type ScoreCache } from "../cache/score-cache.js";
import type { PostJudgment } from "../judge/ports.js";
import { renderDashboard } from "../output/format.js";
import { rankPosts } from "../rank/rank.js";
import type { Deps, RunResult } from "./deps.js";

interface NewCacheEntry {
  id: string;
  judgment: { urgency: number; replyProb: number; createdAt: string };
}

export async function run({ source, scorer, cacheFile, now, limit }: Deps): Promise<RunResult> {
  const { items } = await source.fetchTimeline(limit);

  const cache = await loadCache(cacheFile);
  const cut = now();
  const viable = prune(cache, cut);
  const cached = findCached(viable, items, cut);

  const survivors = items.filter((item) => !cached.has(item.id));
  const survivorJudgments: PostJudgment[] = await scorer.judge(survivors);

  const cachedJudgments: PostJudgment[] = [...cached.entries()].map(([id, v]) => ({ id, ...v }));
  const merged: PostJudgment[] = [...survivorJudgments, ...cachedJudgments];

  const ranked = rankPosts(items, merged);

  const createdAtById = new Map(items.map((item) => [item.id, item.createdAt]));
  const newEntries: NewCacheEntry[] = survivorJudgments.map((j) => ({
    id: j.id,
    judgment: {
      urgency: j.urgency,
      replyProb: j.replyProb,
      createdAt: createdAtById.get(j.id) ?? cut.toISOString(),
    },
  }));
  await save(mergeIntoCache(viable, newEntries), cacheFile);

  return {
    rendered: renderDashboard(ranked),
    scored: survivors.length,
    fromCache: cached.size,
    total: ranked.length,
  };
}

function mergeIntoCache(cache: ScoreCache, newOnes: NewCacheEntry[]): ScoreCache {
  const posts = { ...cache.posts };
  for (const entry of newOnes) posts[entry.id] = entry.judgment;
  return { posts };
}