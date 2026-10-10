#!/bin/sh
# Container start for hosts with no pre-deploy step (Render free tier): migrate, then serve.
# Pinned because the production image carries no Prisma CLI.
set -e
npx --yes prisma@6.19.3 migrate deploy --schema prisma/schema.prisma
exec node dist/main.js
