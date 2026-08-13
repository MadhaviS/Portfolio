#!/usr/bin/env bash
# After `expo export -p web`, create directory indexes so Hostinger/LiteSpeed
# can serve clean URLs like /en/portfolio/pomodoro without relying only on rewrite.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"

if [[ ! -d "$DIST" ]]; then
  echo "dist/ not found — run expo export first" >&2
  exit 1
fi

# Ensure Apache/LiteSpeed rewrite rules are present in the upload folder
if [[ -f "$ROOT/public/.htaccess" ]]; then
  cp "$ROOT/public/.htaccess" "$DIST/.htaccess"
fi

shopt -s nullglob
for f in "$DIST"/*.html; do
  name="$(basename "$f" .html)"
  case "$name" in
    index|+not-found|_sitemap) continue ;;
  esac
  mkdir -p "$DIST/$name"
  cp "$f" "$DIST/$name/index.html"
  echo "route: /$name → $name/index.html"
done
