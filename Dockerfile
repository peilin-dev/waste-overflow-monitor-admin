FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && echo "=== dist contents ===" && ls -la /app/dist/ && (test -f /app/dist/index.html && echo "✓ index.html EXISTS" || (echo "✗ index.html MISSING" && exit 1))

FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist/ /usr/share/nginx/html/
COPY --from=builder /app/app /usr/share/nginx/html/app
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
