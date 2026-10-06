import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const candidates = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\0'))]
  .filter((file) => file && existsSync(path.join(root, file))).sort();
const blocked = /(^|\/)(node_modules|tmp|output|dist|build|coverage|\.git|\.codex|\.agents|\.aws)(\/|$)|(^|\/)\.env($|\.(?!example$))|\.(dump|bak|log)$/;
const credentialKeys = /^(SMTP_PASSWORD|JWT_ACCESS_SECRET|JWT_REFRESH_SECRET|CLOUDINARY_API_SECRET|GEMINI_API_KEY|TURNSTILE_SECRET_KEY)$/;
const unquote = (value) => value.trim().replace(/^(["'])(.*)\1$/, '$2');
const entries = (text) => text.split(/\r?\n/).map((line) => line.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/)).filter(Boolean).map((match) => [match[1], unquote(match[2])]);
const secrets = [];
for (const file of ['server/.env', 'client/.env', '.env']) {
  if (!existsSync(path.join(root, file))) continue;
  for (const [key, value] of entries(readFileSync(path.join(root, file), 'utf8'))) {
    if (credentialKeys.test(key) && value.length >= 8 && !/^(replace-|dev-only-|ci-|test-|[123]x0)/.test(value)) secrets.push({ key, value });
  }
}
const errors = [];
for (const file of candidates) {
  if (blocked.test(file)) errors.push(`${file}: private or generated file is eligible for publication`);
  if (/\.(png|jpe?g|webp|gif|ico|pdf)$/i.test(file)) continue;
  const content = readFileSync(path.join(root, file), 'utf8');
  for (const { key, value } of secrets) if (content.includes(value)) errors.push(`${file}: contains the private value for ${key}`);
  if (file.endsWith('.env.example')) {
    for (const [key, value] of entries(content)) {
      if (credentialKeys.test(key) && value && !/^replace-/.test(value)) errors.push(`${file}: ${key} must be blank or a replace- placeholder`);
    }
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
mkdirSync(path.join(root, 'tmp', 'github-preparation'), { recursive: true });
writeFileSync(path.join(root, 'tmp', 'github-preparation', 'public-files.json'), JSON.stringify(candidates, null, 2) + '\n');
console.log(`Public snapshot check passed: ${candidates.length} files. Manifest: tmp/github-preparation/public-files.json`);
