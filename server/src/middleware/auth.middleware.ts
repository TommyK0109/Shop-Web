import type { NextFunction, Request, Response } from "express";
import { AppError } from "./errorHandler.middleware";
import { verifyAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "Missing or malformed Authorization header"));
  }

  const token = header.slice("Bearer ".length);
  let payload;
  try { payload = verifyAccessToken(token); }
  catch { return next(new AppError(401, "Invalid or expired access token")); }
  try {
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, tokenVersion: true } });
    if (!user || user.tokenVersion !== (payload.tokenVersion ?? 0)) {
      return next(new AppError(401, "Your session has expired. Please sign in again."));
    }
    req.user = { id: user.id, role: user.role };
    next();
  } catch (error) { next(error); }
}
