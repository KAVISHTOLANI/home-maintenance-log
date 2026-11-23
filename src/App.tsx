import { useMemo, useState, type ReactNode } from 'react';
import { DemoTag, EmptyState, Field, Landing, NotFound, Notice, PageHead, Shell, downloadText, uid, useFlash, usePersistentState, useRoute } from './shared/ui';
import { DataTable, useTable, type Column } from './shared/table';
import { toCSV } from './shared/csv';
import { addDays, addMonths, formatDay, fromISO, relativeDays, todayISO } from './shared/dates';
import {
  CATEGORIES,
  RECORD_TYPES,
  ageInfo,
  lastServiced,
  money,
  spendByCategory,
  spendByMonth,
  totalFor,
  upcoming,
  validateAsset,
  validateRecord,
  validateSchedule,
  type Asset,
  type Category,
  type RecordType,
  type Schedule,
  type ServiceRecord,
} from './lib/upkeep';

const KEY = 'upkeep:store';
const NAV = [
  { to: '/', label: 'Overview' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/assets', label: 'Home systems' },
  { to: '/records', label: 'Service log' },
];

interface Store {
  assets: Asset[];
  schedules: Schedule[];
  records: ServiceRecord[];
}

export function demoStore(today: string): Store {
  const y = (n: number) => addMonths(today, -12 * n);
  const a = (id: string, name: string, category: Category, location: string, brand: string, model: string, installed: string, lifespanYears: number | null): Asset => ({ id: `demo-${id}`, name, category, location, brand, model, installed, lifespanYears, demo: true });
  const assets: Asset[] = [
    a('furnace', 'Gas furnace', 'Heating & cooling', 'Basement', 'Demo Heatworks', 'GF-80', y(14), 18),
    a('ac', 'Central air conditioner', 'Heating & cooling', 'Side yard', 'Demo Heatworks', 'AC-3T', y(6), 15),
    a('water', 'Water heater (50 gal tank)', 'Plumbing', 'Basement', 'Demo Aqua', 'WH-50', y(11), 12),
    a('fridge', 'Refrigerator', 'Appliance', 'Kitchen', 'Demo Coldline', 'RF-22', y(4), 13),
    a('dish', 'Dishwasher', 'Appliance', 'Kitchen', 'Demo Coldline', 'DW-5', y(2), 10),
    a('roof', 'Roof (asphalt shingles) and gutters on the main house and garage', 'Exterior', 'Outside', '', '', y(9), 25),
    a('smoke', 'Smoke and CO alarms', 'Safety', 'Every floor', '', '', y(3), 10),
    a('panel', 'Electrical panel', 'Electrical', 'Garage', '', '', '', null),
  ];
  const s = (id: string, assetId: string, task: string, everyMonths: number, firstDue: string): Schedule => ({ id: `demo-s-${id}`, assetId: `demo-${assetId}`, task, everyMonths, firstDue });
  const schedules: Schedule[] = [
    s('filter', 'furnace', 'Replace furnace filter', 3, addDays(today, -200)),
    s('furnace-svc', 'furnace', 'Professional furnace service', 12, addDays(today, -400)),
    s('ac-svc', 'ac', 'Clean condenser coils', 12, addDays(today, -300)),
    s('flush', 'water', 'Flush water heater tank', 12, addDays(today, -500)),
    s('coils', 'fridge', 'Vacuum refrigerator coils', 6, addDays(today, -200)),
    s('dw-filter', 'dish', 'Clean dishwasher filter', 1, addDays(today, -60)),
    s('gutters', 'roof', 'Clear gutters', 6, addDays(today, -300)),
    s('alarms', 'smoke', 'Test alarms and replace batteries', 6, addDays(today, -400)),
  ];
  const records: ServiceRecord[] = [];
  const r = (assetId: string, scheduleId: string | null, date: string, type: RecordType, description: string, cost: number, provider = '') => records.push({ id: `demo-r${records.length}`, assetId: `demo-${assetId}`, scheduleId: scheduleId && `demo-s-${scheduleId}`, date, type, description, cost, provider });
  r('furnace', 'filter', addDays(today, -280), 'Maintenance', 'Filter replaced (MERV 11)', 18);
  r('furnace', 'filter', addDays(today, -190), 'Maintenance', 'Filter replaced (MERV 11)', 18);
  r('furnace', 'filter', addDays(today, -100), 'Maintenance', 'Filter replaced (MERV 11)', 18);
  r('furnace', 'furnace-svc', addDays(today, -350), 'Maintenance', 'Annual service, flame sensor cleaned', 145, 'Demo Heating Co.');
  r('furnace', null, addDays(today, -40), 'Repair', 'Igniter replaced after no-heat call', 260, 'Demo Heating Co.');
  r('ac', 'ac-svc', addDays(today, -170), 'Maintenance', 'Coils cleaned, refrigerant checked', 120, 'Demo Heating Co.');
  r('water', 'flush', addDays(today, -400), 'Maintenance', 'Tank flushed, some sediment', 0);
  r('water', null, addDays(today, -75), 'Inspection', 'Small leak at the drain valve; monitor', 0);
  r('fridge', 'coils', addDays(today, -160), 'Maintenance', 'Coils vacuumed', 0);
  r('fridge', null, addDays(today, -220), 'Repair', 'Ice maker water valve replaced', 189.5, 'Demo Appliance Repair');
  r('dish', 'dw-filter', addDays(today, -20), 'Maintenance', 'Filter rinsed', 0);
  r('roof', 'gutters', addDays(today, -150), 'Maintenance', 'Gutters cleared, one downspout reattached', 210, 'Demo Gutter Pros');
  r('roof', null, addDays(today, -300), 'Inspection', 'Roof inspection after storm — no damage', 0, 'Demo Roofing');
  r('smoke', 'alarms', addDays(today, -190), 'Maintenance', 'All alarms tested, 6 batteries replaced', 24);
  r('panel', null, addDays(today, -330), 'Repair', 'Kitchen breaker replaced', 175, 'Demo Electric');
  return { assets, schedules, records };
}

export default function App() {
  const [route, navigate] = useRoute();
  const today = todayISO();
  const [store, setStore] = usePersistentState<Store>(KEY, () => demoStore(today));
  const ctx = { store, setStore, today, navigate };
  const assetEdit = route.match(/^\/asset\/([^/]+)\/edit$/);
  const asset = route.match(/^\/asset\/([^/]+)$/);
  const logFor = route.match(/^\/log(?:\/(.+))?$/);
  let page: ReactNode;
  if (route === '/') page = <Home />;
  else if (route === '/dashboard') page = <Dashboard {...ctx} />;
  else if (route === '/assets') page = <Assets {...ctx} />;
  else if (route === '/asset/new') page = <AssetForm {...ctx} />;
  else if (assetEdit) page = <AssetForm {...ctx} id={assetEdit[1]} />;
  else if (asset) page = <AssetPage {...ctx} id={asset[1]} />;
  else if (route === '/records') page = <Records {...ctx} />;
  else if (logFor) page = <LogWork {...ctx} preset={logFor[1]} />;
  else page = <NotFound />;
  return (
    <Shell name="Upkeep" wordmark={['Up', 'keep']} nav={NAV} route={route} cta={{ to: '/log', label: 'Log work' }}>
      {page}
    </Shell>
  );
}

type Ctx = { store: Store; setStore: (s: Store) => void; today: string; navigate: (to: string) => void };
const assetName = (s: Store, id: string) => s.assets.find((a) => a.id === id)?.name ?? 'Removed item';
const monthLabel = (ym: string, opts: Intl.DateTimeFormatOptions = { month: 'short' }) => fromISO(`${ym}-01`).toLocaleDateString(undefined, opts);

function DueList({ store, today, limit, compact }: { store: Store; today: string; limit?: number; compact?: boolean }) {
  const items = upcoming(store.schedules, store.records, today).filter((u) => u.state !== 'ok').slice(0, limit);
  if (items.length === 0) return <p className="muted">Nothing due in the next 30 days.</p>;
  return (
    <ul className="due-rows">
      {items.map((u, i) => (
        <li key={u.schedule.id} className={`due-row is-${u.state}`} style={{ ['--i' as string]: i }}>
          <span className="due-when"><strong>{u.state === 'overdue' ? `${-u.days}d` : u.days === 0 ? 'Today' : `${u.days}d`}</strong><small>{u.state === 'overdue' ? 'overdue' : 'to go'}</small></span>
          <span className="due-what"><span className="due-task">{u.schedule.task}</span><span className="small muted">{assetName(store, u.schedule.assetId)} · every {u.schedule.everyMonths} mo</span></span>
          {!compact && <a className="btn btn-sm" href={`#/log/${u.schedule.id}`} aria-label={`Log ${u.schedule.task}`}>Log it</a>}
        </li>
      ))}
    </ul>
  );
}

function MonthChart({ store, today }: { store: Store; today: string }) {
  const [tip, setTip] = useState<{ x: number; text: string } | null>(null);
  const data = spendByMonth(store.records, today);
  const max = Math.max(50, ...data.map((d) => d.total));
  const nice = Math.ceil(max / 50) * 50;
  return (
    <figure className="chart-fig">
      <div className="bars-wrap" onMouseLeave={() => setTip(null)}>
        <div className="bars-axis" aria-hidden="true">{[nice, nice / 2, 0].map((t) => <span key={t}>${t}</span>)}</div>
        <div className="bars" role="img" aria-label={`Spending per month for the last 12 months; total ${money(data.reduce((s, d) => s + d.total, 0))}.`}>
          {data.map((d, i) => {
            const text = `${monthLabel(d.month, { month: 'long', year: 'numeric' })}: ${money(d.total)}`;
            return (
              <div key={d.month} className="bar-col" style={{ ['--i' as string]: i }} tabIndex={0} aria-label={text}
                onMouseEnter={(e) => setTip({ x: (e.currentTarget as HTMLElement).offsetLeft + 10, text })}
                onFocus={(e) => setTip({ x: (e.currentTarget as HTMLElement).offsetLeft + 10, text })} onBlur={() => setTip(null)}>
                <div className="bar-stack" style={{ height: `${(d.total / nice) * 100}%` }}><span style={{ flexGrow: 1, background: 'var(--accent)' }} /></div>
                <span className="bar-label mono">{monthLabel(d.month, { month: 'narrow' })}</span>
              </div>
            );
          })}
          {tip && <span className="chart-tip" style={{ left: tip.x, top: 0 }}>{tip.text}</span>}
        </div>
      </div>
      <figcaption className="legend"><span><i style={{ background: 'var(--accent)' }} />Spend per month (USD)</span><span className="muted">· {monthLabel(data[0].month, { month: 'short', year: 'numeric' })} – {monthLabel(data[11].month, { month: 'short', year: 'numeric' })}</span></figcaption>
    </figure>
  );
}

function HeroPreview() {
  const today = todayISO();
  const s = demoStore(today);
  const yearSpend = totalFor(s.records, (r) => r.date > addDays(today, -365));
  return (
    <div className="hero-up">
      <div className="hero-up-kpis">
        <div><b>{upcoming(s.schedules, s.records, today).filter((u) => u.state === 'overdue').length}</b><span>overdue</span></div>
        <div><b>{upcoming(s.schedules, s.records, today).filter((u) => u.state === 'soon').length}</b><span>due in 30 days</span></div>
        <div><b>{money(yearSpend)}</b><span>last 12 months</span></div>
      </div>
      <DueList store={s} today={today} limit={4} compact />
    </div>
  );
}

function Home() {
  return (
    <Landing
      eyebrow="Home maintenance log"
      title={<>The house remembers <em>so you don’t have to.</em></>}
      lead="Keep every appliance and system in one place with its install date, maintenance schedule and full service history. Upkeep tells you what’s overdue, what it has cost, and what’s nearing the end of its life."
      primary={{ href: '#/dashboard', label: 'Open the dashboard' }}
      secondary={{ href: '#/assets', label: 'Browse home systems' }}
      previewLabel="Maintenance due — demo home"
      preview={<HeroPreview />}
      steps={[
        { title: 'List what you own', body: 'Furnace, water heater, roof, appliances — with location, model, install date and expected lifespan.' },
        { title: 'Set the routine', body: 'Add recurring tasks such as “replace filter every 3 months” to each item.' },
        { title: 'Log the work', body: 'Record maintenance, repairs and inspections with cost and who did it. Due dates move forward automatically.' },
      ]}
      stepsIntro="Upkeep opens with a labelled demo home — eight systems and a year of history. Clear it when you’re ready."
      features={[
        { title: 'What’s due', body: 'Overdue and next-30-days tasks, sorted by urgency, with one-click logging.' },
        { title: 'What it costs', body: 'Spend per month and per category, with labelled charts and exact figures.' },
        { title: 'What’s ageing', body: 'Each item’s age against its expected lifespan, so replacements aren’t a surprise.' },
        { title: 'A record for resale', body: 'Export the full service log as CSV for a buyer, insurer or contractor.' },
      ]}
      note="Lifespans are your own estimates. Upkeep doesn’t give safety or repair advice — use a qualified professional for gas, electrical and structural work."
      closing={{ title: <>Start with the furnace <em>filter.</em></>, action: { href: '#/asset/new', label: 'Add a home system' } }}
    />
  );
}

function Dashboard({ store, setStore, today }: Ctx) {
  if (store.assets.length === 0)
    return <EmptyState title="Nothing tracked yet" actions={<><a className="btn btn-primary" href="#/asset/new">Add a home system</a><button type="button" className="btn" onClick={() => setStore(demoStore(today))}>Load demo home</button></>}>Start with the appliance or system you worry about most.</EmptyState>;
  const ups = upcoming(store.schedules, store.records, today);
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const cats = spendByCategory(store.records, store.assets, addDays(today, -365), today);
  const catMax = Math.max(1, ...cats.map((c) => c.total));
  const ageing = store.assets.map((a) => ({ a, ...ageInfo(a, today) })).filter((x) => x.used != null).sort((x, y) => y.used! - x.used!).slice(0, 5);
  return (
    <div className="stack">
      <PageHead eyebrow="Dashboard" title={<>The state of <em>the house.</em></>} actions={<a className="btn btn-primary" href="#/log">Log work</a>} />
      <div className="stats">
        <div className="stat"><span className="stat-label">Overdue</span><span className="stat-value">{ups.filter((u) => u.state === 'overdue').length}</span></div>
        <div className="stat"><span className="stat-label">Due in 30 days</span><span className="stat-value">{ups.filter((u) => u.state === 'soon').length}</span></div>
        <div className="stat"><span className="stat-label">Spent this year</span><span className="stat-value">{money(totalFor(store.records, (r) => r.date >= yearStart && r.date <= today))}</span></div>
        <div className="stat"><span className="stat-label">Last 12 months</span><span className="stat-value">{money(totalFor(store.records, (r) => r.date > addDays(today, -365)))}</span></div>
      </div>
      <div className="layout-main">
        <section className="card stack" aria-labelledby="due-title"><h2 id="due-title" className="h3">Due and overdue</h2><DueList store={store} today={today} /></section>
        <section className="card stack" aria-labelledby="age-title">
          <h2 id="age-title" className="h3">Nearest end of life</h2>
          {ageing.length === 0 ? <p className="muted small">Add install dates and lifespans to see this.</p> : (
            <ul className="life-list">
              {ageing.map(({ a, years, used }) => (
                <li key={a.id}>
                  <div className="row-between small"><a href={`#/asset/${a.id}`}>{a.name}</a><span className="mono">{years} / {a.lifespanYears} yr</span></div>
                  <div className={`progress ${used! >= 1 ? 'is-over' : used! >= 0.8 ? 'is-near' : ''}`} role="progressbar" aria-label={`${a.name}: ${Math.round(used! * 100)}% of expected lifespan`} aria-valuenow={Math.round(used! * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.min(1, used!) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <div className="grid-2">
        <section className="card stack" aria-labelledby="m-title"><h2 id="m-title" className="h3">Spend per month</h2><MonthChart store={store} today={today} /></section>
        <section className="card stack" aria-labelledby="c-title">
          <h2 id="c-title" className="h3">Spend by category, last 12 months</h2>
          {cats.length === 0 ? <p className="muted small">No costs logged in the last year.</p> : (
            <ul className="cat-bars" aria-label="Spend by category">
              {cats.map((c, i) => (
                <li key={c.category} style={{ ['--i' as string]: i }}>
                  <span className="cat-name">{c.category}</span>
                  <span className="cat-track"><span style={{ width: `${(c.total / catMax) * 100}%` }} /></span>
                  <span className="mono small">{money(c.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Assets({ store, setStore, today }: Ctx) {
  const [flash, setFlash] = useFlash();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const rows = store.assets.filter((a) => (!cat || a.category === cat) && `${a.name} ${a.location} ${a.brand} ${a.model}`.toLowerCase().includes(q.trim().toLowerCase()));
  const nextFor = (a: Asset) => upcoming(store.schedules.filter((s) => s.assetId === a.id), store.records, today)[0];
  const columns: Column<Asset>[] = [
    { key: 'name', label: 'Item', sort: (a) => a.name, render: (a) => <><a href={`#/asset/${a.id}`}>{a.name}</a>{a.demo && <> <DemoTag /></>}<div className="small muted">{[a.brand, a.model].filter(Boolean).join(' ')}</div></> },
    { key: 'cat', label: 'Category', sort: (a) => a.category, render: (a) => a.category },
    { key: 'loc', label: 'Location', sort: (a) => a.location, render: (a) => a.location || '—' },
    { key: 'age', label: 'Age', num: true, sort: (a) => ageInfo(a, today).years, render: (a) => { const g = ageInfo(a, today); return g.years == null ? '—' : <>{g.years} yr{g.used != null && g.used >= 0.8 && <> <span className={`badge ${g.used >= 1 ? 'badge-err' : 'badge-warn'}`}>{g.used >= 1 ? 'Past lifespan' : 'Near end'}</span></>}</>; } },
    { key: 'next', label: 'Next task', sort: (a) => nextFor(a)?.due ?? '', render: (a) => { const n = nextFor(a); return n ? <><span className={`badge ${n.state === 'overdue' ? 'badge-err' : n.state === 'soon' ? 'badge-warn' : ''}`}>{relativeDays(n.days)}</span> <span className="small">{n.schedule.task}</span></> : '—'; } },
    { key: 'spent', label: 'Total spent', num: true, sort: (a) => totalFor(store.records, (r) => r.assetId === a.id), render: (a) => money(totalFor(store.records, (r) => r.assetId === a.id)) },
  ];
  const table = useTable(rows, columns, { initialSort: 'next' });
  return (
    <div className="stack">
      <PageHead eyebrow="Home systems" title={<>Everything that <em>keeps the house running.</em></>} actions={<a className="btn btn-primary" href="#/asset/new">Add item</a>} />
      {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
      {store.assets.length === 0 ? (
        <EmptyState title="Nothing tracked yet" actions={<><a className="btn btn-primary" href="#/asset/new">Add a home system</a><button type="button" className="btn" onClick={() => setStore(demoStore(today))}>Load demo home</button></>}>Add appliances and systems with their install dates.</EmptyState>
      ) : (
        <div className="card stack">
          <div className="filters">
            <Field label="Search" className="grow">{(p) => <input {...p} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, location, brand or model" />}</Field>
            <Field label="Category">{(p) => <select {...p} value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>}</Field>
          </div>
          <DataTable caption="Home systems and appliances" columns={columns} table={table} rowKey={(a) => a.id} empty="Nothing matches these filters." />
          {store.assets.some((a) => a.demo) && <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => { const ids = new Set(store.assets.filter((a) => a.demo).map((a) => a.id)); setStore({ assets: store.assets.filter((a) => !ids.has(a.id)), schedules: store.schedules.filter((s) => !ids.has(s.assetId)), records: store.records.filter((r) => !ids.has(r.assetId)) }); setFlash({ kind: 'success', text: 'Demo home removed.' }); }}>Clear demo home</button></div>}
        </div>
      )}
    </div>
  );
}

function AssetForm({ store, setStore, today, navigate, id }: Ctx & { id?: string }) {
  const ex = id ? store.assets.find((a) => a.id === id) : undefined;
  const [d, setD] = useState({ name: ex?.name ?? '', category: ex?.category ?? ('Appliance' as Category), location: ex?.location ?? '', brand: ex?.brand ?? '', model: ex?.model ?? '', installed: ex?.installed ?? '', lifespan: ex?.lifespanYears == null ? '' : String(ex.lifespanYears) });
  const [submitted, setSubmitted] = useState(false);
  if (id && !ex) return <EmptyState title="Item not found" actions={<a className="btn btn-primary" href="#/assets">Back</a>} />;
  const errors = submitted ? validateAsset(d, today) : {};
  function save(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateAsset(d, today)).length) return;
    const v = { name: d.name.trim(), category: d.category, location: d.location.trim(), brand: d.brand.trim(), model: d.model.trim(), installed: d.installed, lifespanYears: d.lifespan.trim() ? Number(d.lifespan) : null };
    if (ex) { setStore({ ...store, assets: store.assets.map((a) => (a.id === ex.id ? { ...ex, ...v, demo: false } : a)) }); navigate(`/asset/${ex.id}`); }
    else { const nid = uid('asset'); setStore({ ...store, assets: [...store.assets, { ...v, id: nid }] }); navigate(`/asset/${nid}`); }
  }
  return (
    <div className="stack">
      <PageHead eyebrow={ex ? 'Edit item' : 'New item'} title={ex ? <>Edit <em>{ex.name}</em></> : <>Add a <em>home system.</em></>} />
      <form className="card stack" onSubmit={save} noValidate>
        <div className="form-grid">
          <Field label="Name" error={errors.name}>{(p) => <input {...p} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Water heater" />}</Field>
          <Field label="Category">{(p) => <select {...p} value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as Category })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>}</Field>
          <Field label="Location">{(p) => <input {...p} value={d.location} onChange={(e) => setD({ ...d, location: e.target.value })} placeholder="e.g. Basement" />}</Field>
          <Field label="Brand">{(p) => <input {...p} value={d.brand} onChange={(e) => setD({ ...d, brand: e.target.value })} />}</Field>
          <Field label="Model">{(p) => <input {...p} className="mono" value={d.model} onChange={(e) => setD({ ...d, model: e.target.value })} />}</Field>
          <Field label="Installed" hint="Optional" error={errors.installed}>{(p) => <input {...p} type="date" max={today} value={d.installed} onChange={(e) => setD({ ...d, installed: e.target.value })} />}</Field>
          <Field label="Expected lifespan (years)" hint="Your estimate; optional" error={errors.lifespan}>{(p) => <input {...p} inputMode="decimal" value={d.lifespan} onChange={(e) => setD({ ...d, lifespan: e.target.value })} />}</Field>
        </div>
        <div className="row"><button className="btn btn-primary" type="submit">{ex ? 'Save changes' : 'Save item'}</button><a className="btn btn-ghost" href={ex ? `#/asset/${ex.id}` : '#/assets'}>Cancel</a></div>
      </form>
    </div>
  );
}

function AssetPage({ store, setStore, today, navigate, id }: Ctx & { id: string }) {
  const a = store.assets.find((x) => x.id === id);
  const [flash, setFlash] = useFlash();
  const [sd, setSd] = useState({ task: '', every: '6', firstDue: today });
  const [sSub, setSSub] = useState(false);
  if (!a) return <EmptyState title="Item not found" actions={<a className="btn btn-primary" href="#/assets">Back to home systems</a>}>It may have been removed.</EmptyState>;
  const g = ageInfo(a, today);
  const scheds = upcoming(store.schedules.filter((s) => s.assetId === a.id), store.records, today);
  const recs = store.records.filter((r) => r.assetId === a.id).sort((x, y) => y.date.localeCompare(x.date));
  const sErr = sSub ? validateSchedule(sd) : {};
  function addSched(e: React.FormEvent) {
    e.preventDefault();
    setSSub(true);
    if (Object.keys(validateSchedule(sd)).length) return;
    setStore({ ...store, schedules: [...store.schedules, { id: uid('sched'), assetId: a!.id, task: sd.task.trim(), everyMonths: Number(sd.every), firstDue: sd.firstDue }] });
    setFlash({ kind: 'success', text: `Scheduled “${sd.task.trim()}”.` });
    setSd({ task: '', every: '6', firstDue: today });
    setSSub(false);
  }
  return (
    <div className="stack">
      <PageHead eyebrow={<><a href="#/assets">Home systems</a> / {a.category}</>} title={a.name} description={[a.location, [a.brand, a.model].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || undefined}
        actions={<><a className="btn btn-primary" href={`#/log/asset-${a.id}`}>Log work</a><a className="btn" href={`#/asset/${a.id}/edit`}>Edit</a><button type="button" className="btn btn-danger" onClick={() => { if (window.confirm(`Remove ${a.name} with its schedules and service history?`)) { setStore({ assets: store.assets.filter((x) => x.id !== a.id), schedules: store.schedules.filter((s) => s.assetId !== a.id), records: store.records.filter((r) => r.assetId !== a.id) }); navigate('/assets'); } }}>Remove</button></>} />
      {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
      {a.demo && <p><DemoTag /> <span className="small muted">Fictional demo item.</span></p>}
      <div className="stats">
        <div className="stat"><span className="stat-label">Installed</span><span className="stat-value small-val">{a.installed ? formatDay(a.installed, { month: 'short', year: 'numeric' }) : 'Unknown'}</span></div>
        <div className="stat"><span className="stat-label">Age</span><span className="stat-value small-val">{g.years == null ? '—' : `${g.years} yr`}</span></div>
        <div className="stat"><span className="stat-label">Lifespan used</span><span className="stat-value small-val">{g.used == null ? '—' : `${Math.round(g.used * 100)}%`}</span></div>
        <div className="stat"><span className="stat-label">Total spent</span><span className="stat-value small-val">{money(totalFor(recs, () => true))}</span></div>
      </div>
      <div className="layout-main">
        <section className="card stack" aria-labelledby="hist-title">
          <h2 id="hist-title" className="h3">Service history</h2>
          {recs.length === 0 ? <p className="muted">No work logged yet.</p> : (
            <ol className="timeline-list">
              {recs.map((r) => (
                <li key={r.id}>
                  <span className="mono small tl-date">{formatDay(r.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <div><strong>{r.description}</strong><div className="small muted">{r.type} · {r.provider || 'Did it myself'} · {money(r.cost)}</div></div>
                </li>
              ))}
            </ol>
          )}
        </section>
        <aside className="card stack" aria-labelledby="sched-title">
          <h2 id="sched-title" className="h3">Maintenance schedule</h2>
          {scheds.length === 0 ? <p className="muted small">No recurring tasks.</p> : (
            <ul className="list">
              {scheds.map((u) => (
                <li key={u.schedule.id} className="stack-tight">
                  <div className="row-between"><strong>{u.schedule.task}</strong><button type="button" className="icon-btn" aria-label={`Delete schedule ${u.schedule.task}`} onClick={() => setStore({ ...store, schedules: store.schedules.filter((s) => s.id !== u.schedule.id) })}>✕</button></div>
                  <span className="small muted">Every {u.schedule.everyMonths} months · last {lastServiced(store.records, u.schedule.id) ? formatDay(lastServiced(store.records, u.schedule.id)!, { day: 'numeric', month: 'short', year: 'numeric' }) : 'never'}</span>
                  <span><span className={`badge ${u.state === 'overdue' ? 'badge-err' : u.state === 'soon' ? 'badge-warn' : 'badge-ok'}`}>Due {relativeDays(u.days)}</span> <a className="small" href={`#/log/${u.schedule.id}`}>Log it</a></span>
                </li>
              ))}
            </ul>
          )}
          <form className="stack" onSubmit={addSched} noValidate>
            <h3 className="label">Add a recurring task</h3>
            <Field label="Task" error={sErr.task}>{(p) => <input {...p} value={sd.task} onChange={(e) => setSd({ ...sd, task: e.target.value })} placeholder="e.g. Descale" />}</Field>
            <div className="form-grid two">
              <Field label="Every (months)" error={sErr.every}>{(p) => <input {...p} inputMode="numeric" value={sd.every} onChange={(e) => setSd({ ...sd, every: e.target.value })} />}</Field>
              <Field label="First due" error={sErr.firstDue}>{(p) => <input {...p} type="date" value={sd.firstDue} onChange={(e) => setSd({ ...sd, firstDue: e.target.value })} />}</Field>
            </div>
            <div><button type="submit" className="btn btn-sm">Add schedule</button></div>
          </form>
        </aside>
      </div>
    </div>
  );
}

function LogWork({ store, setStore, today, navigate, preset }: Ctx & { preset?: string }) {
  const sched = preset ? store.schedules.find((s) => s.id === preset) : undefined;
  const presetAsset = preset?.startsWith('asset-') ? preset.slice(6) : sched?.assetId ?? '';
  const [d, setD] = useState({ assetId: presetAsset, scheduleId: sched?.id ?? '', date: today, type: 'Maintenance' as RecordType, description: sched?.task ?? '', cost: '', provider: '' });
  const [submitted, setSubmitted] = useState(false);
  if (store.assets.length === 0) return <EmptyState title="Add a home system first" actions={<a className="btn btn-primary" href="#/asset/new">Add a home system</a>}>Work is logged against an appliance or system.</EmptyState>;
  const errors = submitted ? validateRecord(d, today) : {};
  const scheds = store.schedules.filter((s) => s.assetId === d.assetId);
  function save(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateRecord(d, today)).length) return;
    setStore({ ...store, records: [...store.records, { id: uid('rec'), assetId: d.assetId, scheduleId: d.scheduleId || null, date: d.date, type: d.type, description: d.description.trim(), cost: d.cost.trim() ? Math.round(Number(d.cost) * 100) / 100 : 0, provider: d.provider.trim() }] });
    navigate(`/asset/${d.assetId}`);
  }
  return (
    <div className="stack">
      <PageHead eyebrow="Log work" title={<>Record what <em>was done.</em></>} description="Linking work to a recurring task moves that task’s next due date forward." />
      <form className="card stack" onSubmit={save} noValidate>
        {Object.keys(errors).length > 0 && <Notice kind="error">Please fix the highlighted fields.</Notice>}
        <div className="form-grid">
          <Field label="Item" error={errors.assetId}>{(p) => <select {...p} value={d.assetId} onChange={(e) => setD({ ...d, assetId: e.target.value, scheduleId: '' })}><option value="">Choose…</option>{store.assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}</Field>
          <Field label="Counts as recurring task" hint={scheds.length ? undefined : 'This item has no recurring tasks'}>{(p) => <select {...p} value={d.scheduleId} disabled={!scheds.length} onChange={(e) => { const s = scheds.find((x) => x.id === e.target.value); setD({ ...d, scheduleId: e.target.value, description: d.description || s?.task || '' }); }}><option value="">None (one-off)</option>{scheds.map((s) => <option key={s.id} value={s.id}>{s.task}</option>)}</select>}</Field>
          <Field label="Date" error={errors.date}>{(p) => <input {...p} type="date" max={today} value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />}</Field>
          <Field label="Type">{(p) => <select {...p} value={d.type} onChange={(e) => setD({ ...d, type: e.target.value as RecordType })}>{RECORD_TYPES.map((t) => <option key={t}>{t}</option>)}</select>}</Field>
          <Field label="Cost (USD)" hint="Leave blank for free" error={errors.cost}>{(p) => <input {...p} inputMode="decimal" value={d.cost} onChange={(e) => setD({ ...d, cost: e.target.value })} />}</Field>
          <Field label="Done by" hint="Company name, or blank if you did it">{(p) => <input {...p} value={d.provider} onChange={(e) => setD({ ...d, provider: e.target.value })} />}</Field>
        </div>
        <Field label="What was done" error={errors.description}>{(p) => <textarea {...p} rows={3} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />}</Field>
        <div className="row"><button className="btn btn-primary" type="submit">Save record</button><a className="btn btn-ghost" href="#/dashboard">Cancel</a></div>
      </form>
    </div>
  );
}

type Row = ServiceRecord & { asset: string };
function Records({ store, setStore }: Ctx) {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [year, setYear] = useState('');
  const years = [...new Set(store.records.map((r) => r.date.slice(0, 4)))].sort().reverse();
  const rows: Row[] = useMemo(() => store.records.filter((r) => (!type || r.type === type) && (!year || r.date.startsWith(year))).map((r) => ({ ...r, asset: assetName(store, r.assetId) })).filter((r) => `${r.asset} ${r.description} ${r.provider}`.toLowerCase().includes(q.trim().toLowerCase())), [store, q, type, year]);
  const columns: Column<Row>[] = [
    { key: 'date', label: 'Date', sort: (r) => r.date, render: (r) => formatDay(r.date, { day: 'numeric', month: 'short', year: 'numeric' }) },
    { key: 'asset', label: 'Item', sort: (r) => r.asset, render: (r) => <a href={`#/asset/${r.assetId}`}>{r.asset}</a> },
    { key: 'type', label: 'Type', sort: (r) => r.type, render: (r) => r.type },
    { key: 'desc', label: 'Work', sort: (r) => r.description, render: (r) => r.description },
    { key: 'by', label: 'Done by', sort: (r) => r.provider || 'Myself', render: (r) => r.provider || <span className="muted">Myself</span> },
    { key: 'cost', label: 'Cost', num: true, sort: (r) => r.cost, render: (r) => money(r.cost) },
    { key: 'x', label: 'Actions', render: (r) => <button type="button" className="btn btn-sm btn-ghost" aria-label={`Delete record ${r.description}`} onClick={() => window.confirm('Delete this record?') && setStore({ ...store, records: store.records.filter((x) => x.id !== r.id) })}>Delete</button> },
  ];
  const table = useTable(rows, columns, { initialSort: 'date', initialDir: 'desc', pageSize: 10 });
  return (
    <div className="stack">
      <PageHead eyebrow="Service log" title={<>Every job, <em>on record.</em></>} actions={<><button type="button" className="btn" disabled={!rows.length} onClick={() => downloadText('upkeep-service-log.csv', toCSV(['Date', 'Item', 'Type', 'Work', 'Done by', 'Cost'], rows.map((r) => [r.date, r.asset, r.type, r.description, r.provider, r.cost.toFixed(2)])), 'text/csv')}>Export CSV</button><a className="btn btn-primary" href="#/log">Log work</a></>} />
      <div className="card stack">
        <div className="filters">
          <Field label="Search" className="grow">{(p) => <input {...p} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Item, work or company" />}</Field>
          <Field label="Type">{(p) => <select {...p} value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{RECORD_TYPES.map((t) => <option key={t}>{t}</option>)}</select>}</Field>
          <Field label="Year">{(p) => <select {...p} value={year} onChange={(e) => setYear(e.target.value)}><option value="">All years</option>{years.map((y) => <option key={y}>{y}</option>)}</select>}</Field>
        </div>
        <DataTable caption="Service records" columns={columns} table={table} rowKey={(r) => r.id} empty="No records match these filters." />
        <p className="small"><strong>Total shown: {money(totalFor(rows, () => true))}</strong></p>
      </div>
    </div>
  );
}
