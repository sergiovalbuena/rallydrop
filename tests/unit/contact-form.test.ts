import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; replyTo?: string; content: { subject: string; text: string } }[] = [];
vi.mock("@/lib/notify/email", () => ({ sendEmail: vi.fn(async (m) => void sent.push(m)) }));
vi.mock("@/lib/services/site-info", () => ({ getSiteInfo: vi.fn(async () => ({ email: "hello@rallydrop.ca" })) }));

const { sendContactAction } = await import("@/app/(site)/_actions/contact");

function form(data: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.set(k, v);
  return f;
}

describe("contact form", () => {
  beforeEach(() => void (sent.length = 0));

  it("emails the owner, replying to the visitor", async () => {
    const r = await sendContactAction(
      { status: "idle" },
      form({ name: "Sam", contact: "sam@example.com", message: "Do you deliver to Sooke?" }),
    );
    expect(r).toEqual({ status: "done" });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "hello@rallydrop.ca", replyTo: "sam@example.com" });
    expect(sent[0]!.content.text).toContain("Sooke");
  });

  it("accepts a phone number instead of an email", async () => {
    const r = await sendContactAction(
      { status: "idle" },
      form({ name: "Sam", contact: "250 123 4567", message: "Call me please" }),
    );
    expect(r.status).toBe("done");
    expect(sent[0]?.replyTo).toBeUndefined();
  });

  it("needs a way to reply and keeps what was typed", async () => {
    const r = await sendContactAction(
      { status: "idle" },
      form({ name: "Sam", contact: "abc", message: "Hello there" }),
    );
    expect(r).toMatchObject({ status: "error", values: { message: "Hello there" } });
    expect(sent).toHaveLength(0);
  });

  it("silently drops bots that fill the honeypot", async () => {
    const r = await sendContactAction(
      { status: "idle" },
      form({ name: "Bot", contact: "bot@example.com", message: "Buy now", website: "http://spam" }),
    );
    expect(r).toEqual({ status: "done" });
    expect(sent).toHaveLength(0);
  });
});
