import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const workspace of ['server', 'client']) {
  const target = path.join(root, workspace, '.env');
  if (existsSync(target)) {
    console.log(`${workspace}/.env already exists; kept your settings.`);
    continue;
  }
  let content = readFileSync(path.join(root, workspace, '.env.example'), 'utf8');
  if (workspace === 'server') {
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
      content = content.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}="${randomBytes(48).toString('hex')}"`);
    }
  }
  writeFileSync(target, content, { flag: 'wx' });
  console.log(`Created ${workspace}/.env from the public example.`);
}
console.log('Environment ready. Follow README.md to start PostgreSQL, apply migrations and seed demo data.');
