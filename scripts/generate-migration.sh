#!/bin/bash
set -euo pipefail

echo "Generating migration..."
npm run -w backend db:generate

echo "Migration generated. Check backend/src/db/migrations/ for new files."
