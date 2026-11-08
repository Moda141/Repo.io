#!/usr/bin/env bash
# Copies the compiled OpenUI5 theme, font, CLDR and message-bundle files the prototype needs
# into dist/. `ui5 build self-contained` bundles the JavaScript only; these files are taken
# from a running `ui5 serve` (which compiles the sap_fiori_3 LESS sources on request).
# Usage: npm start (or: npx ui5 serve --port 8095) in another shell, then
#        tools/collect-framework-files.sh [http://localhost:8095]
set -euo pipefail
BASE="${1:-http://localhost:8095}"
cd "$(dirname "$0")/.."
while read -r f; do
  [ -z "$f" ] && continue
  mkdir -p "dist/$(dirname "$f")"
  curl -fsS -o "dist/$f" "$BASE/$f"
done < publish/framework-files.txt
cp publish/repoio-console.html dist/
# The artifact host rejects a literal U+FFFD; the bundle has one inside a JS string.
python3 - <<'PY'
p = "dist/resources/sap-ui-custom.js"
s = open(p, encoding="utf-8").read()
open(p, "w", encoding="utf-8").write(s.replace('return"�"', 'return"\\uFFFD"'))
PY
echo "dist/ is ready to publish (page: dist/repoio-console.html)"
