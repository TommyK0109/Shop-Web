import { beforeEach, describe, expect, it, vi } from "vitest";
import { isMailConfigured, sendAccountEmail } from "../src/services/mail.services";
import { env } from "../src/env";

const smtp = vi.hoisted(() => ({ sendMail: vi.fn(), createTransport: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: smtp.createTransport } }));
vi.mock("../src/env", () => ({ env: {
  NODE_ENV: "production", SMTP_HOST: "smtp.example.com", SMTP_FROM: "Storefront <accounts@example.com>",
  SMTP_PORT: 587, SMTP_SECURE: false, SMTP_USER: "user", SMTP_PASSWORD: "password",
  CLIENT_ORIGIN: "https://shop.example.com", CLIENT_URL: "https://shop.example.com/storefront/",
} }));
beforeEach(() => {
  smtp.createTransport.mockReturnValue({ sendMail: smtp.sendMail });
  smtp.sendMail.mockResolvedValue({ accepted: ["user@example.com"], rejected: [] });
});

describe("SMTP account emails", () => {
  it("requires complete configuration and does not treat missing credentials as delivery", () => {
    expect(isMailConfigured()).toBe(true);
    const password = env.SMTP_PASSWORD; env.SMTP_PASSWORD = "";
    expect(isMailConfigured()).toBe(false); env.SMTP_PASSWORD = password;
  });
  it("uses STARTTLS and server credentials and includes the base path in verification links", async () => {
    await sendAccountEmail("user@example.com", "verify_email", "a".repeat(64));
    expect(smtp.createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: false, requireTLS: true, auth: { user: "user", pass: "password" } }));
    const message = smtp.sendMail.mock.calls.at(-1)![0];
    expect(message.text).toContain(`https://shop.example.com/storefront/verify-email#token=${"a".repeat(64)}`);
    expect(message.text).toContain("24 hours");
    expect(message.html).toContain("Verify email address");
    expect(message.text).not.toContain("password=password");
  });
  it("generates reset links with the shorter expiry and no password in the email", async () => {
    await sendAccountEmail("user@example.com", "reset_password", "b".repeat(64));
    const message = smtp.sendMail.mock.calls.at(-1)![0];
    expect(message.text).toContain(`reset-password#token=${"b".repeat(64)}`);
    expect(message.text).toContain("30 minutes");
    expect(message.subject).toContain("Reset");
  });
  it("rejects recipient rejection rather than reporting delivery", async () => {
    smtp.sendMail.mockResolvedValueOnce({ accepted: [], rejected: ["user@example.com"] });
    await expect(sendAccountEmail("user@example.com", "verify_email", "token")).rejects.toThrow("SMTP did not accept");
  });
});
