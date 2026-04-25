#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/db push
pnpm --filter @workspace/scripts run seed-demo
