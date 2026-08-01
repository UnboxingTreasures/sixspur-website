#!/bin/bash
set -e

cd ~/Documents/sixspur-website

FILES=(
  "src/app/farm-animals/page.tsx"
  "src/app/news/[slug]/page.tsx"
  "src/components/sections/Hero.tsx"
  "src/components/sections/FarmFamily.tsx"
  "src/components/layout/Nav.tsx"
  "src/components/layout/Footer.tsx"
)

for FILE in "${FILES[@]}"; do
  if [ -f "$FILE" ]; then
    echo "Fixing $FILE..."
    # macOS (BSD) sed requires an empty string argument after -i for in-place editing
    sed -i '' 's|href="/donate"|href="/ways-to-give"|g' "$FILE"
    sed -i '' "s|href='/donate'|href='/ways-to-give'|g" "$FILE"
  else
    echo "WARNING: $FILE not found, skipping."
  fi
done

echo ""
echo "Done. Verifying no /donate links remain:"
grep -rn "href=\"/donate\"\|href='/donate'" src --include="*.tsx" || echo "  None found — all fixed."
