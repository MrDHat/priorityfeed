import { Client } from "@xdevplatform/xdk";
import { normalizePosts } from "./normalize.js";
import type { TimelineSource } from "./ports.js";
import type { FeedItem, Me, RawPost, RawUser } from "./types.js";

const EXPANSIONS = ["author_id", "in_reply_to_user_id"] as const;
const POST_FIELDS = [
  "author_id",
  "created_at",
  "entities",
  "in_reply_to_user_id",
  "public_metrics",
  "referenced_tweets",
  "text",
] as const;
const USER_FIELDS = ["name", "username"] as const;

interface XdkPost {
  id?: string;
  text?: string;
  authorId?: string;
  createdAt?: string;
  inReplyToUserId?: string;
  referencedPosts?: Array<{ id?: string; type?: "replied_to" | "retweeted" | "quoted" }>;
  editHistoryPostIds?: string[];
  publicMetrics?: {
    likeCount?: number;
    repostCount?: number;
    retweetCount?: number;
    replyCount?: number;
    quoteCount?: number;
  };
  entities?: {
    urls?: unknown[] | null;
    mentions?: Array<{ username?: string | null }> | null;
  };
}

interface XdkUser {
  id?: string;
  username?: string;
  name?: string;
}

export interface XTimelineSourceOptions {
  client?: Client;
  preloadedMe?: Me;
}

function isOptions(v: Client | XTimelineSourceOptions): v is XTimelineSourceOptions {
  return "client" in v || "preloadedMe" in v;
}

export class XTimelineSource implements TimelineSource {
  private readonly client: Client;
  private readonly preloadedMe?: Me;
  private meCache?: Me;

  constructor(token: string, clientOrOptions: Client | XTimelineSourceOptions = {}) {
    if (isOptions(clientOrOptions)) {
      this.client = clientOrOptions.client ?? new Client({ accessToken: token });
      this.preloadedMe = clientOrOptions.preloadedMe;
    } else {
      this.client = clientOrOptions;
    }
  }

  get meFromCache(): boolean {
    return this.meCache !== undefined;
  }

  async fetchMe(): Promise<Me> {
    if (this.meCache) return this.meCache;
    if (this.preloadedMe) {
      this.meCache = this.preloadedMe;
      return this.meCache;
    }
    const meResponse = await this.client.users.getMe();
    this.meCache = this.toMe(meResponse.data);
    return this.meCache;
  }

  async fetchTimeline(limit: number): Promise<{ me: Me; items: FeedItem[] }> {
    const me = await this.fetchMe();

    const response = await this.client.users.getTimeline(me.id, {
      max_results: limit,
      "post.fields": [...POST_FIELDS],
      "user.fields": [...USER_FIELDS],
      expansions: [...EXPANSIONS],
    });

    const posts = (response.data ?? []).map((p) => this.toRawPost(p));
    const users = (response.includes?.users ?? []).map((u) => this.toRawUser(u));
    return { me, items: normalizePosts(posts, users, me) };
  }

  private toMe(data: unknown): Me {
    const me = data as XdkUser;
    return { id: me.id ?? "", username: me.username ?? "", name: me.name ?? "" };
  }

  private toRawPost(p: unknown): RawPost {
    const post = p as XdkPost;
    return {
      id: post.id ?? "",
      text: post.text,
      author_id: post.authorId,
      created_at: post.createdAt,
      in_reply_to_user_id: post.inReplyToUserId,
      referenced_tweets: (post.referencedPosts ?? []).map((r) => ({
        id: r.id ?? "",
        type: r.type ?? "replied_to",
      })),
      public_metrics: {
        like_count: post.publicMetrics?.likeCount ?? 0,
        retweet_count: post.publicMetrics?.repostCount ?? post.publicMetrics?.retweetCount ?? 0,
        reply_count: post.publicMetrics?.replyCount ?? 0,
        quote_count: post.publicMetrics?.quoteCount ?? 0,
      },
      entities: {
        urls: post.entities?.urls ?? [],
        mentions: (post.entities?.mentions ?? []).map((m) => ({
          username: m.username ?? undefined,
        })),
      },
    };
  }

  private toRawUser(u: unknown): RawUser {
    const user = u as XdkUser;
    return { id: user.id ?? "", username: user.username, name: user.name };
  }
}