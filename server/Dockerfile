# Local-dev image (PLAN.md §10: `docker compose up` should be the whole setup).
# Source is bind-mounted by docker-compose and tsx watches it, so this image
# only needs the dependency tree plus a generated Prisma client. Deployment to
# Render builds from source instead — see render.yaml.
FROM node:24-alpine

# Prisma's schema/query engines are dynamically linked against OpenSSL, which
# the Alpine base image does not ship. Without these the engine fails to load
# and every prisma command dies with an unparseable-response error.
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Manifests first so the npm layer stays cached until dependencies change.
# The lockfile lives at the root because this is an npm-workspaces repo.
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/

RUN npm ci

# Generate the Prisma client at build time; it only depends on the schema.
COPY server/prisma ./server/prisma
RUN npx prisma generate --schema server/prisma/schema.prisma

COPY shared ./shared
COPY server ./server

EXPOSE 5201

CMD ["npm", "run", "dev", "--workspace", "server"]
