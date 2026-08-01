#!/bin/bash
# Searches common locations for PayPal credential files/references.
# Reports FILE PATHS ONLY — does not print actual key/secret values,
# so nothing sensitive gets pasted into chat.

echo "=== 1. .env files in the project ==="
find ~/Documents/sixspur-website -maxdepth 2 -iname ".env*" 2>/dev/null

echo ""
echo "=== 2. Any file in the project with 'paypal' in the name ==="
find ~/Documents/sixspur-website -iname "*paypal*" 2>/dev/null

echo ""
echo "=== 3. client-docs/ folder contents ==="
find ~/Documents/sixspur-website/client-docs -type f 2>/dev/null

echo ""
echo "=== 4. Files anywhere in the project mentioning PayPal (paths only, no content) ==="
grep -rl -i "paypal" ~/Documents/sixspur-website --include="*.env*" --include="*.txt" --include="*.md" --include="*.json" 2>/dev/null | grep -v node_modules

echo ""
echo "=== 5. Desktop/Documents/Downloads for standalone credential docs ==="
find ~/Desktop ~/Documents ~/Downloads -maxdepth 2 -iname "*paypal*" 2>/dev/null | grep -v sixspur-website

echo ""
echo "=== 6. macOS Keychain — any saved item with 'paypal' in its name ==="
security dump-keychain 2>/dev/null | grep -i "paypal" | grep '"svce"' 

echo ""
echo "=== Done ==="
echo "If any files showed up above, open them yourself to check contents —"
echo "paste ONLY the fact that you found something and roughly what it contains"
echo "(e.g. 'found a .env.local with PAYPAL_CLIENT_ID set'), never the actual"
echo "key/secret values themselves."
