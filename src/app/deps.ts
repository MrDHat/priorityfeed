import type { PostScorer } from "../judge/ports.js";
import type { TimelineSource } from "../x/ports.js";

export interface Deps {
  source: TimelineSource;
  scorer: PostScorer;
  cacheFile: string;
  now: () => Date;
  limit: number;
}

export interface RunResult {
  rendered: string;
  scored: number; // how many posts were sent to the scorer
  fromCache: number; // how many came from cache
  total: number; // total ranked
}