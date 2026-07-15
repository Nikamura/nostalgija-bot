import type { Message } from "@mtcute/node";
import { describe, expect, it } from "vitest";
import { toNostalgiaMessage } from "./telegram.js";

function sourceMessage(replyOrigin: "same_chat" | "other_chat"): Message {
  return {
    id: 10,
    sender: { displayName: "Karolis" },
    text: "A message",
    reactions: null,
    media: null,
    replyToMessage: {
      id: 7,
      originIs: (origin: string) => origin === replyOrigin,
    },
  } as unknown as Message;
}

describe("toNostalgiaMessage", () => {
  it("keeps same-chat reply IDs", () => {
    expect(toNostalgiaMessage(sourceMessage("same_chat")).replyToMessageId).toBe(
      7,
    );
  });

  it("does not mix message IDs from another chat into reply scoring", () => {
    expect(
      toNostalgiaMessage(sourceMessage("other_chat")).replyToMessageId,
    ).toBeNull();
  });
});
