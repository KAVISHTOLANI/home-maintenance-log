import { addMonths, daysBetween, isValidISODate } from '../shared/dates';

export const CATEGORIES = ['Heating & cooling', 'Plumbing', 'Electrical', 'Appliance', 'Exterior', 'Safety'] as const;
export type Category = (typeof CATEGORIES)[number];
export const RECORD_TYPES = ['Maintenance', 'Repair', 'Inspection', 'Replacement'] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export interface Asset {
  id: string;
  name: string;
  category: Category;
  location: string;
  brand: string;
  model: string;
  installed: string; // '' if unknown
  lifespanYears: number | null;
  demo?: boolean;
}

export interface Schedule {
  id: string;
  assetId: string;
  task: string;
  everyMonths: number;
  /** Used as the due date until the task has been logged once. */
  firstDue: string;
}

export interface ServiceRecord {
  id: string;
  assetId: string;
  scheduleId: string | null;
  date: string;
  type: RecordType;
  description: string;
  cost: number;
  provider: string; // '' = did it yourself
}

export function lastServiced(records: ServiceRecord[], scheduleId: string): string | null {
  let last: string | null = null;
  for (const r of records) if (r.scheduleId === scheduleId && (!last || r.date > last)) last = r.date;
  return last;
}

export function nextDue(s: Schedule, records: ServiceRecord[]): string {
  const last = lastServiced(records, s.id);
  return last ? addMonths(last, s.everyMonths) : s.firstDue;
}

export type DueState = 'overdue' | 'soon' | 'ok';
export function dueState(due: string, today: string, soonDays = 30): DueState {
  const d = daysBetween(today, due);
  return d < 0 ? 'overdue' : d <= soonDays ? 'soon' : 'ok';
}

export function upcoming(schedules: Schedule[], records: ServiceRecord[], today: string, soonDays = 30) {
  return schedules
    .map((s) => { const due = nextDue(s, records); return { schedule: s, due, state: dueState(due, today, soonDays), days: daysBetween(today, due) }; })
    .sort((a, b) => a.due.localeCompare(b.due));
}

/** Age in whole years (one decimal) and the share of the expected lifespan used. */
export function ageInfo(a: Asset, today: string) {
  if (!a.installed) return { years: null as number | null, used: null as number | null };
  const years = Math.round((daysBetween(a.installed, today) / 365.25) * 10) / 10;
  return { years, used: a.lifespanYears ? years / a.lifespanYears : null };
}

export const money = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

/** Spend per calendar month for the 12 months ending with the current month. */
export function spendByMonth(records: ServiceRecord[], today: string, months = 12) {
  const out: { month: string; total: number }[] = [];
  for (let i = months - 1; i >= 0; i--) out.push({ month: addMonths(`${today.slice(0, 7)}-01`, -i).slice(0, 7), total: 0 });
  for (const r of records) {
    const m = out.find((o) => o.month === r.date.slice(0, 7));
    if (m) m.total = Math.round((m.total + r.cost) * 100) / 100;
  }
  return out;
}

export function spendByCategory(records: ServiceRecord[], assets: Asset[], from: string, to: string) {
  const totals = new Map<Category, number>(CATEGORIES.map((c) => [c, 0]));
  for (const r of records) {
    if (r.date < from || r.date > to) continue;
    const a = assets.find((x) => x.id === r.assetId);
    if (a) totals.set(a.category, Math.round(((totals.get(a.category) ?? 0) + r.cost) * 100) / 100);
  }
  return CATEGORIES.map((c) => ({ category: c, total: totals.get(c)! })).filter((x) => x.total > 0).sort((a, b) => b.total - a.total);
}

export function totalFor(records: ServiceRecord[], filter: (r: ServiceRecord) => boolean) {
  return Math.round(records.filter(filter).reduce((s, r) => s + r.cost, 0) * 100) / 100;
}

type E<K extends string> = Partial<Record<K, string>>;

export function validateAsset(d: { name: string; installed: string; lifespan: string }, today: string): E<'name' | 'installed' | 'lifespan'> {
  const e: E<'name' | 'installed' | 'lifespan'> = {};
  if (!d.name.trim()) e.name = 'Name the appliance or system.';
  if (d.installed && (!isValidISODate(d.installed) || d.installed > today)) e.installed = 'Install date can’t be in the future.';
  if (d.lifespan.trim()) {
    const n = Number(d.lifespan);
    if (!Number.isFinite(n) || n <= 0 || n > 100) e.lifespan = 'Expected lifespan must be between 1 and 100 years.';
  }
  return e;
}

export function validateSchedule(d: { task: string; every: string; firstDue: string }): E<'task' | 'every' | 'firstDue'> {
  const e: E<'task' | 'every' | 'firstDue'> = {};
  if (!d.task.trim()) e.task = 'Describe the maintenance task.';
  const n = Number(d.every);
  if (!Number.isInteger(n) || n < 1 || n > 240) e.every = 'Use 1–240 months.';
  if (!isValidISODate(d.firstDue)) e.firstDue = 'Enter when it’s first due.';
  return e;
}

export function validateRecord(d: { assetId: string; date: string; description: string; cost: string }, today: string): E<'assetId' | 'date' | 'description' | 'cost'> {
  const e: E<'assetId' | 'date' | 'description' | 'cost'> = {};
  if (!d.assetId) e.assetId = 'Choose what was serviced.';
  if (!isValidISODate(d.date)) e.date = 'Enter the date.';
  else if (d.date > today) e.date = 'Log work after it’s done — the date can’t be in the future.';
  if (!d.description.trim()) e.description = 'Describe the work.';
  const c = d.cost.trim() === '' ? 0 : Number(d.cost);
  if (!Number.isFinite(c) || c < 0) e.cost = 'Cost must be 0 or more.';
  return e;
}
