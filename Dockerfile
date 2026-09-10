FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist
EXPOSE 3001
CMD ["node", "server/index.js"]
