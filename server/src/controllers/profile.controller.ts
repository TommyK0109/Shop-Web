import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { publicUser } from "./auth.controller";
import { uploadProfileImage, deleteProfileImage } from "../services/cloudinary.services";
import { validImageSignature } from "../middleware/avatarUpload.middleware";
import { AppError } from "../middleware/errorHandler.middleware";

async function cleanup(publicId: string | null) {
  try { await deleteProfileImage(publicId); }
  catch { console.error("Previous profile image cleanup failed"); }
}

export async function updateAvatar(req: Request, res: Response) {
  if (!req.file || !validImageSignature(req.file.buffer, req.file.mimetype)) throw new AppError(400, "Choose a valid JPEG, PNG, or WebP image.");
  const previous = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  let image;
  try { image = await uploadProfileImage(req.file.buffer); }
  catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(502, "Your photo could not be uploaded. Please try again.");
  }
  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: previous.id, avatarPublicId: previous.avatarPublicId },
        data: { avatarUrl: image.url, avatarPublicId: image.publicId },
      });
      if (!updated.count) throw new AppError(409, "Your photo changed in another session. Please try again.");
      return tx.user.findUniqueOrThrow({ where: { id: previous.id } });
    });
  } catch (error) {
    await cleanup(image.publicId);
    throw error;
  }
  await cleanup(previous.avatarPublicId);
  res.json({ user: publicUser(user) });
}

export async function removeAvatar(req: Request, res: Response) {
  const previous = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id: previous.id, avatarPublicId: previous.avatarPublicId },
      data: { avatarUrl: null, avatarPublicId: null },
    });
    if (!updated.count) throw new AppError(409, "Your photo changed in another session. Please try again.");
    return tx.user.findUniqueOrThrow({ where: { id: previous.id } });
  });
  await cleanup(previous.avatarPublicId);
  res.json({ user: publicUser(user) });
}
