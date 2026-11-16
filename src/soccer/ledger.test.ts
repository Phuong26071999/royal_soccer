import { currentFund, fundTotals, matchCostTotal, matchShare, memberLedger, participantsOf } from './utils';
import { Fund, Match, Member, SoccerState } from './types';

const member = (id: string): Member => ({ id, name: id, number: null, tier: 3, goals: 0, avatar: '' });
const match = (over: Partial<Match> = {}): Match => ({ id: 'm1', date: '2026-11-20T19:30', location: 'Sân A', note: '', score: '', teams: [], ...over });
const fund = (over: Partial<Fund> = {}): Fund => ({
  id: 'f1', name: 'Quỹ A', startDate: '2026-11-01', status: 'open', fee: 100000, payments: {}, expenses: [], ...over,
});
const state = (matches: Match[], payments: Record<string, string[]> = {}, funds: Fund[] = [fund({ payments })]): SoccerState => ({
  version: 1,
  updatedAt: null,
  members: ['a', 'b', 'c', 'd'].map(member),
  funds,
  matches,
  venues: [],
});

describe('match attendance and cost split', () => {
  it('uses the explicit attendee list, else everyone placed in a team', () => {
    expect(participantsOf(match({ teams: [['a', 'b'], ['c']] })).sort()).toEqual(['a', 'b', 'c']);
    expect(participantsOf(match({ teams: [['a', 'b']], attendees: ['d'] }))).toEqual(['d']);
  });

  it('splits the total evenly between attendees', () => {
    const m = match({ attendees: ['a', 'b', 'c', 'd'], costs: [{ id: 'x', note: 'Sân', amount: 200000 }, { id: 'y', note: 'Nước', amount: 60000 }] });
    expect(matchCostTotal(m)).toBe(260000);
    expect(matchShare(m)).toBe(65000);
  });

  it('charges nothing without attendees or costs', () => {
    expect(matchShare(match({ attendees: [], costs: [{ id: 'x', note: '', amount: 1000 }] }))).toBe(0);
    expect(matchShare(match({ attendees: ['a'] }))).toBe(0);
  });

  it('deducts the share from the amount paid into the fund (100k paid, 65k match -> 35k left)', () => {
    const m = match({ attendees: ['a', 'b', 'c', 'd'], costs: [{ id: 'x', note: '', amount: 260000 }] });
    const ledger = memberLedger(state([m], { '2026-11': ['a'] }), 'a');
    expect(ledger.contributed).toBe(100000);
    expect(ledger.spent).toBe(65000);
    expect(ledger.balance).toBe(35000);
    expect(ledger.history).toHaveLength(1);
  });

  it('shows a negative balance for someone who has not paid, and ignores matches they skipped', () => {
    const m1 = match({ attendees: ['a', 'b'], costs: [{ id: 'x', note: '', amount: 100000 }] });
    const m2 = match({ id: 'm2', date: '2026-11-27T19:30', attendees: ['a'], costs: [{ id: 'y', note: '', amount: 40000 }] });
    const b = memberLedger(state([m1, m2]), 'b');
    expect(b.spent).toBe(50000);
    expect(b.balance).toBe(-50000);
    expect(b.history).toHaveLength(1);
    const a = memberLedger(state([m1, m2]), 'a');
    expect(a.history.map((e) => e.match.id)).toEqual(['m2', 'm1']);
  });

  it('adds up payments from every fund, with each fund\'s own fee', () => {
    const funds = [
      fund({ id: 'f1', fee: 100000, payments: { '2026-10': ['a'], '2026-11': ['a'] } }),
      fund({ id: 'f2', name: 'Quỹ B', startDate: '2026-12-01', status: 'closed', closedAt: '2026-12-31', fee: 50000, payments: { '2026-12': ['a', 'b'] } }),
    ];
    const ledger = memberLedger(state([], {}, funds), 'a');
    expect(ledger.contributed).toBe(250000);
    expect(ledger.paidMonths.map((p) => `${p.fund.id}:${p.month}`)).toEqual(['f2:2026-12', 'f1:2026-11', 'f1:2026-10']);
    expect(memberLedger(state([], {}, funds), 'b').contributed).toBe(50000);
  });
});

describe('funds', () => {
  it('picks the most recently started open fund as the current one', () => {
    const funds = [
      fund({ id: 'old', startDate: '2026-01-01' }),
      fund({ id: 'new', startDate: '2026-09-01' }),
      fund({ id: 'shut', startDate: '2026-11-01', status: 'closed', closedAt: '2026-11-30' }),
    ];
    expect(currentFund(state([], {}, funds))?.id).toBe('new');
    expect(currentFund(state([], {}, []))).toBeUndefined();
  });

  it('totals what a fund collected, spent and has left', () => {
    const f = fund({ fee: 100000, payments: { '2026-11': ['a', 'b'], '2026-12': ['a'] }, expenses: [{ id: 'e', date: '2026-11-05', note: 'Sân', amount: 120000 }] });
    expect(fundTotals(f)).toEqual({ paidCount: 3, totalIn: 300000, totalOut: 120000, balance: 180000 });
  });
});
