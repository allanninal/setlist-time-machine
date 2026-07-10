# ---- Build stage: install everything and build the frontend ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime stage: production deps + server + built assets only ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY --from=build /app/dist ./dist

# Cloud Run injects PORT (defaults to 8080); the server reads process.env.PORT.
EXPOSE 8080
CMD ["node", "server/index.js"]
