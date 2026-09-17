import type { RankedPost } from "../rank/rank.js";

export interface FormatOptions {
  now?: Date;
  maxText?: number;
}

export function formatRanking(rows: RankedPost[], opts: FormatOptions = {}): string {
  const now = opts.now ?? new Date();
  const maxText = opts.maxText ?? 100;
  return rows
    .map((r, i) => {
      const when = fmtAge(now, new Date(r.createdAt));
      const text = truncate(r.text, maxText);
      const pct = Math.round(r.priority * 100);
      return `${String(i + 1).padStart(2)}. @${r.authorUsername} · ${when} · ${pct}% · ${r.reason}\n    ${text}`;
    })
    .join("\n");
}

function truncate(text: string, maxText: number): string {
  return text.length > maxText ? text.slice(0, maxText - 1) + "…" : text;
}

function fmtAge(now: Date, then: Date): string {
  if (Number.isNaN(then.getTime())) return "recent";
  const mins = Math.round((now.getTime() - then.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}