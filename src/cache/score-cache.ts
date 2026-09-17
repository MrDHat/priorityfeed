import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { FeedItem } from "../x/types.js";

export interface ScoreRecord { urgency: number; replyProb: number; createdAt: string; }
export interface ScoreCache { posts: Record<string, ScoreRecord>; }

export const WINDOW_MS = 42 * 60 * 60 * 1000; // 42h: fresh enough for a habit of a few checks/day

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