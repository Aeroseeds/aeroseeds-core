FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
# puppeteer (a devDependency, used only as a local-dev fallback in
# pdfReportService.ts) tries to download its own Chromium on install; the
# runtime image uses an apt-installed Chromium instead, so skip that here.
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim AS run
WORKDIR /app
ENV NODE_ENV=production

# chromium + fonts back the PDF report generator (pdfReportService.ts);
# openssl is required by the Prisma query engine on Debian slim images.
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium fonts-liberation openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY assets ./assets

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
