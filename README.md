# Fastbill MCP für Claude Desktop

Verbindet die Claude Desktop App mit deinem Fastbill-Konto. Damit kann Claude direkt Rechnungen erstellen, Kunden verwalten, Angebote schreiben und vieles mehr.

---

## Voraussetzungen

- **Claude Desktop App** — [Download](https://claude.ai/download)
- **Node.js** (Version 18 oder höher) — [Download](https://nodejs.org) (LTS-Version)

### Node.js installieren (falls noch nicht vorhanden)

1. Gehe auf [nodejs.org](https://nodejs.org)
2. Lade die **LTS-Version** herunter
3. Installiere mit Doppelklick auf die heruntergeladene Datei
4. Folge dem Installations-Assistenten (alles auf Standard lassen)

### Fastbill API-Key finden

1. Logge dich bei [Fastbill](https://my.fastbill.com) ein
2. Gehe zu **Einstellungen** → **API**
3. Dort findest du deinen **API-Key** — kopiere ihn

---

## Installation

### Windows (empfohlen)

1. Öffne den Ordner `fastbill` im **Datei-Explorer**
2. **Doppelklick** auf **`setup.bat`**
3. Gib deine **Fastbill E-Mail** und deinen **API-Key** ein
4. **Claude Desktop neu starten** (im System-Tray unten rechts: Rechtsklick auf Claude → Beenden, dann wieder öffnen)

Fertig!

> **Falls Windows eine Sicherheitswarnung zeigt:**
> "Der Computer wurde durch Windows geschützt" → Klicke auf **"Weitere Informationen"** → **"Trotzdem ausführen"**

---

### Mac (empfohlen)

1. Öffne das **Terminal** (Spotlight: Cmd+Leertaste → "Terminal" eingeben → Enter)
2. Ziehe die Datei **`setup.sh`** per **Drag & Drop** aus dem Finder ins Terminal-Fenster — der Pfad wird automatisch eingefügt
3. Drücke **Enter**
4. Gib deine **Fastbill E-Mail** und deinen **API-Key** ein
5. **Claude Desktop neu starten** (Cmd+Q und wieder öffnen)

Fertig!

> **Falls "Permission denied" kommt:** Tippe im Terminal `bash ` (mit Leerzeichen), dann ziehe `setup.sh` per Drag & Drop rein und drücke Enter.

---

### Manuell (alle Betriebssysteme)

Falls das automatische Setup nicht klappt:

1. Öffne ein **Terminal** (Mac) bzw. die **Eingabeaufforderung** (Windows: Windows-Taste → "cmd" → Enter)

2. Navigiere zum `fastbill`-Ordner:
   ```
   cd /pfad/zum/fastbill-ordner
   ```

3. Installiere und baue:
   ```
   npm install
   npm run build
   ```

4. Öffne die Claude Desktop Konfigurationsdatei in einem Texteditor:
   - **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

   > **Tipp:** Kopiere den Pfad in die Adressleiste des Datei-Explorers / Finders, um die Datei zu finden.

5. Füge innerhalb der geschweiften Klammern von `"mcpServers"` folgendes hinzu (oder erstelle die Datei neu, falls sie nicht existiert):

   ```json
   {
     "mcpServers": {
       "fastbill": {
         "command": "node",
         "args": ["PFAD_ZUM_FASTBILL_ORDNER/dist/index.js"],
         "env": {
           "FASTBILL_EMAIL": "deine@email.de",
           "FASTBILL_API_KEY": "dein-api-key-hier"
         }
       }
     }
   }
   ```

6. Ersetze die drei Platzhalter:
   - `PFAD_ZUM_FASTBILL_ORDNER` → Der vollständige Pfad zum `fastbill`-Ordner (mit `/` statt `\`)
   - `deine@email.de` → Deine Fastbill Login-E-Mail
   - `dein-api-key-hier` → Dein Fastbill API-Key

7. Speichern und **Claude Desktop komplett neu starten**

---

## Was kann der Fastbill MCP?

Nach der Installation kann Claude direkt mit deinem Fastbill-Konto arbeiten:

| Bereich | Was Claude damit tun kann |
|---------|--------------------------|
| **Kunden** | Anlegen, suchen, bearbeiten, löschen |
| **Rechnungen** | Erstellen mit allen Positionen, versenden per E-Mail/Post, als bezahlt markieren, stornieren |
| **Angebote** | Erstellen, per E-Mail versenden, direkt in Rechnung umwandeln |
| **Artikel** | Produkte/Dienstleistungen als Stammdaten pflegen |
| **Wiederkehrende Rechnungen** | Automatische Rechnungen einrichten (wöchentlich bis 2-jährlich) |
| **Ausgaben** | Kosten erfassen und kategorisieren |
| **Einnahmen** | Externe Einnahmen tracken |
| **Projekte** | Projekte mit Kunden verknüpfen |
| **Zeiterfassung** | Arbeitszeiten auf Projekte buchen |
| **Dokumente** | Dokumente verwalten |
| **Vorlagen** | Rechnungsvorlagen abrufen |
| **Webhooks** | Automatische Benachrichtigungen einrichten |

### Beispiel-Prompts für Claude

- *"Erstelle eine Rechnung für Kunde 12345 über eine Beratung (2 Stunden à 150€)"*
- *"Zeig mir alle unbezahlten Rechnungen"*
- *"Lege einen neuen Kunden an: Firma Müller GmbH, München"*
- *"Erstelle ein Angebot für Website-Redesign und schick es per E-Mail"*
- *"Welche Rechnungen sind diesen Monat fällig?"*

---

## Fehlerbehebung

**Claude zeigt keine Fastbill-Tools an:**
- Claude Desktop komplett beenden und neu öffnen
  - Mac: Cmd+Q
  - Windows: Im System-Tray (unten rechts) Rechtsklick auf Claude → Beenden
- Prüfe ob die Konfigurationsdatei korrekt ist (kein Komma-Fehler im JSON)

**"FASTBILL_EMAIL and FASTBILL_API_KEY required":**
- Prüfe ob E-Mail und API-Key in der Konfiguration korrekt eingetragen sind

**"Fastbill API error: 401":**
- Dein API-Key ist ungültig oder abgelaufen → neuen Key in Fastbill generieren

**Setup-Skript startet nicht (Windows):**
- Rechtsklick auf `setup.bat` → "Als Administrator ausführen"

**"Permission denied" (Mac):**
- Im Terminal eingeben: `bash ` (mit Leerzeichen), dann `setup.sh` per Drag & Drop ins Terminal ziehen

**Generell:**
- Stelle sicher, dass Node.js installiert ist: `node -v` im Terminal / in der Eingabeaufforderung
- Stelle sicher, dass gebaut wurde: `npm run build` im fastbill-Ordner
