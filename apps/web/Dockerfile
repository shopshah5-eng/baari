FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/ui/package*.json ./packages/ui/
COPY apps/web/package*.json ./apps/web/

RUN npm install --legacy-peer-deps

COPY packages/shared ./packages/shared
RUN npm --prefix packages/shared run build

COPY packages/ui ./packages/ui
COPY apps/web ./apps/web

RUN npm --prefix apps/web run build

EXPOSE 3001
CMD ["npm", "--prefix", "apps/web", "run", "start"]

