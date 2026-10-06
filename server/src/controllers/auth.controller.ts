import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import type { RegisterInput, LoginInput } from "@storefront/shared";
import { prisma } from "../lib/prisma";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt";
import { AppError } from "../middleware/errorHandler.middleware";
import { env } from "../env";
import type { User } from "@prisma/client";
import { verifyCaptcha } from "../services/captcha.services";
import { isMailConfigured } from "../services/mail.services";
import { deliverEmailToken, hashEmailToken } from "../services/emailTokens.services";

export function publicUser(user: User) {
  return { id: user.id, email: user.email, role: user.role, avatarUrl: user.avatarUrl, emailVerifiedAt: user.emailVerifiedAt };
}

const REFRESH_COOKIE = "refreshToken";
const isCrossSiteDeploy = env.NODE_ENV === "production";

const refreshCookieOptions = {
  httpOnly: true,
  secure: isCrossSiteDeploy,
  sameSite: isCrossSiteDeploy ? ("none" as const) : ("lax" as const),
  path: "/api/auth",
};

function issueTokens(res: Response, user: User) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role, tokenVersion: user.tokenVersion });
  const refreshToken = signRefreshToken({ sub: user.id, tokenVersion: user.tokenVersion });
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
  return accessToken;
}

export async function register(req: Request, res: Response) {
  const { email, password, captchaToken } = req.body as RegisterInput;
  await verifyCaptcha(captchaToken, "register");

  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (existing) {
    throw new AppError(409, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let user: User;
  try {
    user = await prisma.user.create({ data: { email, passwordHash, role: "customer" } });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      throw new AppError(409, "An account with this email already exists");
    }
    throw error;
  }

  let verificationEmailSent = false;
  if (isMailConfigured()) {
    try { await deliverEmailToken(user, "verify_email"); verificationEmailSent = true; }
    catch { console.error("Signup verification email delivery failed"); }
  }

  const accessToken = issueTokens(res, user);
  res.status(201).json({
    user: publicUser(user),
    accessToken,
    verificationEmailSent,
  });
}

export async function login(req: Request, res: Response) {
  const { email, password, captchaToken } = req.body as LoginInput;
  await verifyCaptcha(captchaToken, "login");

  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  // Same error for "no such user" and "wrong password" so the response
  // doesn't leak which emails are registered.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, "Invalid email or password");
  }

  const accessToken = issueTokens(res, user);
  res.status(200).json({
    user: publicUser(user),
    accessToken,
  });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) {
    throw new AppError(401, "Missing refresh token");
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.tokenVersion !== (payload.tokenVersion ?? 0)) {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role, tokenVersion: user.tokenVersion });
  res.status(200).json({ accessToken, user: publicUser(user) });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
  res.status(204).send();
}

export async function getMe(req: Request, res: Response) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  res.json({ user: publicUser(user) });
}

export async function forgotPassword(req: Request, res: Response) {
  await verifyCaptcha(req.body.captchaToken, "forgot_password");
  if (!isMailConfigured()) throw new AppError(503, "Password reset emails are unavailable. Please contact support.");
  const user = await prisma.user.findFirst({ where: { email: { equals: req.body.email, mode: "insensitive" } } });
  if (user) {
    try { await deliverEmailToken(user, "reset_password"); }
    catch { console.error("Password reset email delivery failed"); }
  }
  // Same response for known/unknown addresses and delivery failures.
  res.json({ message: "If an account exists for this email, you will receive a password reset link shortly." });
}

export async function resetPassword(req: Request, res: Response) {
  const passwordHash = await bcrypt.hash(req.body.password, 10);
  await prisma.$transaction(async (tx) => {
    const token = await tx.emailToken.findUnique({ where: { tokenHash: hashEmailToken(req.body.token) } });
    if (!token || token.purpose !== "reset_password") throw new AppError(400, "This reset link is invalid or expired. Please request a new one.");
    const consumed = await tx.emailToken.deleteMany({ where: { id: token.id, expiresAt: { gt: new Date() } } });
    if (!consumed.count) throw new AppError(400, "This reset link is invalid or expired. Please request a new one.");
    await tx.user.update({ where: { id: token.userId }, data: { passwordHash, tokenVersion: { increment: 1 } } });
    await tx.emailToken.deleteMany({ where: { userId: token.userId, purpose: "reset_password" } });
  });
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
  res.json({ message: "Your password has been updated. Sign in with your new password." });
}

export async function verifyEmail(req: Request, res: Response) {
  const user = await prisma.$transaction(async (tx) => {
    const token = await tx.emailToken.findUnique({ where: { tokenHash: hashEmailToken(req.body.token) } });
    if (!token || token.purpose !== "verify_email") throw new AppError(400, "This verification link is invalid or expired. Please request a new one.");
    const consumed = await tx.emailToken.deleteMany({ where: { id: token.id, expiresAt: { gt: new Date() } } });
    if (!consumed.count) throw new AppError(400, "This verification link is invalid or expired. Please request a new one.");
    const updated = await tx.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: new Date() } });
    await tx.emailToken.deleteMany({ where: { userId: token.userId, purpose: "verify_email" } });
    return updated;
  });
  // Only update the profile in an existing matching session on the client;
  // email verification itself never authenticates a visitor.
  res.json({ message: "Your email address is verified.", user: publicUser(user) });
}

export async function resendVerification(req: Request, res: Response) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (user.emailVerifiedAt) return res.json({ message: "Your email address is already verified." });
  if (!isMailConfigured()) throw new AppError(503, "Verification emails are unavailable. Please contact support.");
  try { await deliverEmailToken(user, "verify_email"); }
  catch { throw new AppError(503, "We could not send the email. Please try again later."); }
  res.json({ message: "A verification link has been sent. Check your inbox and spam folder." });
}
