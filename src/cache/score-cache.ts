import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { PostJudgment } from "../judge/ports.js";
import type { FeedItem } from "../x/types.js";

export interface ScoreRecord { urgency: number; replyProb: number; createdAt: string; }
export interface ScoreCache { posts: Record<string, ScoreRecord>; }

export const WINDOW_MS = 30 * 60 * 1000; // maxAgeMs default from the plan: re-score after 30 min

export interface ScorePlan {
  toScore: FeedItem[];
  fromCache: PostJudgment[];
}

const EMPTY: ScoreCache = { posts: {} };

export async function loadCache(file: string): Promise<ScoreCache> {
  try {
    const raw = JSON.parse(await readFile(file, "utf8"));
    if (raw && typeof raw === "object" && raw.posts && typeof raw.posts === "object") {
      return { posts: raw.posts };
    }
    return EMPTY;
  } catch {
    return EMPTY; // missing file or corrupt json
  }
}

export function prune(cache: ScoreCache, now: Date): ScoreCache {
  const posts: Record<string, ScoreRecord> = {};
  for (const [id, rec] of Object.entries(cache.posts)) {
    const ageMs = now.getTime() - new Date(rec.createdAt).getTime();
    if (Number.isFinite(ageMs) && ageMs > 0 && ageMs <= WINDOW_MS) posts[id] = rec;
  }
  return { posts };
}

export function findCached(
  cache: ScoreCache,
  items: FeedItem[],
  now: Date,
): Map<string, { urgency: number; replyProb: number }> {
  const found = new Map<string, { urgency: number; replyProb: number }>();
  for (const item of items) {
    const rec = cache.posts[item.id];
    if (!rec) continue;
    const ageMs = now.getTime() - new Date(rec.createdAt).getTime();
    if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= WINDOW_MS) {
      found.set(item.id, { urgency: rec.urgency, replyProb: rec.replyProb });
    }
  }
  return found;
}

export async function save(cache: ScoreCache, file: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ version: 1, posts: cache.posts }, null, 2), "utf8");
}

export function planScoring(posts: FeedItem[], cache: ScoreCache, now: Date): ScorePlan {
  const toScore: FeedItem[] = [];
  const fromCache: PostJudgment[] = [];
  for (const p of posts) {
    const rec = cache.posts[p.id];
    if (!rec) {
      toScore.push(p);
      continue;
    }
    const judgment: PostJudgment = { id: p.id, urgency: rec.urgency, replyProb: rec.replyProb };
    fromCache.push(judgment); // expired entries still rank (rank still works)
    if (!isFresh(rec.createdAt, now)) toScore.push(p); // but are re-queried
  }
  return { toScore, fromCache };
}

export function isFresh(createdAt: string, now: Date): boolean {
  const ageMs = now.getTime() - new Date(createdAt).getTime();
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= WINDOW_MS;
}