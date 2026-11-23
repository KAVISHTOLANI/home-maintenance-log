import { describe, expect, it } from 'vitest';
import { ageInfo, dueState, nextDue, spendByCategory, spendByMonth, totalFor, upcoming, validateAsset, validateRecord, validateSchedule, type Asset, type Schedule, type ServiceRecord } from './upkeep';

const today = '2026-11-23';
const sched: Schedule = { id: 's1', assetId: 'a1', task: 'Replace filter', everyMonths: 3, firstDue: '2026-12-01' };
const rec = (p: Partial<ServiceRecord>): ServiceRecord => ({ id: 'r', assetId: 'a1', scheduleId: null, date: '2026-05-10', type: 'Maintenance', description: 'x', cost: 0, provider: '', ...p });
const asset = (p: Partial<Asset>): Asset => ({ id: 'a1', name: 'Furnace', category: 'Heating & cooling', location: '', brand: '', model: '', installed: '2016-11-23', lifespanYears: 20, ...p });

describe('schedules', () => {
  it('uses the first due date, then months after the last service', () => {
    expect(nextDue(sched, [])).toBe('2026-12-01');
    expect(nextDue(sched, [rec({ scheduleId: 's1', date: '2026-06-30' }), rec({ scheduleId: 's1', date: '2026-08-31' })])).toBe('2026-11-30');
  });
  it('classifies due states with a 30-day window', () => {
    expect(dueState('2026-11-20', today)).toBe('overdue');
    expect(dueState('2026-12-23', today)).toBe('soon');
    expect(dueState('2026-12-24', today)).toBe('ok');
  });
  it('sorts upcoming work by due date', () => {
    const s2 = { ...sched, id: 's2', firstDue: '2026-11-01' };
    expect(upcoming([sched, s2], [], today).map((u) => [u.schedule.id, u.state, u.days])).toEqual([['s2', 'overdue', -22], ['s1', 'soon', 8]]);
  });
});

describe('assets and costs', () => {
  it('reports age and lifespan used', () => {
    expect(ageInfo(asset({}), today)).toEqual({ years: 10, used: 0.5 });
    expect(ageInfo(asset({ installed: '' }), today)).toEqual({ years: null, used: null });
    expect(ageInfo(asset({ lifespanYears: null }), today).used).toBeNull();
  });
  it('totals spend by month for the last 12 months', () => {
    const m = spendByMonth([rec({ date: '2026-11-02', cost: 40.1 }), rec({ date: '2026-11-20', cost: 9.9 }), rec({ date: '2025-11-30', cost: 99 }), rec({ date: '2025-12-01', cost: 5 })], today);
    expect(m).toHaveLength(12);
    expect(m[0]).toEqual({ month: '2025-12', total: 5 });
    expect(m[11]).toEqual({ month: '2026-11', total: 50 });
  });
  it('totals spend by category within a range, largest first', () => {
    const assets = [asset({}), asset({ id: 'a2', category: 'Plumbing' })];
    const out = spendByCategory([rec({ cost: 100 }), rec({ assetId: 'a2', cost: 250 }), rec({ assetId: 'a2', cost: 1, date: '2025-01-01' })], assets, '2026-01-01', '2026-12-31');
    expect(out).toEqual([{ category: 'Plumbing', total: 250 }, { category: 'Heating & cooling', total: 100 }]);
    expect(totalFor([rec({ cost: 10.1 }), rec({ cost: 0.2 })], () => true)).toBe(10.3);
  });
});

describe('validation', () => {
  it('validates assets', () => {
    expect(validateAsset({ name: '', installed: '2030-01-01', lifespan: '0' }, today)).toEqual({ name: expect.any(String), installed: expect.any(String), lifespan: expect.any(String) });
    expect(validateAsset({ name: 'Boiler', installed: '', lifespan: '' }, today)).toEqual({});
  });
  it('validates schedules', () => {
    expect(Object.keys(validateSchedule({ task: '', every: '0', firstDue: 'x' }))).toEqual(['task', 'every', 'firstDue']);
  });
  it('validates service records', () => {
    expect(validateRecord({ assetId: '', date: '2026-12-01', description: '', cost: '-5' }, today)).toEqual({ assetId: expect.any(String), date: expect.stringMatching(/future/), description: expect.any(String), cost: expect.any(String) });
    expect(validateRecord({ assetId: 'a', date: today, description: 'Fixed', cost: '' }, today)).toEqual({});
  });
});
