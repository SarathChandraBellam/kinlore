#!/usr/bin/env bash
# Publish a GitHub release only when the asset directory has every installer.
set -euo pipefail

TAG=""
TITLE=""
NOTES=""
ASSETS=""
PRERELEASE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      TAG="$2"
      shift 2
      ;;
    --title)
      TITLE="$2"
      shift 2
      ;;
    --notes)
      NOTES="$2"
      shift 2
      ;;
    --assets)
      ASSETS="$2"
      shift 2
      ;;
    --prerelease)
      PRERELEASE=1
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$TAG" || -z "$TITLE" || -z "$NOTES" || -z "$ASSETS" ]]; then
  echo "Usage: publish-release.sh --tag --title --notes --assets [--prerelease]" >&2
  exit 1
fi

node scripts/release-assets.mjs "$ASSETS"

mapfile -d '' -t files < <(find "$ASSETS" -type f -print0 | sort -z)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "No release assets to publish" >&2
  exit 1
fi

if [[ "$PRERELEASE" -eq 1 ]]; then
  if gh release view "$TAG" >/dev/null 2>&1; then
    gh release upload "$TAG" "${files[@]}" --clobber
    gh release edit "$TAG" --prerelease --title "$TITLE" --notes-file "$NOTES"
  else
    gh release create "$TAG" "${files[@]}" --target "${GITHUB_SHA}" --prerelease --title "$TITLE" --notes-file "$NOTES"
  fi
else
  if gh release view "$TAG" >/dev/null 2>&1; then
    echo "Refusing to replace existing release ${TAG}" >&2
    exit 1
  fi
  gh release create "$TAG" "${files[@]}" --target "${GITHUB_SHA}" --title "$TITLE" --notes-file "$NOTES"
fi
