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

Beispiel:

```bash
PORT=4000 npm run start --prefix server
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
