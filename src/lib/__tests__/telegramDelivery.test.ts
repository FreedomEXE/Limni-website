import { describe, expect, it, vi } from "vitest";
import { sendTelegramText, splitTelegramMessage } from "@/lib/poseidon/telegram-delivery";

describe("telegram delivery", () => {
  it("splits long text into Telegram-safe chunks", () => {
    const input = "Line\n".repeat(500);
    const chunks = splitTelegramMessage(input, 800);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 800)).toBe(true);
    expect(chunks.join("\n")).toContain("Line");
  });

  it("sends reply metadata only on first chunk", async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const telegram = { sendMessage } as unknown as Parameters<typeof sendTelegramText>[0];
    const text = "A".repeat(4500);

    await sendTelegramText(telegram, 123, text, {
      parseMode: "Markdown",
      replyToMessageId: 456,
      chunkSize: 2000,
    });

    expect(sendMessage).toHaveBeenCalledTimes(3);
    const firstCallOptions = sendMessage.mock.calls[0]?.[2];
    const secondCallOptions = sendMessage.mock.calls[1]?.[2];
    expect(firstCallOptions?.reply_parameters?.message_id).toBe(456);
    expect(secondCallOptions?.reply_parameters).toBeUndefined();
  });

  it("falls back to plain text when parse mode fails", async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error("can't parse entities"))
      .mockResolvedValueOnce(undefined);
    const telegram = { sendMessage } as unknown as Parameters<typeof sendTelegramText>[0];

    await sendTelegramText(telegram, 123, "test markdown", { parseMode: "Markdown" });

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage.mock.calls[0]?.[2]?.parse_mode).toBe("Markdown");
    expect(sendMessage.mock.calls[1]?.[2]?.parse_mode).toBeUndefined();
  });

  it("dynamically re-splits when Telegram still reports message too long", async () => {
    const sendMessage = vi.fn().mockImplementation(
      async (_chatId: number, text: string) => {
        if (text.length > 900) {
          throw new Error("400: Bad Request: message is too long");
        }
      },
    );
    const telegram = { sendMessage } as unknown as Parameters<typeof sendTelegramText>[0];
    const payload = "X".repeat(1800);

    await sendTelegramText(telegram, 123, payload, { chunkSize: 1800 });

    expect(sendMessage.mock.calls.length).toBeGreaterThan(2);
    expect(sendMessage.mock.calls.some((call) => String(call[1]).length <= 900)).toBe(true);
  });
});
