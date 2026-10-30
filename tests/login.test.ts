import { describe, it, expect, vi } from "vitest";
import { requestMagicLink, type SendOtp } from "@/lib/login";
import { ok } from "@/lib/result";

const OWNER = "Owner@Example.com";
const deps = (sendOtp: SendOtp) => ({ ownerEmail: OWNER, redirectTo: "https://app.test/auth/callback", sendOtp });

describe("requestMagicLink", () => {
  // Strangers must never get an OTP (no account creation) yet see the same response (no enumeration).
  it("does not send an OTP for a non-owner email but reports the same neutral outcome", async () => {
    const send = vi.fn<SendOtp>(async () => ok(null));
    const r = await requestMagicLink("attacker@example.com", deps(send));
    expect(send).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, value: "CHECK_EMAIL" });
  });

  it("does not send for look-alike owner addresses", async () => {
    const send = vi.fn<SendOtp>(async () => ok(null));
    await requestMagicLink("owner@example.com.evil.io", deps(send));
    await requestMagicLink("owner+x@example.com", deps(send));
    expect(send).not.toHaveBeenCalled();
  });

  it("sends exactly one OTP for the owner, case-insensitively", async () => {
    const send = vi.fn<SendOtp>(async () => ok(null));
    const r = await requestMagicLink("  owner@EXAMPLE.com ", deps(send));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("owner@example.com", "https://app.test/auth/callback");
    expect(r.ok).toBe(true);
  });

  it("rejects malformed input without sending", async () => {
    const send = vi.fn<SendOtp>(async () => ok(null));
    expect(await requestMagicLink("not-an-email", deps(send))).toMatchObject({ ok: false, error: "INVALID_EMAIL" });
    expect(await requestMagicLink(null, deps(send))).toMatchObject({ ok: false, error: "INVALID_EMAIL" });
    expect(send).not.toHaveBeenCalled();
  });

  it("surfaces a send failure for the owner instead of pretending success", async () => {
    const send = vi.fn<SendOtp>(async () => ({ ok: false as const, error: "SEND_FAILED" as const }));
    expect(await requestMagicLink(OWNER, deps(send))).toMatchObject({ ok: false, error: "SEND_FAILED" });
  });
});
