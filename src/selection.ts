import { randomInt } from "node:crypto";

export interface NostalgiaMessage<T = unknown> {
  id: number;
  author: string;
  text: string;
  replyToMessageId: number | null;
  reactionCount: number;
  hasPhoto: boolean;
  isBot: boolean;
  source: T;
}

export type SelectionType = "random" | "reactions" | "replies";

export interface Selection<T = unknown> {
  message: NostalgiaMessage<T>;
  type: SelectionType;
  replyCount: number;
  reactionCount: number;
}

export interface AnniversarySelection<T = unknown> {
  yearsAgo: number;
  selection: Selection<T>;
}

export interface BonusThresholds {
  minReactions: number;
  minReplies: number;
}

interface AnalyzedMessage<T> {
  message: NostalgiaMessage<T>;
  replyCount: number;
  reactionCount: number;
}

function analyzeMessages<T>(
  dayMessages: NostalgiaMessage<T>[],
): AnalyzedMessage<T>[] {
  const humanMessages = dayMessages.filter((message) => !message.isBot);
  const viable = humanMessages.filter(
    (message) => Array.from(message.text).length > 4 || message.hasPhoto,
  );
  const replyCounts = new Map<number, number>();
  for (const message of humanMessages) {
    if (message.replyToMessageId !== null) {
      replyCounts.set(
        message.replyToMessageId,
        (replyCounts.get(message.replyToMessageId) ?? 0) + 1,
      );
    }
  }

  return viable.map((message) => ({
    message,
    replyCount: replyCounts.get(message.id) ?? 0,
    reactionCount: message.reactionCount,
  }));
}

function asSelection<T>(
  analyzed: AnalyzedMessage<T>,
  type: SelectionType,
): Selection<T> {
  return { ...analyzed, type };
}

function engagementScore(selection: Selection): number {
  return Math.max(selection.reactionCount, selection.replyCount * 1.5);
}

export function selectMessage<T>(
  dayMessages: NostalgiaMessage<T>[],
  pickRandom: (upperBound: number) => number = randomInt,
): Selection<T> | null {
  const analyzed = analyzeMessages(dayMessages);
  if (analyzed.length === 0) return null;

  let mostReplied: AnalyzedMessage<T> | null = null;
  let maxReplies = 1;
  for (const candidate of analyzed) {
    if (candidate.replyCount > maxReplies) {
      mostReplied = candidate;
      maxReplies = candidate.replyCount;
    }
  }

  let mostReacted: AnalyzedMessage<T> | null = null;
  let maxReactions = 1;
  for (const candidate of analyzed) {
    if (candidate.reactionCount > maxReactions) {
      mostReacted = candidate;
      maxReactions = candidate.reactionCount;
    }
  }

  if (!mostReplied && !mostReacted) {
    return asSelection(analyzed[pickRandom(analyzed.length)]!, "random");
  }
  if (!mostReplied) return asSelection(mostReacted!, "reactions");
  if (!mostReacted) return asSelection(mostReplied, "replies");

  return maxReplies * 1.5 > maxReactions
    ? asSelection(mostReplied, "replies")
    : asSelection(mostReacted, "reactions");
}

export function selectExceptionalMessage<T>(
  dayMessages: NostalgiaMessage<T>[],
  thresholds: BonusThresholds,
): Selection<T> | null {
  const qualified = analyzeMessages(dayMessages)
    .filter((candidate) => {
      return (
        candidate.reactionCount >= thresholds.minReactions ||
        candidate.replyCount >= thresholds.minReplies
      );
    })
    .map((candidate) => {
      const type =
        candidate.replyCount * 1.5 > candidate.reactionCount
          ? "replies"
          : "reactions";
      return asSelection(candidate, type);
    });

  return qualified.sort(
    (left, right) => engagementScore(right) - engagementScore(left),
  )[0] ?? null;
}

export function chooseBonus<T>(
  candidates: AnniversarySelection<T>[],
  thresholds: BonusThresholds,
): AnniversarySelection<T> | null {
  const qualified = candidates.filter(({ selection }) => {
    return (
      selection.reactionCount >= thresholds.minReactions ||
      selection.replyCount >= thresholds.minReplies
    );
  });

  return (
    qualified.sort((left, right) => {
      const leftScore = engagementScore(left.selection);
      const rightScore = engagementScore(right.selection);
      return rightScore - leftScore;
    })[0] ?? null
  );
}

export function formatMotd(
  selection: Selection,
  options: { yearsAgo?: number; bonus?: boolean } = {},
): string {
  const { author, text } = selection.message;
  const body = text ? `:\n${text}` : "";
  const heading = options.bonus
    ? `Bonus MOTD from ${options.yearsAgo} years ago, from ${author}`
    : `MOTD from ${author}`;
  const reason = options.bonus
    ? `${selection.reactionCount} reactions · ${selection.replyCount} replies`
    : `Selected based on ${selection.type}`;
  return `${heading}${body}\n\n${reason}`;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  if (maxLength <= 0) return "";

  let result = "";
  const contentLimit = maxLength - 1;
  for (const character of text) {
    if (result.length + character.length > contentLimit) break;
    result += character;
  }
  return `${result}…`;
}
