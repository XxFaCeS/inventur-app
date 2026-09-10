# inventur-app

Inventur- und Bestandsverwaltungs-Webanwendung für interne Nutzung.

## Tech-Stack

- **Backend:** Node.js + Express (`/server`)
- **Datenbank:** SQLite (`/server/data/inventur.db`)
- **Frontend:** React + Vite (`/client`)

## Voraussetzungen

- **Node.js:** mindestens `20.19.0` (empfohlen: aktuelle `22.x` LTS)

## Projektstruktur

- `/server` – REST-API unter `/api/...`, SQLite-Schema-Migration beim Start
- `/client` – React-Frontend mit React Router
- Root `package.json` – zentrale Start-/Build-Skripte

## Installation

### Variante A: alles über Root

```bash
npm install
```

> Über npm-Workspaces werden Dependencies für Root, `/server` und `/client` zusammen installiert.

### Variante B: manuell pro Unterordner

```bash
cd server && npm install
cd ../client && npm install
```

Optional (wenn Workspaces installiert wurden und du gezielt beide Workspaces erneut installieren willst):

```bash
npm run setup
```

## Entwicklung starten

Im Projekt-Root:

```bash
npm run dev
```

- Backend: `http://localhost:3001`
- Frontend (Vite): `http://localhost:5173`

Das Frontend nutzt im Dev-Modus einen Vite-Proxy für `/api` auf das Backend.

## Produktion bauen & starten

Im Projekt-Root:

```bash
npm start
```

Das Skript baut zuerst das Frontend (`client/dist`) und startet dann den Express-Server. In diesem Modus liefert Express die gebaute React-App direkt aus.

## Konfiguration

- `PORT` (optional): Port für den Express-Server (Default: `3001`)
- `DB_PATH` (optional): Pfad zur SQLite-Datei. Absolut oder relativ zu `/server` (Default: `data/inventur.db`)
- `CORS_ORIGINS` (optional): Komma-separierte Origins für CORS (Default: `http://localhost:5173`)
- `NODE_ENV` (optional): Für Produktion `production` setzen

Beispiel:

```bash
PORT=4000 DB_PATH=/var/data/inventur.db CORS_ORIGINS=https://inventur.example.com npm start
```

## API-Übersicht

- `GET /api/artikel`
- `GET /api/artikel/:id`
- `POST /api/artikel`
- `PUT /api/artikel/:id`
- `DELETE /api/artikel/:id`
- `POST /api/artikel/:id/bewegung`
- `GET /api/artikel/:id/bewegungen`
- `GET /api/warnliste`
- `GET /api/kategorien`
- `GET /api/lagerorte`
- `GET /api/export/csv`

## Hinweise

- Bei jedem Serverstart wird das Schema automatisch angelegt, falls noch nicht vorhanden.
- Die SQLite-Datei liegt standardmäßig unter `server/data/inventur.db`.

## Deployment

### 1) Lokal testen vor Deployment

Im Projekt-Root:

```bash
npm install
npm run dev
```

Für einen produktionsnahen Test:

```bash
npm start
```

---

### 2) Heroku Deployment

Datei `Procfile` ist bereits enthalten:

```txt
web: npm start
```

Schritte:

1. App auf Heroku erstellen (Node.js Buildpack automatisch oder manuell setzen).
2. Environment Variables setzen:
   - `NODE_ENV=production`
   - `CORS_ORIGINS=https://<deine-domain>`
   - `DB_PATH=/app/data/inventur.db` (mit persistentem Storage/Add-on empfohlen)
3. Deploy via GitHub Integration oder Heroku CLI.

> Hinweis: SQLite auf Heroku ist ohne persistentes Volume nicht dauerhaft. Für produktive Nutzung besser Render/Railway mit Volume oder externe DB.

---

### 3) Render.com Deployment

Datei `render.yaml` ist enthalten. Alternativ manuell:

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run start --workspace server`
- **Environment:**
  - `NODE_ENV=production`
  - `PORT=10000` (Render setzt meist selbst)
  - `CORS_ORIGINS=https://<deine-render-url-oder-custom-domain>`
  - `DB_PATH=/var/data/inventur.db` (wenn Disk gemountet)

In Render unbedingt eine **Persistent Disk** einrichten und auf `/var/data` mounten.

---

### 4) Railway.app Deployment

Datei `railway.json` ist enthalten.

Empfohlene Variablen:

- `NODE_ENV=production`
- `CORS_ORIGINS=https://<deine-railway-domain>`
- `DB_PATH=/data/inventur.db` (nur sinnvoll mit persistentem Volume)

Deploy:

1. Repo in Railway verbinden
2. Variablen setzen
3. Deployment starten

---

### 5) Vercel + separates Backend

Vercel eignet sich primär für das React-Frontend:

1. Frontend (`/client`) auf Vercel deployen.
2. Backend separat deployen (z. B. Render/Railway/VPS).
3. Datei `vercel.json` anpassen (Platzhalter-URL durch deine Backend-URL ersetzen), damit `/api/*` weitergeleitet wird.
4. `CORS_ORIGINS` am Backend auf Vercel-Domain setzen.

---

### 6) Selbst-gehostet (VPS mit Node.js + Nginx Reverse Proxy)

App bauen und starten:

```bash
npm install
npm run build
NODE_ENV=production PORT=3001 CORS_ORIGINS=https://inventur.example.com npm run start --workspace server
```

Beispiel Nginx:

```nginx
server {
    listen 80;
    server_name inventur.example.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Danach TLS mit Let's Encrypt aktivieren.

Optionales Apache-Beispiel:

```apache
<VirtualHost *:80>
    ServerName inventur.example.com

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3001/
    ProxyPassReverse / http://127.0.0.1:3001/
</VirtualHost>
```

## Docker (optional)

### Docker Build & Run

```bash
docker build -t inventur-app .
docker run -d --name inventur-app \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e PORT=3001 \
  -e CORS_ORIGINS=http://localhost:3001 \
  -e DB_PATH=/app/server/data/inventur.db \
  -v inventur-data:/app/server/data \
  inventur-app
```

### Docker Compose

```bash
docker compose up -d --build
```

## Sicherheitshinweise (Produktion)

- `CORS_ORIGINS` immer auf konkrete Domains begrenzen (kein `*`).
- Datenbankdatei (`inventur.db`) regelmäßig sichern (Backup + Restore-Test).
- Reverse Proxy (Nginx/Apache) mit HTTPS erzwingen.
- App/Node.js-Abhängigkeiten regelmäßig aktualisieren.

## Monitoring & Logging

- Logs zentral sammeln (z. B. `docker logs`, Railway Logs, Render Logs, journald).
- Healthcheck-Endpunkt definieren (z. B. `GET /api/artikel`) und im Hoster hinterlegen.
- Uptime-Monitoring (z. B. UptimeRobot, Better Stack) für öffentliche URL.
- Bei Fehlern Rate-Limits und CORS-Fehler in Logs prüfen.
