#!/usr/bin/env bash
# Promote the latest Ready deployment to the canonical production alias.
# Requires: Vercel CLI (`npm i -g vercel`) authenticated against the team.

set -euo pipefail

PROJECT="${VERCEL_PROJECT:-fetchcpu-simulator}"
ALIAS="${VERCEL_ALIAS:-fetchcpu-pocho.vercel.app}"

echo "==> Listing recent deployments for $PROJECT..."
mapfile -t DEPLOYS < <(vercel ls "$PROJECT" --no-color --limit 10 2>&1)

# Pick the most recent Ready production deployment.
URL=""
for line in "${DEPLOYS[@]}"; do
  if [[ "$line" =~ (https://[a-z0-9-]+-pochonskis-projects\.vercel\.app) ]] && [[ "$line" == *●*Ready* ]]; then
    URL="${BASH_REMATCH[1]}"
    break
  fi
done

if [[ -z "$URL" ]]; then
  echo "No Ready deployment found for $PROJECT" >&2
  exit 1
fi

echo "==> Promoted candidate: $URL"
echo "==> Alias $ALIAS -> $URL"
vercel alias set "$URL" "$ALIAS"

echo "==> Smoke test:"
curl -sSf -o /dev/null -w "  HTTP %{http_code} (%{size_download} bytes)\n" "https://$ALIAS/" || {
  echo "  Smoke test FAILED for $ALIAS" >&2
  exit 1
}

