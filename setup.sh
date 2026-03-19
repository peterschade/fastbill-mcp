#!/bin/bash
# ============================================================
#  Fastbill MCP — Installations-Skript
#  Dieses Skript richtet den Fastbill MCP Server für die
#  Claude Desktop App ein. Einfach ausführen und den
#  Anweisungen folgen.
# ============================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║     Fastbill MCP — Installation          ║${NC}"
echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

# -----------------------------------------------------------
# 1. Check Node.js
# -----------------------------------------------------------
echo -e "${BOLD}[1/5] Prüfe ob Node.js installiert ist...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js ist nicht installiert.${NC}"
    echo ""
    echo "  Bitte installiere Node.js:"
    echo "  → https://nodejs.org (LTS-Version herunterladen)"
    echo ""
    echo "  Nach der Installation dieses Skript erneut starten."
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js ${NODE_VERSION} gefunden${NC}"
echo ""

# -----------------------------------------------------------
# 2. Install dependencies
# -----------------------------------------------------------
echo -e "${BOLD}[2/5] Installiere Abhängigkeiten...${NC}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

npm install --silent 2>&1 | tail -1
echo -e "${GREEN}✓ Abhängigkeiten installiert${NC}"
echo ""

# -----------------------------------------------------------
# 3. Build
# -----------------------------------------------------------
echo -e "${BOLD}[3/5] Baue den MCP Server...${NC}"

npm run build --silent 2>&1
echo -e "${GREEN}✓ MCP Server gebaut${NC}"
echo ""

# -----------------------------------------------------------
# 4. Fastbill Credentials
# -----------------------------------------------------------
echo -e "${BOLD}[4/5] Fastbill-Zugangsdaten${NC}"
echo ""
echo "  Du findest deinen API-Key in Fastbill unter:"
echo "  Einstellungen → API"
echo ""

read -p "  Fastbill E-Mail-Adresse: " FB_EMAIL
echo ""
read -p "  Fastbill API-Key: " FB_API_KEY
echo ""

if [ -z "$FB_EMAIL" ] || [ -z "$FB_API_KEY" ]; then
    echo -e "${RED}✗ E-Mail und API-Key sind erforderlich.${NC}"
    exit 1
fi

# -----------------------------------------------------------
# 5. Claude Desktop Config
# -----------------------------------------------------------
echo -e "${BOLD}[5/5] Konfiguriere Claude Desktop...${NC}"

CONFIG_DIR="$HOME/Library/Application Support/Claude"
CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"

MCP_ENTRY=$(cat <<JSONEOF
{
  "command": "node",
  "args": ["${SCRIPT_DIR}/dist/index.js"],
  "env": {
    "FASTBILL_EMAIL": "${FB_EMAIL}",
    "FASTBILL_API_KEY": "${FB_API_KEY}"
  }
}
JSONEOF
)

# Check if config dir exists
if [ ! -d "$CONFIG_DIR" ]; then
    echo -e "${YELLOW}⚠ Claude Desktop Config-Ordner nicht gefunden.${NC}"
    echo "  Stelle sicher, dass Claude Desktop installiert ist."
    echo ""
    echo "  Falls du die Konfiguration manuell hinzufügen möchtest,"
    echo "  erstelle die Datei: ${CONFIG_FILE}"
    echo "  mit folgendem Inhalt:"
    echo ""
    echo '  {'
    echo '    "mcpServers": {'
    echo '      "fastbill": '"${MCP_ENTRY}"
    echo '    }'
    echo '  }'
    exit 1
fi

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    # Create new config
    cat > "$CONFIG_FILE" <<JSONEOF
{
  "mcpServers": {
    "fastbill": ${MCP_ENTRY}
  }
}
JSONEOF
    echo -e "${GREEN}✓ Neue Claude Desktop Konfiguration erstellt${NC}"
else
    # Check if fastbill is already configured
    if grep -q '"fastbill"' "$CONFIG_FILE" 2>/dev/null; then
        echo -e "${YELLOW}⚠ Fastbill ist bereits in der Konfiguration vorhanden.${NC}"
        read -p "  Überschreiben? (j/n): " OVERWRITE
        if [ "$OVERWRITE" != "j" ] && [ "$OVERWRITE" != "J" ]; then
            echo "  Übersprungen."
            echo ""
            echo -e "${GREEN}${BOLD}✓ Installation abgeschlossen!${NC}"
            echo "  Starte Claude Desktop neu, um Fastbill zu verwenden."
            exit 0
        fi
    fi

    # Use node to safely merge JSON config
    node -e "
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync('${CONFIG_FILE}', 'utf8'));
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers.fastbill = ${MCP_ENTRY};
    fs.writeFileSync('${CONFIG_FILE}', JSON.stringify(config, null, 2));
    console.log('Config updated.');
    "
    echo -e "${GREEN}✓ Fastbill zur Claude Desktop Konfiguration hinzugefügt${NC}"
fi

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║     ✓ Installation abgeschlossen!        ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  Nächster Schritt:"
echo -e "  ${BOLD}→ Claude Desktop neu starten${NC}"
echo ""
echo "  Danach stehen dir 48 Fastbill-Tools zur Verfügung:"
echo "  Kunden, Rechnungen, Angebote, Artikel, Projekte,"
echo "  Zeiterfassung, Ausgaben, Einnahmen, Webhooks u.v.m."
echo ""
