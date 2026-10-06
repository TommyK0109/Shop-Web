import { z } from "zod";

const email = z.string().trim().email().transform((value) => value.toLowerCase());
const password = z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be at most 72 characters")
  .refine((value) => new TextEncoder().encode(value).length <= 72, "Password must be at most 72 bytes");
const captchaToken = z.string().min(1).max(2048).optional();

// One schema, imported by both the client form and the server route —
// keeps validation rules in exactly one place.
export const registerSchema = z.object({
  email,
  password,
  captchaToken,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
  captchaToken,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email, captchaToken });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export const emailTokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, "This link is invalid. Please request a new one.") });
export const resetPasswordSchema = emailTokenSchema.extend({ password });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
