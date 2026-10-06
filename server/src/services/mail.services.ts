import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../env";
import { AppError } from "../middleware/errorHandler.middleware";

let transport: Transporter | undefined;
export function isMailConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_FROM && (!env.SMTP_USER || env.SMTP_PASSWORD));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export async function sendAccountEmail(to: string, purpose: "verify_email" | "reset_password", token: string) {
  if (!isMailConfigured()) throw new AppError(503, "Email delivery is not configured. Please contact support.");
  transport ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    requireTLS: env.NODE_ENV === "production" && !env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  const base = `${(env.CLIENT_URL || env.CLIENT_ORIGIN).replace(/\/$/, "")}/`;
  const url = new URL(purpose === "verify_email" ? "verify-email" : "reset-password", base);
  // The fragment avoids sending the token to web servers and referrer headers.
  url.hash = new URLSearchParams({ token }).toString();
  const title = purpose === "verify_email" ? "Welcome to Storefront — verify your email" : "Reset your Storefront password";
  const action = purpose === "verify_email" ? "Verify email address" : "Reset password";
  const duration = purpose === "verify_email" ? "24 hours" : "30 minutes";
  const description = purpose === "verify_email" ? "Thanks for joining our neighborhood. Confirm your email address to finish setting up your profile." : "We received a request to reset your password. Choose a new password using the link below.";
  const result = await transport.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: title,
    text: `${description}\n\n${action}: ${url.href}\n\nThis link expires in ${duration} and can only be used once. If you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#282c24"><h1 style="font-size:24px">${escapeHtml(title)}</h1><p style="line-height:1.7">${description}</p><p style="margin:28px 0"><a href="${escapeHtml(url.href)}" style="background:#283c2e;color:white;padding:14px 22px;border-radius:8px;text-decoration:none">${action}</a></p><p style="font-size:13px;line-height:1.7">This link expires in ${duration} and can only be used once. If you did not request this, you can ignore this email.</p></div>`,
  });
  if (!result.accepted?.length || result.rejected?.length) throw new Error("SMTP did not accept the recipient");
}
