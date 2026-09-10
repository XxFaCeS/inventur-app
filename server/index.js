const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const { rateLimit } = require('express-rate-limit');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 3001;
const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin nicht erlaubt.'));
    },
  }),
);
app.use(express.json());
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Zu viele Anfragen. Bitte in einer Minute erneut versuchen.' },
  }),
);

const defaultDbPath = path.join(__dirname, 'data', 'inventur.db');
const dbPathEnv = process.env.DB_PATH?.trim();
const serverRoot = path.resolve(__dirname);
const dbPath = dbPathEnv
  ? path.isAbsolute(dbPathEnv)
    ? dbPathEnv
    : path.join(serverRoot, dbPathEnv)
  : defaultDbPath;

const dbDirectory = path.dirname(dbPath);
if (!fs.existsSync(dbDirectory)) {
  fs.mkdirSync(dbDirectory, { recursive: true });
}
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS artikel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    kategorie TEXT DEFAULT '',
    lagerort TEXT DEFAULT '',
    menge REAL NOT NULL DEFAULT 0,
    einheit TEXT DEFAULT '',
    mindestbestand REAL NOT NULL DEFAULT 0,
    notiz TEXT,
    aktualisiert_am TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bestandsbewegungen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artikel_id INTEGER NOT NULL,
    typ TEXT NOT NULL CHECK (typ IN ('zugang', 'abgang', 'inventur')),
    menge REAL NOT NULL,
    kommentar TEXT,
    erstellt_am TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artikel_id) REFERENCES artikel(id) ON DELETE CASCADE
  );
`);

const now = () => new Date().toISOString();

const parseNumber = (value, fieldName) => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`${fieldName} muss eine gültige Zahl sein.`);
  }
  return num;
};

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const notFound = (res, entity = 'Ressource') =>
  res.status(404).json({ error: `${entity} nicht gefunden.` });

app.get('/api/artikel', (req, res) => {
  try {
    const { suche = '', kategorie = '', lagerort = '' } = req.query;
    const rows = db
      .prepare(
        `
        SELECT * FROM artikel
        WHERE name LIKE @suche
          AND (@kategorie = '' OR kategorie = @kategorie)
          AND (@lagerort = '' OR lagerort = @lagerort)
        ORDER BY name COLLATE NOCASE ASC
      `,
      )
      .all({
        suche: `%${String(suche).trim()}%`,
        kategorie: String(kategorie).trim(),
        lagerort: String(lagerort).trim(),
      });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Artikel.' });
  }
});

app.get('/api/artikel/:id', (req, res) => {
  try {
    const artikelId = Number(req.params.id);
    if (!Number.isInteger(artikelId)) {
      return res.status(400).json({ error: 'Ungültige Artikel-ID.' });
    }

    const artikel = db.prepare('SELECT * FROM artikel WHERE id = ?').get(artikelId);
    if (!artikel) return notFound(res, 'Artikel');

    const bewegungen = db
      .prepare(
        'SELECT * FROM bestandsbewegungen WHERE artikel_id = ? ORDER BY datetime(erstellt_am) DESC, id DESC',
      )
      .all(artikelId);

    res.json({ ...artikel, bewegungen });
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden des Artikels.' });
  }
});

app.post('/api/artikel', (req, res) => {
  try {
    const name = normalizeText(req.body.name);
    if (!name) {
      return res.status(400).json({ error: 'Name ist ein Pflichtfeld.' });
    }

    const kategorie = normalizeText(req.body.kategorie);
    const lagerort = normalizeText(req.body.lagerort);
    const einheit = normalizeText(req.body.einheit);
    const notiz = normalizeText(req.body.notiz);
    const menge = parseNumber(req.body.menge ?? 0, 'Menge');
    const mindestbestand = parseNumber(req.body.mindestbestand ?? 0, 'Mindestbestand');

    if (menge < 0 || mindestbestand < 0) {
      return res.status(400).json({ error: 'Menge und Mindestbestand dürfen nicht negativ sein.' });
    }

    const createdAt = now();
    const insert = db.prepare(
      `
      INSERT INTO artikel (name, kategorie, lagerort, menge, einheit, mindestbestand, notiz, aktualisiert_am)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    );
    const result = insert.run(name, kategorie, lagerort, menge, einheit, mindestbestand, notiz || null, createdAt);

    const artikel = db.prepare('SELECT * FROM artikel WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(artikel);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Ungültige Eingabedaten.' });
  }
});

app.put('/api/artikel/:id', (req, res) => {
  try {
    const artikelId = Number(req.params.id);
    if (!Number.isInteger(artikelId)) {
      return res.status(400).json({ error: 'Ungültige Artikel-ID.' });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'menge')) {
      return res
        .status(400)
        .json({ error: 'Menge darf nicht direkt geändert werden. Bitte eine Bestandsbewegung erfassen.' });
    }

    const artikel = db.prepare('SELECT * FROM artikel WHERE id = ?').get(artikelId);
    if (!artikel) return notFound(res, 'Artikel');

    const name = normalizeText(req.body.name);
    if (!name) {
      return res.status(400).json({ error: 'Name ist ein Pflichtfeld.' });
    }

    const kategorie = normalizeText(req.body.kategorie);
    const lagerort = normalizeText(req.body.lagerort);
    const einheit = normalizeText(req.body.einheit);
    const notiz = normalizeText(req.body.notiz);
    const mindestbestand = parseNumber(req.body.mindestbestand ?? 0, 'Mindestbestand');

    if (mindestbestand < 0) {
      return res.status(400).json({ error: 'Mindestbestand darf nicht negativ sein.' });
    }

    db.prepare(
      `
      UPDATE artikel
      SET name = ?, kategorie = ?, lagerort = ?, einheit = ?, mindestbestand = ?, notiz = ?, aktualisiert_am = ?
      WHERE id = ?
    `,
    ).run(name, kategorie, lagerort, einheit, mindestbestand, notiz || null, now(), artikelId);

    const updated = db.prepare('SELECT * FROM artikel WHERE id = ?').get(artikelId);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Ungültige Eingabedaten.' });
  }
});

app.delete('/api/artikel/:id', (req, res) => {
  try {
    const artikelId = Number(req.params.id);
    if (!Number.isInteger(artikelId)) {
      return res.status(400).json({ error: 'Ungültige Artikel-ID.' });
    }

    const result = db.prepare('DELETE FROM artikel WHERE id = ?').run(artikelId);
    if (result.changes === 0) return notFound(res, 'Artikel');

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Löschen des Artikels.' });
  }
});

app.post('/api/artikel/:id/bewegung', (req, res) => {
  try {
    const artikelId = Number(req.params.id);
    if (!Number.isInteger(artikelId)) {
      return res.status(400).json({ error: 'Ungültige Artikel-ID.' });
    }

    const { typ, kommentar } = req.body;
    if (!['zugang', 'abgang', 'inventur'].includes(typ)) {
      return res.status(400).json({ error: 'Typ muss zugang, abgang oder inventur sein.' });
    }

    const bewegungsMenge = parseNumber(req.body.menge, 'Menge');
    if (bewegungsMenge < 0) {
      return res.status(400).json({ error: 'Menge darf nicht negativ sein.' });
    }
    if ((typ === 'zugang' || typ === 'abgang') && bewegungsMenge === 0) {
      return res.status(400).json({ error: 'Für Zugang/Abgang muss die Menge größer als 0 sein.' });
    }

    const artikel = db.prepare('SELECT * FROM artikel WHERE id = ?').get(artikelId);
    if (!artikel) return notFound(res, 'Artikel');

    let neuerBestand = artikel.menge;
    if (typ === 'zugang') {
      neuerBestand += bewegungsMenge;
    } else if (typ === 'abgang') {
      neuerBestand -= bewegungsMenge;
      if (neuerBestand < 0) {
        return res.status(400).json({ error: 'Abgang würde den Bestand unter 0 senken.' });
      }
    } else {
      neuerBestand = bewegungsMenge;
    }

    const createMovement = db.transaction(() => {
      db.prepare(
        'INSERT INTO bestandsbewegungen (artikel_id, typ, menge, kommentar, erstellt_am) VALUES (?, ?, ?, ?, ?)',
      ).run(artikelId, typ, bewegungsMenge, normalizeText(kommentar) || null, now());

      db.prepare('UPDATE artikel SET menge = ?, aktualisiert_am = ? WHERE id = ?').run(neuerBestand, now(), artikelId);
    });

    createMovement();

    const updated = db.prepare('SELECT * FROM artikel WHERE id = ?').get(artikelId);
    res.status(201).json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Fehler beim Verarbeiten der Bewegung.' });
  }
});

app.get('/api/artikel/:id/bewegungen', (req, res) => {
  try {
    const artikelId = Number(req.params.id);
    if (!Number.isInteger(artikelId)) {
      return res.status(400).json({ error: 'Ungültige Artikel-ID.' });
    }

    const artikel = db.prepare('SELECT id FROM artikel WHERE id = ?').get(artikelId);
    if (!artikel) return notFound(res, 'Artikel');

    const bewegungen = db
      .prepare('SELECT * FROM bestandsbewegungen WHERE artikel_id = ? ORDER BY datetime(erstellt_am) DESC, id DESC')
      .all(artikelId);

    res.json(bewegungen);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Bewegungen.' });
  }
});

app.get('/api/warnliste', (req, res) => {
  try {
    const rows = db
      .prepare(
        `
        SELECT *, (mindestbestand - menge) AS fehlt
        FROM artikel
        WHERE menge < mindestbestand
        ORDER BY fehlt DESC, name COLLATE NOCASE ASC
      `,
      )
      .all();

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Warnliste.' });
  }
});

app.get('/api/kategorien', (req, res) => {
  try {
    const rows = db
      .prepare('SELECT DISTINCT kategorie FROM artikel WHERE TRIM(COALESCE(kategorie, \"\")) <> \"\" ORDER BY kategorie')
      .all();

    res.json(rows.map((row) => row.kategorie));
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Kategorien.' });
  }
});

app.get('/api/lagerorte', (req, res) => {
  try {
    const rows = db
      .prepare('SELECT DISTINCT lagerort FROM artikel WHERE TRIM(COALESCE(lagerort, \"\")) <> \"\" ORDER BY lagerort')
      .all();

    res.json(rows.map((row) => row.lagerort));
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Lagerorte.' });
  }
});

const escapeCsv = (value) => {
  const stringValue = String(value ?? '');
  if (/[";,\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

app.get('/api/export/csv', (req, res) => {
  try {
    const { suche = '', kategorie = '', lagerort = '' } = req.query;
    const artikel = db
      .prepare(
        `
        SELECT * FROM artikel
        WHERE name LIKE @suche
          AND (@kategorie = '' OR kategorie = @kategorie)
          AND (@lagerort = '' OR lagerort = @lagerort)
        ORDER BY name COLLATE NOCASE ASC
      `,
      )
      .all({
        suche: `%${String(suche).trim()}%`,
        kategorie: String(kategorie).trim(),
        lagerort: String(lagerort).trim(),
      });
    const header = ['name', 'kategorie', 'lagerort', 'menge', 'einheit', 'mindestbestand', 'status'];

    const rows = artikel.map((item) => [
      item.name,
      item.kategorie,
      item.lagerort,
      item.menge,
      item.einheit,
      item.mindestbestand,
      item.menge < item.mindestbestand ? 'Nachbestellen' : 'OK',
    ]);

    const csvContent = [header, ...rows].map((row) => row.map(escapeCsv).join(';')).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bestand.csv"');
    res.status(200).send(`\uFEFF${csvContent}`);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Export.' });
  }
});

const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API-Endpunkt nicht gefunden.' });
});

app.use((error, _req, res, _next) => {
  if (error?.message === 'Origin nicht erlaubt.') {
    return res.status(403).json({ error: 'CORS: Origin nicht erlaubt.' });
  }
  return res.status(500).json({ error: 'Unerwarteter Serverfehler.' });
});

app.listen(PORT, () => {
  console.log(`Inventur-Server läuft auf Port ${PORT}`);
  console.log(`SQLite-Datenbank: ${dbPath}`);
});
