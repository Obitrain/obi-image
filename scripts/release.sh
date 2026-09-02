#!/bin/bash
# DESCRIPTION: bump the version, regenerate Nitro code, run checks, commit, tag and push.
#              The publish.yml workflow then creates the GitHub release and publishes to npm.
# USAGE: scripts/release.sh <x.y.z>
# EXAMPLES: scripts/release.sh 0.1.2
set -euo pipefail
V=${1:?usage: scripts/release.sh <x.y.z>}
[[ "$V" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "not a semver: $V"; exit 1; }
cd "$(dirname "$0")/.."
[ "$(git branch --show-current)" = main ] || { echo "release from main"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "working tree not clean"; exit 1; }
git fetch -q origin main && [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "main is not up to date with origin"; exit 1; }
yarn version "$V"
yarn nitrogen
yarn typecheck && yarn lint
git add -A && { git diff --cached --quiet || git commit -q -m "chore: release v$V"; }
git tag -a "v$V" -m "v$V"
git push origin main "v$V"
echo "pushed v$V — watch https://github.com/Obitrain/obi-image/actions"
