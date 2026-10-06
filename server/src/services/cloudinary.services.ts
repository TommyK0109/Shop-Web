import { v2 as cloudinary } from "cloudinary";
import { env } from "../env";
import { AppError } from "../middleware/errorHandler.middleware";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new AppError(500, "Image upload is not configured on this server");
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  configured = true;
}

// Uploads a single in-memory buffer (from multer) via Cloudinary's upload
// stream API, which is the only upload path that doesn't require writing
// the file to disk first.
export function uploadProductImage(buffer: Buffer): Promise<{ url: string }> {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "storefront/products", resource_type: "image" },
      (error, result) => {
        if (error || !result) {
          return reject(error ?? new Error("Cloudinary upload returned no result"));
        }
        resolve({ url: result.secure_url });
      },
    );
    stream.end(buffer);
  });
}

export function uploadProfileImage(buffer: Buffer): Promise<{ url: string; publicId: string }> {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "storefront/avatars", resource_type: "image", format: "webp",
        transformation: [{ width: 256, height: 256, crop: "fill", gravity: "auto" }, { flags: "strip_profile" }] },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Image upload failed"));
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

export async function deleteProfileImage(publicId: string | null) {
  if (!publicId) return;
  ensureConfigured();
  await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
}
