import { createServer, type Socket } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { env } from "../src/env";
import { sendAccountEmail } from "../src/services/mail.services";

vi.mock("../src/env", () => ({ env: {
  NODE_ENV: "test", SMTP_HOST: "127.0.0.1", SMTP_PORT: 0, SMTP_SECURE: false,
  SMTP_FROM: "Storefront <accounts@example.com>", CLIENT_URL: "http://localhost:5200/",
} }));

// In-process mail catcher: exercises Nodemailer's real SMTP transport without
// contacting a provider or sending any email outside this test process.
const messages: { from: string; to: string; raw: string }[] = [];
const sockets = new Set<Socket>();
const server = createServer((socket) => {
  sockets.add(socket); socket.on("close", () => sockets.delete(socket));
  socket.write("220 localhost test SMTP\r\n");
  let buffer = ""; let data = false; let raw = ""; let from = ""; let to = "";
  socket.on("data", (chunk) => {
    buffer += chunk.toString();
    while (buffer.includes("\r\n")) {
      const end = buffer.indexOf("\r\n"); const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
      if (data) {
        if (line === ".") { messages.push({ from, to, raw }); data = false; raw = ""; socket.write("250 Message accepted\r\n"); }
        else raw += `${line.replace(/^\.\./, ".")}\r\n`;
      } else if (/^EHLO|^HELO/.test(line)) socket.write("250-localhost\r\n250 SIZE 10485760\r\n");
      else if (line.startsWith("MAIL FROM:")) { from = line; socket.write("250 Sender accepted\r\n"); }
      else if (line.startsWith("RCPT TO:")) { to = line; socket.write("250 Recipient accepted\r\n"); }
      else if (line === "DATA") { data = true; socket.write("354 End with a dot\r\n"); }
      else if (line === "QUIT") socket.end("221 Goodbye\r\n");
      else socket.write("250 OK\r\n");
    }
  });
});

beforeAll(async () => {
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("SMTP test server did not bind");
  env.SMTP_PORT = address.port;
});
afterAll(async () => {
  for (const socket of sockets) socket.destroy();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("real SMTP transport to a local mail catcher", () => {
  it.each(["verify_email", "reset_password"] as const)("delivers %s with text and HTML parts", async (purpose) => {
    const token = "a".repeat(64);
    await sendAccountEmail("user@example.com", purpose, token);
    const message = messages.at(-1)!;
    expect(message.from).toContain("accounts@example.com"); expect(message.to).toContain("user@example.com");
    expect(message.raw).toContain("Content-Type: text/plain"); expect(message.raw).toContain("Content-Type: text/html");
    const decoded = message.raw.replace(/=\r\n/g, "").replace(/=([a-f0-9]{2})/gi, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    expect(decoded).toContain(`http://localhost:5200/${purpose === "verify_email" ? "verify-email" : "reset-password"}#token=${token}`);
  });
});
