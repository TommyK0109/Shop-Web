import multer from "multer";
import type { RequestHandler } from "express";
import { AppError } from "./errorHandler.middleware";

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 2 },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) return cb(new AppError(400, "Choose a JPEG, PNG, or WebP image."));
    cb(null, true);
  },
}).single("image");

export const avatarUpload: RequestHandler = (req, res, next) => {
  parser(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) return next(new AppError(400, error.code === "LIMIT_FILE_SIZE" ? "Your image must be 5 MB or smaller." : "Upload one image using the image field."));
    next(error);
  });
};

export function validImageSignature(buffer: Buffer, mime: string) {
  if (mime === "image/jpeg") return buffer.length > 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (mime === "image/png") return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/webp") return buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  return false;
}
