#!/usr/bin/env bash
# Render / production release build (API-only Phoenix — no assets pipeline).
set -o errexit
set -o nounset
set -o pipefail

export MIX_ENV=prod

mix local.hex --force
mix local.rebar --force
mix deps.get --only prod
mix compile
mix release --overwrite
