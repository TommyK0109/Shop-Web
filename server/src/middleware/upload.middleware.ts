import multer from "multer";

// Memory storage: files stay in RAM as a Buffer just long enough to be
// streamed to Cloudinary — nothing ever touches disk.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed"));
    }
    cb(null, true);
  },
});
