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
# The artifact host rejects literal U+FFFD and control bytes. In these bundles they only occur inside
# JS string literals (the minifier turns source escapes back into raw characters), so re-escape them;
# node --check below confirms the files still parse.
python3 - <<'PY'
for p in ("dist/resources/sap-ui-custom.js", "dist/thirdparty/swagger-ui-bundle.js"):
    s = open(p, encoding="utf-8").read()
    s = s.replace(chr(0xFFFD), "\\uFFFD").replace(chr(0x1B), "\\u001b")
    open(p, "w", encoding="utf-8").write(s)
PY
node --check dist/resources/sap-ui-custom.js && node --check dist/thirdparty/swagger-ui-bundle.js
echo "dist/ is ready to publish (page: dist/repoio-console.html)"
