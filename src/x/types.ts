export interface Me {
  id: string;
  username: string;
  name: string;
}

export interface FeedItem {
  id: string;
  text: string;
  authorId: string;
  authorUsername: string;
  authorName: string;
  createdAt: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  quotedTweetCount: number;
  isReplyToMe: boolean;
  isRetweet: boolean;
  hasLinks: boolean;
  mentionsMe: boolean;
}

export interface RawPost {
  id: string;
  text?: string;
  author_id?: string;
  created_at?: string;
  in_reply_to_user_id?: string;
  referenced_tweets?: Array<{ id: string; type: "replied_to" | "retweeted" | "quoted" }>;
  public_metrics?: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
    quote_count?: number;
  };
  entities?: {
    urls?: unknown[];
    mentions?: Array<{ username?: string }>;
  };
}

export interface RawUser {
  id: string;
  username?: string;
  name?: string;
}

export interface TimelinePage {
  posts: RawPost[];
  users: RawUser[];
}