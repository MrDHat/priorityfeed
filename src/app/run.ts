import { loadCache, planScoring, save, type ScoreCache, type ScoreRecord } from "../cache/score-cache.js";
import type { PostJudgment } from "../judge/ports.js";
import { formatRanking } from "../output/format.js";
import { rankPosts } from "../rank/rank.js";
import type { Deps, RunResult } from "./deps.js";

export async function run({ source, scorer, cacheFile, now, limit }: Deps): Promise<RunResult> {
  const { items } = await source.fetchTimeline(limit);

  const cache = await loadCache(cacheFile);
  const cut = now();
  const { toScore, fromCache } = planScoring(items, cache, cut);

  const warnings: string[] = [];
  let fresh: PostJudgment[] = [];
  try {
    fresh = await scorer.judge(toScore);
  } catch (err) {
    if (toScore.length > 0) {
      warnings.push(
        `TypeSafe scoring failed (${(err as Error).message ?? "unknown error"}); ranking on deterministic signals.`,
      );
    }
  }

  const mergedById = new Map<string, PostJudgment>();
  for (const j of [...fromCache, ...fresh]) mergedById.set(j.id, j);
  const merged = [...mergedById.values()];
  const ranked = rankPosts(items, merged);

  const newEntries: ScoreRecord[] = fresh.map((j) => ({
    urgency: j.urgency,
    replyProb: j.replyProb,
    createdAt: cut.toISOString(),
  }));
  const nextCache = mergeIntoCache(cache, toScore, newEntries);
  await save(nextCache, cacheFile);

  return {
    rendered: formatRanking(ranked),
    scored: toScore.length,
    fromCache: fromCache.length,
    total: ranked.length,
    warnings,
  };
}

function mergeIntoCache(cache: ScoreCache, toScore: { id: string }[], newEntries: ScoreRecord[]): ScoreCache {
  const posts = { ...cache.posts };
  toScore.forEach((item, i) => {
    const entry = newEntries[i];
    if (entry) posts[item.id] = { createdAt: entry.createdAt, urgency: entry.urgency, replyProb: entry.replyProb };
    else delete posts[item.id];
  });
  return { posts };
}