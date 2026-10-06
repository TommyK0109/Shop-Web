# Local-dev image running the Vite dev server (PLAN.md §10). The production
# client is built and served by Vercel, not from this image.
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/

RUN npm ci

COPY shared ./shared
COPY client ./client

EXPOSE 5200

# --host binds 0.0.0.0 so the port is reachable from outside the container.
CMD ["npm", "run", "dev", "--workspace", "client", "--", "--host", "0.0.0.0"]
