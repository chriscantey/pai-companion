#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# PAI Companion - Directory Structure Setup
#
# Creates the standard directory layout for a PAI companion installation.
# Safe to run multiple times (creates only if missing).
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

echo "Setting up directory structure..."

# Create directories
mkdir -p ~/portal
mkdir -p ~/portal/clipboard
mkdir -p ~/exchange
mkdir -p ~/work
mkdir -p ~/data
mkdir -p ~/upstream

# Create README files explaining each directory
[ ! -f ~/portal/README.md ] && cat > ~/portal/README.md << 'EOF'
# Portal

Web-viewable content served by the portal server on port 8080.

Your AI assistant creates styled HTML pages here. Each subdirectory
becomes accessible at `http://<VM_IP>:8080/<directory-name>/`.

## Structure

Each page lives in its own subdirectory with an `index.html`:

```
portal/
  weather/index.html     → http://<VM_IP>:8080/weather/
  report/index.html      → http://<VM_IP>:8080/report/
  clipboard/index.html   → http://<VM_IP>:8080/clipboard/
  exchange/index.html    → http://<VM_IP>:8080/exchange/
```
EOF

[ ! -f ~/exchange/README.md ] && cat > ~/exchange/README.md << 'EOF'
# Exchange

File exchange directory. Drop files here (via the web UI or command line)
to share them with your AI assistant. Your assistant can also place files
here for you to download.

Access via browser: http://<VM_IP>:8080/exchange/
EOF

[ ! -f ~/work/README.md ] && cat > ~/work/README.md << 'EOF'
# Work

Active projects and work-in-progress. Your AI assistant creates project
directories here when building something for you.
EOF

[ ! -f ~/data/README.md ] && cat > ~/data/README.md << 'EOF'
# Data

Persistent data storage. Configuration, cron exports, and other
data that should survive across sessions.
EOF

echo "Directory structure created:"
echo "  ~/portal/     - Web content (HTTP :8080)"
echo "  ~/exchange/   - File exchange"
echo "  ~/work/       - Active projects"
echo "  ~/data/       - Persistent data"
echo "  ~/upstream/   - Reference repos"
