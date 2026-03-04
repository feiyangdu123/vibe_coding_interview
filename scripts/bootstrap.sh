#!/usr/bin/env bash
set -euo pipefail

pnpm install
pnpm db:generate
