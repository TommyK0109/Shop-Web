import { Router } from "express";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, emailTokenSchema } from "@storefront/shared";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../middleware/errorHandler.middleware";
import { register, login, refresh, logout, getMe, forgotPassword, resetPassword, verifyEmail, resendVerification } from "../controllers/auth.controller";
import { updateAvatar, removeAvatar } from "../controllers/profile.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { avatarUpload } from "../middleware/avatarUpload.middleware";
import { authLimit } from "../middleware/authLimits";

export const authRouter = Router();

const ipLimit = authLimit(30, (req) => req.ip || "unknown");
const emailLimit = authLimit(5, (req) => `${req.path}:${req.body.email}`);
const profileLimit = authLimit(10, (req) => `${req.path}:${req.user!.id}`);

authRouter.post("/register", ipLimit, validate(registerSchema), emailLimit, asyncHandler(register));
authRouter.post("/login", ipLimit, validate(loginSchema), asyncHandler(login));
authRouter.post("/refresh", asyncHandler(refresh));
authRouter.post("/logout", asyncHandler(logout));
authRouter.get("/me", requireAuth, asyncHandler(getMe));
authRouter.post("/forgot-password", ipLimit, validate(forgotPasswordSchema), emailLimit, asyncHandler(forgotPassword));
authRouter.post("/reset-password", ipLimit, validate(resetPasswordSchema), asyncHandler(resetPassword));
authRouter.post("/verify-email", ipLimit, validate(emailTokenSchema), asyncHandler(verifyEmail));
authRouter.post("/resend-verification", requireAuth, profileLimit, asyncHandler(resendVerification));
authRouter.post("/avatar", requireAuth, profileLimit, avatarUpload, asyncHandler(updateAvatar));
authRouter.delete("/avatar", requireAuth, profileLimit, asyncHandler(removeAvatar));
