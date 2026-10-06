import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { sendAccountEmail } from "./mail.services";

export const hashEmailToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function deliverEmailToken(user: { id: string; email: string }, purpose: "verify_email" | "reset_password") {
  const token = randomBytes(32).toString("hex");
  const row = await prisma.emailToken.create({ data: {
    userId: user.id, purpose, tokenHash: hashEmailToken(token),
    expiresAt: new Date(Date.now() + (purpose === "verify_email" ? 24 * 60 * 60_000 : 30 * 60_000)),
  } });
  try { await sendAccountEmail(user.email, purpose, token); }
  catch (error) {
    await prisma.emailToken.deleteMany({ where: { id: row.id } });
    throw error;
  }
}
