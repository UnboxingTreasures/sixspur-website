#!/bin/bash
set -e

TEAM_DIR=~/Documents/sixspur-website/public/images/team

echo "Removing departed staff photos..."
rm -fv "$TEAM_DIR/krista-young.jpg"
rm -fv "$TEAM_DIR/travis-young.jpg"

echo "Remaining team photos:"
ls "$TEAM_DIR"
