import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { signAccessToken, signRefreshToken } from "../src/lib/jwt";
import { AppError } from "../src/middleware/errorHandler.middleware";
import { sendAccountEmail, isMailConfigured } from "../src/services/mail.services";
import { uploadProfileImage, deleteProfileImage } from "../src/services/cloudinary.services";
import { hashEmailToken } from "../src/services/emailTokens.services";

vi.mock("../src/services/captcha.services", () => ({ verifyCaptcha: vi.fn(async (token?: string) => {
  if (token !== "test-captcha") throw new AppError(400, "Please complete the security check.");
}) }));
vi.mock("../src/services/mail.services", () => ({ isMailConfigured: vi.fn(() => true), sendAccountEmail: vi.fn() }));
vi.mock("../src/services/cloudinary.services", () => ({ uploadProfileImage: vi.fn(), deleteProfileImage: vi.fn() }));

const users: string[] = [];
let ip = 0;
const password = "Password123!";
const call = (method: "post" | "get" | "delete", path: string) => request(app)[method](`/api/auth${path}`).set("X-Forwarded-For", `192.0.2.${++ip}`);
async function fixture() {
  const user = await prisma.user.create({ data: { email: `security-${randomUUID()}@example.com`, passwordHash: await bcrypt.hash(password, 4) } });
  users.push(user.id); return user;
}
async function storedToken(userId: string, purpose: string, expiresAt = new Date(Date.now() + 60000)) {
  const token = randomBytes(32).toString("hex");
  await prisma.emailToken.create({ data: { userId, purpose, tokenHash: hashEmailToken(token), expiresAt } });
  return token;
}
beforeAll(() => { app.set("trust proxy", 1); });
beforeEach(() => {
  vi.mocked(sendAccountEmail).mockReset().mockResolvedValue(undefined);
  vi.mocked(isMailConfigured).mockReturnValue(true);
  vi.mocked(uploadProfileImage).mockReset().mockResolvedValue({ url: "https://images.example.com/new.webp", publicId: "storefront/avatars/new" });
  vi.mocked(deleteProfileImage).mockReset().mockResolvedValue(undefined);
});
afterAll(async () => { app.set("trust proxy", 0); await prisma.user.deleteMany({ where: { id: { in: users } } }); });

describe("account security API", () => {
  it("blocks sign in and sign up when CAPTCHA is missing", async () => {
    const email = `blocked-${randomUUID()}@example.com`;
    expect((await call("post", "/register").send({ email, password })).status).toBe(400);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    expect((await call("post", "/login").send({ email, password })).status).toBe(400);
  });
  it("normalizes signup email, sends verification, and stores only the token hash", async () => {
    const email = `new-${randomUUID()}@example.com`;
    const result = await call("post", "/register").send({ email: email.toUpperCase(), password, captchaToken: "test-captcha" });
    expect(result.status).toBe(201); users.push(result.body.user.id);
    expect(result.body.user).toMatchObject({ email, avatarUrl: null, emailVerifiedAt: null });
    expect(result.body.verificationEmailSent).toBe(true);
    const sent = vi.mocked(sendAccountEmail).mock.calls[0];
    expect(sent.slice(0, 2)).toEqual([email, "verify_email"]);
    const stored = await prisma.emailToken.findFirstOrThrow({ where: { userId: result.body.user.id } });
    expect(stored.tokenHash).toBe(hashEmailToken(sent[2]));
    expect(stored.tokenHash).not.toBe(sent[2]);
    expect(result.body.user.passwordHash).toBeUndefined();
  });
  it("keeps a new account usable when signup email delivery fails and invalidates the unsent token", async () => {
    vi.mocked(sendAccountEmail).mockRejectedValueOnce(new Error("SMTP outage"));
    const email = `mail-failed-${randomUUID()}@example.com`;
    const result = await call("post", "/register").send({ email, password, captchaToken: "test-captcha" });
    expect(result.status).toBe(201); users.push(result.body.user.id);
    expect(result.body.verificationEmailSent).toBe(false);
    expect(await prisma.emailToken.count({ where: { userId: result.body.user.id } })).toBe(0);
    expect((await call("post", "/login").send({ email, password, captchaToken: "test-captcha" })).status).toBe(200);
  });
  it("verifies email once, refuses wrong-purpose links, and rejects replay", async () => {
    const user = await fixture();
    const wrong = await storedToken(user.id, "reset_password");
    expect((await call("post", "/verify-email").send({ token: wrong })).status).toBe(400);
    const token = await storedToken(user.id, "verify_email");
    const result = await call("post", "/verify-email").send({ token });
    expect(result.status).toBe(200); expect(result.body.user.emailVerifiedAt).toBeTruthy();
    expect(result.body.accessToken).toBeUndefined();
    expect((await call("post", "/verify-email").send({ token })).status).toBe(400);
  });
  it("rejects expired verification and reset links without changing credentials", async () => {
    const user = await fixture();
    for (const purpose of ["verify_email", "reset_password"]) {
      const token = await storedToken(user.id, purpose, new Date(Date.now() - 1000));
      const result = await call("post", purpose === "verify_email" ? "/verify-email" : "/reset-password").send({ token, password: "Replacement123!" });
      expect(result.status).toBe(400);
    }
    const unchanged = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(unchanged.emailVerifiedAt).toBeNull(); expect(unchanged.passwordHash).toBe(user.passwordHash);
  });
  it("does not expose account existence through password recovery responses", async () => {
    const user = await fixture();
    const known = await call("post", "/forgot-password").send({ email: user.email, captchaToken: "test-captcha" });
    const unknown = await call("post", "/forgot-password").send({ email: `unknown-${randomUUID()}@example.com`, captchaToken: "test-captcha" });
    expect(known.status).toBe(200); expect(unknown.status).toBe(200); expect(known.body).toEqual(unknown.body);
    expect(sendAccountEmail).toHaveBeenCalledTimes(1);
    vi.mocked(sendAccountEmail).mockRejectedValueOnce(new Error("delivery failure"));
    const failure = await call("post", "/forgot-password").send({ email: user.email, captchaToken: "test-captcha" });
    expect(failure.body).toEqual(unknown.body);
  });
  it("returns a clear unavailable response when SMTP is not configured", async () => {
    vi.mocked(isMailConfigured).mockReturnValue(false);
    const result = await call("post", "/forgot-password").send({ email: "unknown@example.com", captchaToken: "test-captcha" });
    expect(result.status).toBe(503); expect(sendAccountEmail).not.toHaveBeenCalled();
  });
  it("resets once, invalidates other links and previous sessions, and accepts the new password", async () => {
    const user = await fixture(); const token = await storedToken(user.id, "reset_password");
    const other = await storedToken(user.id, "reset_password");
    const access = signAccessToken({ sub: user.id, role: user.role });
    const refresh = signRefreshToken({ sub: user.id });
    const result = await call("post", "/reset-password").send({ token, password: "Replacement123!" });
    expect(result.status).toBe(200);
    for (const reused of [token, other]) expect((await call("post", "/reset-password").send({ token: reused, password: "Another123!" })).status).toBe(400);
    expect((await call("get", "/me").set("Authorization", `Bearer ${access}`)).status).toBe(401);
    expect((await call("post", "/refresh").set("Cookie", `refreshToken=${refresh}`)).status).toBe(401);
    expect((await call("post", "/login").send({ email: user.email, password, captchaToken: "test-captcha" })).status).toBe(401);
    const login = await call("post", "/login").send({ email: user.email, password: "Replacement123!", captchaToken: "test-captcha" });
    expect(login.status).toBe(200);
    expect((await call("get", "/me").set("Authorization", `Bearer ${login.body.accessToken}`)).status).toBe(200);
  });
  it("requires authentication for profile changes and verification resends", async () => {
    expect((await call("post", "/avatar")).status).toBe(401);
    expect((await call("delete", "/avatar")).status).toBe(401);
    expect((await call("post", "/resend-verification")).status).toBe(401);
  });
  it("resends verification only to the signed-in account and skips already verified users", async () => {
    const user = await fixture();
    const auth = `Bearer ${signAccessToken({ sub: user.id, role: user.role })}`;
    const result = await call("post", "/resend-verification").set("Authorization", auth).send({ email: "someone-else@example.com" });
    expect(result.status).toBe(200);
    expect(vi.mocked(sendAccountEmail).mock.calls[0].slice(0, 2)).toEqual([user.email, "verify_email"]);
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    expect((await call("post", "/resend-verification").set("Authorization", auth)).status).toBe(200);
    expect(sendAccountEmail).toHaveBeenCalledTimes(1);
  });
  it("allows exactly one concurrent use of a reset link", async () => {
    const user = await fixture(); const token = await storedToken(user.id, "reset_password");
    const results = await Promise.all([
      call("post", "/reset-password").send({ token, password: "FirstPassword123!" }),
      call("post", "/reset-password").send({ token, password: "SecondPassword123!" }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).tokenVersion).toBe(1);
  });
  it("uploads and removes only the signed-in user's photo, and includes it in restored sessions", async () => {
    const user = await fixture(); const other = await fixture();
    await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: "https://images.example.com/old.webp", avatarPublicId: "storefront/avatars/old" } });
    const auth = `Bearer ${signAccessToken({ sub: user.id, role: user.role })}`;
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=", "base64");
    const uploaded = await call("post", "/avatar").set("Authorization", auth).attach("image", png, { filename: "photo.png", contentType: "image/png" });
    expect(uploaded.status).toBe(200); expect(uploaded.body.user.avatarUrl).toBe("https://images.example.com/new.webp");
    expect(deleteProfileImage).toHaveBeenCalledWith("storefront/avatars/old");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).avatarUrl).toBeNull();
    const restored = await call("post", "/refresh").set("Cookie", `refreshToken=${signRefreshToken({ sub: user.id })}`);
    expect(restored.body.user.avatarUrl).toBe(uploaded.body.user.avatarUrl);
    const removed = await call("delete", "/avatar").set("Authorization", auth);
    expect(removed.status).toBe(200); expect(removed.body.user.avatarUrl).toBeNull();
    expect(deleteProfileImage).toHaveBeenCalledWith("storefront/avatars/new");
  });
  it("rejects fake images, SVGs, missing files, and oversized uploads before Cloudinary", async () => {
    const user = await fixture(); const auth = `Bearer ${signAccessToken({ sub: user.id, role: user.role })}`;
    expect((await call("post", "/avatar").set("Authorization", auth)).status).toBe(400);
    for (const [mime, buffer] of [["image/png", Buffer.from("not an image")], ["image/svg+xml", Buffer.from("<svg/>")], ["image/png", Buffer.alloc(5 * 1024 * 1024 + 1)] ] as const) {
      const result = await call("post", "/avatar").set("Authorization", auth).attach("image", buffer, { filename: "image", contentType: mime });
      expect(result.status).toBe(400);
    }
    expect(uploadProfileImage).not.toHaveBeenCalled();
  });
});
