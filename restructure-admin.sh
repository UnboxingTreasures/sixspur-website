#!/bin/bash
set -e

cd ~/Documents/sixspur-website

echo "Creating (admin) route group..."
mkdir -p "src/app/(admin)/admin"

echo "Moving existing admin pages into the new group (preserving all content)..."
if [ -d "src/app/admin/inbox" ]; then
  mv src/app/admin/inbox "src/app/(admin)/admin/"
  echo "  moved admin/inbox"
fi
if [ -d "src/app/admin/news" ]; then
  mv src/app/admin/news "src/app/(admin)/admin/"
  echo "  moved admin/news"
fi

echo "Removing old empty admin folder..."
rmdir src/app/admin 2>/dev/null || echo "  (not empty or already removed, check manually if needed)"

echo "Done. New structure:"
find "src/app/(admin)" -name "page.tsx" -o -name "layout.tsx"

echo ""
echo "Remove the old design-reference file since this is now the real page:"
rm -f public/design-reference/admin-home.html
rmdir public/design-reference 2>/dev/null || true
echo "  removed public/design-reference/"
