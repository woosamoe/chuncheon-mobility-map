#!/usr/bin/env bash
set -euo pipefail
mkdir -p site/public/vendor/images
for asset in leaflet.js leaflet.css; do
  curl --fail --silent --show-error --location --retry 3 --connect-timeout 12 --max-time 60 \
    "https://unpkg.com/leaflet@1.9.4/dist/$asset" -o "site/public/vendor/$asset" || \
  curl --fail --silent --show-error --location --retry 3 --connect-timeout 12 --max-time 60 \
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/$asset" -o "site/public/vendor/$asset"
  test -s "site/public/vendor/$asset"
done
for asset in layers.png layers-2x.png marker-icon.png marker-icon-2x.png marker-shadow.png; do
  curl --fail --silent --show-error --location --retry 1 --max-time 20 \
    "https://unpkg.com/leaflet@1.9.4/dist/images/$asset" -o "site/public/vendor/images/$asset" || true
done
cp patches/performance.js site/public/performance.js
python3 - <<'PY'
from pathlib import Path
import re
index=Path('site/public/index.html')
s=index.read_text(encoding='utf-8')
s,n1=re.subn(r'<link rel="stylesheet" href="https://unpkg.com/leaflet@1\.9\.4/dist/leaflet\.css"[^>]*>',
             '<link rel="stylesheet" href="./vendor/leaflet.css">',s)
s,n2=re.subn(r'<script src="https://unpkg.com/leaflet@1\.9\.4/dist/leaflet\.js"[^>]*></script>',
             '<script src="./vendor/leaflet.js"></script>',s)
if n1!=1 or n2!=1: raise RuntimeError('Leaflet replacement failed: '+str((n1,n2)))
s=s.replace('<link rel="preconnect" href="https://unpkg.com">','<link rel="preload" href="./vendor/leaflet.js" as="script">')
if '<script src="./app.js"></script>' not in s:raise RuntimeError('Unable to insert performance script')
s=s.replace('<script src="./app.js"></script>', '<script src="./app.js"></script>\n<script src="./performance.js"></script>')
index.write_text(s,encoding='utf-8')
print('Map performance and vendor bundle applied')
PY