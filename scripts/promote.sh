#!/usr/bin/env bash
# Re-aliases the latest Ready deployment to the canonical production domain.
# Safe to run repeatedly: `vercel alias set` is idempotent.
#
# Requires: Vercel CLI (`npm i -g vercel`) authenticated against the team.
# Optional env: VERCEL_PROJECT, VERCEL_ALIAS (defaults shown below).

set -euo pipefail

PROJECT="${VERCEL_PROJECT:-fetchcpu-simulator}"
ALIAS="${VERCEL_ALIAS:-fetchcpu-pocho.vercel.app}"

echo "==> Listing recent Ready deployments for $PROJECT…"
# `vercel alias set` is idempotent: it replaces any existing alias. We do
# NOT call `vercel alias rm` first because that would leave the canonical
# domain unaliased (HTTP 404) for the duration of the swap.
URL="$(vercel ls "$PROJECT" --no-color --limit 10 \
  | grep 'Ready' \
  | grep -oE 'https://[a-z0-9-]+-pochonskis-projects\.vercel\.app' \
  | head -1)"

if [[ -z "$URL" ]]; then
  echo "No Ready deployment found for $PROJECT." >&2
  exit 1
fi

echo "==> Re-aliasing $ALIAS → $URL"
vercel alias set "$URL" "$ALIAS"

# Smoke-test: the canonical domain must respond and serve the new logo.
if ! curl -sSf -o /dev/null -w "  HTTP %{http_code} (%{size_download} bytes)\n" "https://$ALIAS/"; then
  echo "Smoke test FAILED for $ALIAS" >&2
  exit 1
fi

if ! curl -sSf -o /dev/null "https://$ALIAS/assets/logo.png"; then
  echo "Regression guard FAILED: assets/logo.png is 404 on $ALIAS" >&2
  echo "The canonical alias may be pointing at a stale deployment." >&2
  exit 1
fi

echo "==> Done. https://$ALIAS/ now points at $URL"
