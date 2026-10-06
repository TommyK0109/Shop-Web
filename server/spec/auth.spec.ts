import { afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";

// This suite exercises the existing session flow; CAPTCHA's fail-closed
// behavior is exercised separately in captcha.spec and account-security.spec.
vi.mock("../src/services/captcha.services", () => ({ verifyCaptcha: vi.fn() }));

// The one flow every other test short-circuits: helpers.tokenFor() signs
// tokens directly, so without this file the real register/login/refresh
// routes are never exercised end-to-end (PLAN.md §9).
describe("auth flow", () => {
  const email = `auth-${randomUUID()}@example.com`;
  const password = "Password123!";
  // supertest's agent keeps a cookie jar, so the httpOnly refresh cookie
  // set by register/login is replayed on /refresh the way a browser would.
  const agent = request.agent(app);

  afterAll(async () => {
    // The authenticated-route check below lazily created a cart for this
    // user, which holds an FK on it — drop that before the user row.
    await prisma.cart.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
  });

  it("rejects a password shorter than the shared schema allows", async () => {
    const res = await request(app).post("/api/auth/register").send({ email, password: "short" });
    expect(res.status).toBe(400);
  });

  it("rejects a malformed email", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: "not-an-email", password });
    expect(res.status).toBe(400);
  });

  it("registers a new account as a customer and returns an access token", async () => {
    const res = await agent.post("/api/auth/register").send({ email, password });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email, role: "customer" });
    expect(typeof res.body.accessToken).toBe("string");
    // The password must never come back, hashed or otherwise.
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("stores the password hashed, not in plain text", async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.passwordHash).toBeTruthy();
    expect(user?.passwordHash).not.toBe(password);
    expect(user?.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it("sets the refresh token as an httpOnly cookie, not in the body", async () => {
    const res = await request(app).post("/api/auth/login").send({ email, password });
    const cookies = res.headers["set-cookie"] as unknown as string[];

    expect(res.body.refreshToken).toBeUndefined();
    const refreshCookie = cookies.find((c) => c.startsWith("refreshToken="));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain("HttpOnly");
    expect(refreshCookie).toContain("Path=/api/auth");
  });

  it("blocks a second registration with the same email", async () => {
    const res = await request(app).post("/api/auth/register").send({ email, password });
    expect(res.status).toBe(409);
  });

  it("logs in with the right password", async () => {
    const res = await agent.post("/api/auth/login").send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });

  it("gives the same error for a wrong password as for an unknown email", async () => {
    const wrongPassword = await request(app).post("/api/auth/login").send({ email, password: "WrongPassword1!" });
    const unknownEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: `nobody-${randomUUID()}@example.com`, password });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    // Identical message, so the response can't be used to enumerate accounts.
    expect(wrongPassword.body.error).toBe(unknownEmail.body.error);
  });

  it("rotates the access token from the refresh cookie", async () => {
    const res = await agent.post("/api/auth/refresh").send();
    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe("string");
  });

  it("lets the rotated access token reach an authenticated route", async () => {
    const { body } = await agent.post("/api/auth/refresh").send();
    const res = await request(app).get("/api/cart").set("Authorization", `Bearer ${body.accessToken}`);
    expect(res.status).toBe(200);
  });

  it("refuses to refresh with no cookie at all", async () => {
    const res = await request(app).post("/api/auth/refresh").send();
    expect(res.status).toBe(401);
  });

  it("refuses to refresh with a forged cookie", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", "refreshToken=not.a.real.token")
      .send();
    expect(res.status).toBe(401);
  });

  it("clears the refresh cookie on logout, so refreshing stops working", async () => {
    const res = await agent.post("/api/auth/logout").send();
    expect(res.status).toBe(204);

    const afterLogout = await agent.post("/api/auth/refresh").send();
    expect(afterLogout.status).toBe(401);
  });
});
