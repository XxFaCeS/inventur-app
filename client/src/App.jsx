import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useNavigate, useParams, Routes, Route, useSearchParams } from 'react-router-dom';

const emptyForm = {
  name: '',
  kategorie: '',
  lagerort: '',
  menge: '0',
  einheit: '',
  mindestbestand: '0',
  notiz: '',
};

const apiRequest = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof data === 'object' && data?.error ? data.error : 'Unbekannter Fehler';
    throw new Error(message);
  }

  return data;
};

const statusBadge = (item) => (
  <span className={`badge ${item.menge < item.mindestbestand ? 'badge--warn' : 'badge--ok'}`}>
    {item.menge < item.mindestbestand ? 'Nachbestellen' : 'OK'}
  </span>
);

const formatDate = (value) => {
  if (!value) return '-';
  const normalized =
    typeof value === 'string' && value.includes(' ') && !value.includes('T')
      ? `${value.replace(' ', 'T')}Z`
      : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('de-DE');
};

const Layout = ({ children }) => (
  <div className="app-shell">
    <header className="topbar">
      <h1>Inventur-App</h1>
      <nav>
        <NavLink to="/">Bestandsübersicht</NavLink>
        <NavLink to="/warnliste">Warnliste</NavLink>
        <NavLink to="/artikel/neu">Neuer Artikel</NavLink>
      </nav>
    </header>
    <main>{children}</main>
  </div>
);

const OverviewPage = () => {
  const [artikel, setArtikel] = useState([]);
  const [kategorien, setKategorien] = useState([]);
  const [lagerorte, setLagerorte] = useState([]);
  const [filters, setFilters] = useState({ suche: '', kategorie: '', lagerort: '' });
  const [error, setError] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.suche) params.set('suche', filters.suche);
    if (filters.kategorie) params.set('kategorie', filters.kategorie);
    if (filters.lagerort) params.set('lagerort', filters.lagerort);
    return params.toString();
  }, [filters]);

  useEffect(() => {
    const load = async () => {
      try {
        setError('');
        const [artikelData, kategorienData, lagerorteData] = await Promise.all([
          apiRequest(`/api/artikel${query ? `?${query}` : ''}`),
          apiRequest('/api/kategorien'),
          apiRequest('/api/lagerorte'),
        ]);
        setArtikel(artikelData);
        setKategorien(kategorienData);
        setLagerorte(lagerorteData);
      } catch (err) {
        setError(err.message);
      }
    };

    load();
  }, [query]);

  const handleExport = () => {
    const href = `/api/export/csv${query ? `?${query}` : ''}`;
    const link = document.createElement('a');
    link.href = href;
    link.download = 'bestand.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Layout>
      <section className="card">
        <div className="toolbar">
          <input
            placeholder="Suche nach Name"
            value={filters.suche}
            onChange={(e) => setFilters((prev) => ({ ...prev, suche: e.target.value }))}
          />
          <select
            value={filters.kategorie}
            onChange={(e) => setFilters((prev) => ({ ...prev, kategorie: e.target.value }))}
          >
            <option value="">Alle Kategorien</option>
            {kategorien.map((kategorie) => (
              <option key={kategorie} value={kategorie}>
                {kategorie}
              </option>
            ))}
          </select>
          <select
            value={filters.lagerort}
            onChange={(e) => setFilters((prev) => ({ ...prev, lagerort: e.target.value }))}
          >
            <option value="">Alle Lagerorte</option>
            {lagerorte.map((lagerort) => (
              <option key={lagerort} value={lagerort}>
                {lagerort}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleExport}>
            Export als CSV
          </button>
          <Link className="button" to="/artikel/neu">
            Neuer Artikel
          </Link>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Kategorie</th>
                <th>Lagerort</th>
                <th>Menge</th>
                <th>Einheit</th>
                <th>Mindestbestand</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {artikel.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link to={`/artikel/${item.id}`}>{item.name}</Link>
                  </td>
                  <td>{item.kategorie || '-'}</td>
                  <td>{item.lagerort || '-'}</td>
                  <td>{item.menge}</td>
                  <td>{item.einheit || '-'}</td>
                  <td>{item.mindestbestand}</td>
                  <td>{statusBadge(item)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!artikel.length && <p>Keine Artikel gefunden.</p>}
        </div>
      </section>
    </Layout>
  );
};

const ArtikelForm = ({ initialValues = emptyForm, onSubmit, submitLabel, showStartMenge = false }) => {
  const [form, setForm] = useState(initialValues);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Name ist ein Pflichtfeld.');
      return;
    }

    if (showStartMenge && form.menge === '') {
      setError('Start-Menge ist erforderlich.');
      return;
    }

    if (form.mindestbestand === '' || Number.isNaN(Number(form.mindestbestand)) || Number(form.mindestbestand) < 0) {
      setError('Mindestbestand muss eine gültige, nicht negative Zahl sein.');
      return;
    }

    if (showStartMenge && (Number.isNaN(Number(form.menge)) || Number(form.menge) < 0)) {
      setError('Start-Menge muss eine gültige, nicht negative Zahl sein.');
      return;
    }

    try {
      await onSubmit({
        name: form.name,
        kategorie: form.kategorie,
        lagerort: form.lagerort,
        menge: Number(form.menge),
        einheit: form.einheit,
        mindestbestand: Number(form.mindestbestand),
        notiz: form.notiz,
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="card form-grid" onSubmit={handleSubmit}>
      {error && <p className="error">{error}</p>}

      <label>
        Name *
        <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
      </label>
      <label>
        Kategorie
        <input value={form.kategorie} onChange={(e) => setForm((prev) => ({ ...prev, kategorie: e.target.value }))} />
      </label>
      <label>
        Lagerort
        <input value={form.lagerort} onChange={(e) => setForm((prev) => ({ ...prev, lagerort: e.target.value }))} />
      </label>
      <label>
        Einheit
        <input value={form.einheit} onChange={(e) => setForm((prev) => ({ ...prev, einheit: e.target.value }))} />
      </label>
      <label>
        Mindestbestand
        <input
          type="number"
          step="0.01"
          value={form.mindestbestand}
          onChange={(e) => setForm((prev) => ({ ...prev, mindestbestand: e.target.value }))}
        />
      </label>
      {showStartMenge && (
        <label>
          Start-Menge
          <input
            type="number"
            step="0.01"
            value={form.menge}
            onChange={(e) => setForm((prev) => ({ ...prev, menge: e.target.value }))}
          />
        </label>
      )}
      <label className="full-width">
        Notiz
        <textarea value={form.notiz} onChange={(e) => setForm((prev) => ({ ...prev, notiz: e.target.value }))} />
      </label>

      <button type="submit">{submitLabel}</button>
    </form>
  );
};

const CreatePage = () => {
  const navigate = useNavigate();

  return (
    <Layout>
      <h2>Neuer Artikel</h2>
      <ArtikelForm
        showStartMenge
        onSubmit={async (payload) => {
          const created = await apiRequest('/api/artikel', { method: 'POST', body: JSON.stringify(payload) });
          navigate(`/artikel/${created.id}`);
        }}
        submitLabel="Artikel anlegen"
      />
    </Layout>
  );
};

const EditPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [initialValues, setInitialValues] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const artikel = await apiRequest(`/api/artikel/${id}`);
        setInitialValues({
          name: artikel.name || '',
          kategorie: artikel.kategorie || '',
          lagerort: artikel.lagerort || '',
          menge: String(artikel.menge ?? 0),
          einheit: artikel.einheit || '',
          mindestbestand: String(artikel.mindestbestand ?? 0),
          notiz: artikel.notiz || '',
        });
      } catch (err) {
        setError(err.message);
      }
    };

    load();
  }, [id]);

  return (
    <Layout>
      <h2>Artikel bearbeiten</h2>
      {error && <p className="error">{error}</p>}
      {initialValues && (
        <ArtikelForm
          key={`${id}-${JSON.stringify(initialValues)}`}
          initialValues={initialValues}
          onSubmit={async (payload) => {
            await apiRequest(`/api/artikel/${id}`, {
              method: 'PUT',
              body: JSON.stringify({
                name: payload.name,
                kategorie: payload.kategorie,
                lagerort: payload.lagerort,
                einheit: payload.einheit,
                mindestbestand: payload.mindestbestand,
                notiz: payload.notiz,
              }),
            });
            navigate(`/artikel/${id}`);
          }}
          submitLabel="Änderungen speichern"
        />
      )}
    </Layout>
  );
};

const DetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [artikel, setArtikel] = useState(null);
  const [error, setError] = useState('');
  const [moveForm, setMoveForm] = useState({ typ: 'zugang', menge: '', kommentar: '' });
  const [moveError, setMoveError] = useState('');

  const loadArtikel = async () => {
    try {
      setError('');
      const data = await apiRequest(`/api/artikel/${id}`);
      setArtikel(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadArtikel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (searchParams.get('bewegung') === '1') {
      const target = document.getElementById('bewegung-form');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    }
  }, [searchParams, artikel]);

  const submitMovement = async (e) => {
    e.preventDefault();
    setMoveError('');

    if (moveForm.menge === '' || Number.isNaN(Number(moveForm.menge)) || Number(moveForm.menge) < 0) {
      setMoveError('Menge muss eine gültige, nicht negative Zahl sein.');
      return;
    }

    try {
      await apiRequest(`/api/artikel/${id}/bewegung`, {
        method: 'POST',
        body: JSON.stringify({
          typ: moveForm.typ,
          menge: Number(moveForm.menge),
          kommentar: moveForm.kommentar,
        }),
      });
      setMoveForm({ typ: 'zugang', menge: '', kommentar: '' });
      await loadArtikel();
    } catch (err) {
      setMoveError(err.message);
    }
  };

  const deleteArtikel = async () => {
    const shouldDelete = window.confirm('Artikel wirklich löschen?');
    if (!shouldDelete) return;

    try {
      await apiRequest(`/api/artikel/${id}`, { method: 'DELETE' });
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Layout>
      {error && <p className="error">{error}</p>}
      {artikel && (
        <>
          <section className="card">
            <div className="row-between">
              <h2>{artikel.name}</h2>
              {statusBadge(artikel)}
            </div>
            <p>
              <strong>Kategorie:</strong> {artikel.kategorie || '-'}
            </p>
            <p>
              <strong>Lagerort:</strong> {artikel.lagerort || '-'}
            </p>
            <p>
              <strong>Bestand:</strong> {artikel.menge} {artikel.einheit || ''}
            </p>
            <p>
              <strong>Mindestbestand:</strong> {artikel.mindestbestand}
            </p>
            <p>
              <strong>Notiz:</strong> {artikel.notiz || '-'}
            </p>
            <div className="inline-actions">
              <Link className="button" to={`/artikel/${id}/bearbeiten`}>
                Bearbeiten
              </Link>
              <button type="button" className="button danger" onClick={deleteArtikel}>
                Löschen
              </button>
            </div>
          </section>

          <section id="bewegung-form" className="card">
            <h3>Bestandsbewegung erfassen</h3>
            {moveError && <p className="error">{moveError}</p>}
            <form className="form-grid" onSubmit={submitMovement}>
              <label>
                Typ
                <select
                  value={moveForm.typ}
                  onChange={(e) => setMoveForm((prev) => ({ ...prev, typ: e.target.value }))}
                >
                  <option value="zugang">Zugang</option>
                  <option value="abgang">Abgang</option>
                  <option value="inventur">Inventurzählung</option>
                </select>
              </label>
              <label>
                Menge
                <input
                  type="number"
                  step="0.01"
                  value={moveForm.menge}
                  onChange={(e) => setMoveForm((prev) => ({ ...prev, menge: e.target.value }))}
                />
              </label>
              <label className="full-width">
                Kommentar
                <input
                  value={moveForm.kommentar}
                  onChange={(e) => setMoveForm((prev) => ({ ...prev, kommentar: e.target.value }))}
                />
              </label>
              <button type="submit">Bewegung speichern</button>
            </form>
          </section>

          <section className="card">
            <h3>Bewegungshistorie</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Typ</th>
                    <th>Menge</th>
                    <th>Kommentar</th>
                  </tr>
                </thead>
                <tbody>
                  {artikel.bewegungen.map((bewegung) => (
                    <tr key={bewegung.id}>
                      <td>{formatDate(bewegung.erstellt_am)}</td>
                      <td>{bewegung.typ}</td>
                      <td>{bewegung.menge}</td>
                      <td>{bewegung.kommentar || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!artikel.bewegungen.length && <p>Noch keine Bewegungen vorhanden.</p>}
            </div>
          </section>
        </>
      )}
    </Layout>
  );
};

const WarnlistePage = () => {
  const [warnliste, setWarnliste] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiRequest('/api/warnliste');
        setWarnliste(data);
      } catch (err) {
        setError(err.message);
      }
    };

    load();
  }, []);

  return (
    <Layout>
      <section className="card">
        <h2>Warnliste – Was fehlt?</h2>
        {error && <p className="error">{error}</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Lagerort</th>
                <th>Ist</th>
                <th>Mindestbestand</th>
                <th>Fehlt</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {warnliste.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.lagerort || '-'}</td>
                  <td>{item.menge}</td>
                  <td>{item.mindestbestand}</td>
                  <td>{item.fehlt}</td>
                  <td>
                    <Link className="button" to={`/artikel/${item.id}?bewegung=1`}>
                      Zur Bewegung
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!warnliste.length && <p>Aktuell müssen keine Artikel nachbestellt werden.</p>}
        </div>
      </section>
    </Layout>
  );
};

const App = () => (
  <Routes>
    <Route path="/" element={<OverviewPage />} />
    <Route path="/warnliste" element={<WarnlistePage />} />
    <Route path="/artikel/neu" element={<CreatePage />} />
    <Route path="/artikel/:id" element={<DetailPage />} />
    <Route path="/artikel/:id/bearbeiten" element={<EditPage />} />
    <Route
      path="*"
      element={
        <Layout>
          <section className="card">
            <h2>Seite nicht gefunden</h2>
            <Link className="button" to="/">
              Zur Bestandsübersicht
            </Link>
          </section>
        </Layout>
      }
    />
  </Routes>
);

export default App;
