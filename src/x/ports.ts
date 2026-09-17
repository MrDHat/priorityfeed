import type { FeedItem, Me } from "./types.js";

export interface TimelineSource {
  fetchTimeline(limit: number): Promise<{ me: Me; items: FeedItem[] }>;
}