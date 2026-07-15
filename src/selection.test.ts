import { describe, expect, it } from "vitest";
import {
  chooseBonus,
  formatMotd,
  selectExceptionalMessage,
  selectMessage,
  truncate,
} from "./selection.js";

function message(
  id: number,
  overrides: Partial<{
    text: string;
    replyToMessageId: number | null;
    reactionCount: number;
    hasPhoto: boolean;
    isBot: boolean;
  }> = {},
) {
  return {
    id,
    author: `User ${id}`,
    text: "A viable message",
    replyToMessageId: null,
    reactionCount: 0,
    hasPhoto: false,
    isBot: false,
    source: null,
    ...overrides,
  };
}

describe("selectMessage", () => {
  it("returns null when there are no viable messages", () => {
    expect(selectMessage([message(1, { text: "hey" })])).toBeNull();
  });

  it("uses the supplied random picker when there is no engagement", () => {
    const selected = selectMessage([message(1), message(2)], () => 1);
    expect(selected).toMatchObject({ type: "random", message: { id: 2 } });
  });

  it("selects a message with multiple replies", () => {
    const selected = selectMessage([
      message(1),
      message(2, { replyToMessageId: 1 }),
      message(3, { replyToMessageId: 1 }),
    ]);
    expect(selected).toMatchObject({
      type: "replies",
      replyCount: 2,
      reactionCount: 0,
      message: { id: 1 },
    });
  });

  it("selects reactions unless weighted replies win", () => {
    const selected = selectMessage([
      message(1),
      message(2, { reactionCount: 4, replyToMessageId: 1 }),
      message(3, { replyToMessageId: 1 }),
    ]);
    expect(selected).toMatchObject({ type: "reactions", message: { id: 2 } });
  });

  it("allows a photo without text", () => {
    const selected = selectMessage([
      message(1, { text: "", hasPhoto: true }),
    ]);
    expect(selected?.message.id).toBe(1);
  });

  it("excludes bot posts and bot-authored replies", () => {
    const selected = selectMessage([
      message(1),
      message(2, { isBot: true, reactionCount: 100 }),
      message(3, { isBot: true, replyToMessageId: 1 }),
      message(4, { replyToMessageId: 1 }),
    ], () => 0);

    expect(selected).toMatchObject({
      type: "random",
      replyCount: 1,
      message: { id: 1 },
    });
  });
});

describe("chooseBonus", () => {
  it("requires four reactions or three replies", () => {
    const reactions = selectMessage([
      message(1, { reactionCount: 4 }),
    ])!;
    const replies = selectMessage([
      message(2),
      message(3, { replyToMessageId: 2 }),
      message(4, { replyToMessageId: 2 }),
    ])!;

    expect(
      chooseBonus(
        [
          { yearsAgo: 3, selection: reactions },
          { yearsAgo: 5, selection: replies },
        ],
        { minReactions: 4, minReplies: 3 },
      ),
    ).toMatchObject({ yearsAgo: 3 });
  });

  it("chooses the strongest qualified anniversary", () => {
    const threeYear = selectMessage([
      message(1, { reactionCount: 4 }),
    ])!;
    const fiveYear = selectMessage([
      message(2),
      message(3, { replyToMessageId: 2 }),
      message(4, { replyToMessageId: 2 }),
      message(5, { replyToMessageId: 2 }),
    ])!;

    expect(
      chooseBonus(
        [
          { yearsAgo: 3, selection: threeYear },
          { yearsAgo: 5, selection: fiveYear },
        ],
        { minReactions: 4, minReplies: 3 },
      ),
    ).toMatchObject({ yearsAgo: 5 });
  });
});

describe("selectExceptionalMessage", () => {
  it("does not discard a qualifying reply candidate behind reactions", () => {
    const selected = selectExceptionalMessage(
      [
        message(1, { reactionCount: 9 }),
        message(2),
        message(3, { replyToMessageId: 2 }),
        message(4, { replyToMessageId: 2 }),
        message(5, { replyToMessageId: 2 }),
      ],
      { minReactions: 10, minReplies: 3 },
    );

    expect(selected).toMatchObject({
      type: "replies",
      replyCount: 3,
      message: { id: 2 },
    });
  });
});

describe("message formatting", () => {
  it("formats the existing MOTD shape", () => {
    const selected = selectMessage([message(1)], () => 0)!;
    expect(formatMotd(selected)).toBe(
      "MOTD from User 1:\nA viable message\n\nSelected based on random",
    );
  });

  it("labels a bonus anniversary and explains its engagement", () => {
    const selected = selectMessage([
      message(1, { reactionCount: 4 }),
    ])!;
    expect(formatMotd(selected, { yearsAgo: 3, bonus: true })).toBe(
      "Bonus MOTD from 3 years ago, from User 1:\nA viable message\n\n4 reactions · 0 replies",
    );
  });

  it("truncates to Telegram's UTF-16 limit without splitting emoji", () => {
    expect(truncate("ab😀cd", 4)).toBe("ab…");
    expect(truncate("😀😀😀", 5)).toBe("😀😀…");
  });
});
