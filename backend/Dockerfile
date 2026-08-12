# Express API. Small and stateless, so a 512 MB free instance is plenty.
#
# Note that uploaded CV files are written to backend/uploads on the container
# filesystem, which is ephemeral. Losing them costs only the "download CV"
# route, which already returns a clean 404 when the file is gone; parsing,
# matching and ranking all read extracted_text from Postgres.

FROM node:20-alpine

WORKDIR /app

# Copy manifests first so the dependency layer is cached across code changes.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
