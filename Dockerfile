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
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist
RUN rm -rf ./server/node_modules \
  && npm ci --omit=dev --prefix ./server \
  && npm cache clean --force
EXPOSE 3001
CMD ["node", "server/index.js"]
