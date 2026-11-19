import React, { useMemo, useState } from 'react';
import { Member, SoccerState } from '../types';
import { TIERS, currentFund, monthKey, participantsOf, ratingOf, slugify, uniqueId } from '../utils';
import Avatar, { ClubBackdrop } from './Avatar';
import PlayerCard from './PlayerCard';
import CardStylePicker from './CardStylePicker';
import { useCardStyle } from '../cardStyle';
import PodiumFigure from './PodiumFigure';
import TeamPhoto from './TeamPhoto';

interface Props {
  state: SoccerState;
  isAdmin: boolean;
  onOpen: (member: Member) => void;
  onAdd: (member: Member) => void;
}

type SortKey = 'number' | 'name' | 'tier' | 'goals';

const MembersTab = ({ state, isAdmin, onOpen, onAdd }: Props) => {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('number');
  const [newName, setNewName] = useState('');
  const [cardStyle] = useCardStyle();
  const paidNow = new Set((currentFund(state)?.payments[monthKey()]) || []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = state.members.filter((m) => m.name.toLowerCase().includes(q) || String(m.number ?? '') === q);
    const byName = (a: Member, b: Member) => a.name.localeCompare(b.name, 'vi');
    const by: Record<SortKey, (a: Member, b: Member) => number> = {
      // Players without a number go last.
      number: (a, b) => (a.number ?? 1000) - (b.number ?? 1000) || byName(a, b),
      name: byName,
      tier: (a, b) => b.tier - a.tier || byName(a, b),
      goals: (a, b) => b.goals - a.goals || byName(a, b),
    };
    return [...filtered].sort(by[sort]);
  }, [state.members, query, sort]);

  const topScorers = [...state.members].filter((m) => m.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 3);

  const addMember = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const id = uniqueId(slugify(name), new Set(state.members.map((m) => m.id)));
    onAdd({ id, name, number: null, tier: 3, goals: 0, avatar: '', club: '' });
    setNewName('');
  };

  return (
    <section aria-label="Thành viên">
      <TeamPhoto count={state.members.length} />
      {topScorers.length > 0 && (
        <div className="sc-scorers">
          <h3><i className="bx bx-trophy" aria-hidden="true"></i> Vua phá lưới</h3>
          <div className="sc-podium" role="list">
            {[1, 0, 2].filter((i) => topScorers[i]).map((i) => {
              const m = topScorers[i];
              return (
                <div key={m.id} role="listitem" className={`sc-podium-slot p${i + 1}`}>
                  <div className="sc-figure">
                    <span className="sc-head"><Avatar member={m} size={64} /></span>
                    <PodiumFigure rank={(i + 1) as 1 | 2 | 3} />
                  </div>
                  <div className="sc-step">
                    <span className="sc-medal">{i + 1}</span>
                    <span className="sc-podium-name">{m.name}</span>
                    <b>{m.goals}<small> bàn</small></b>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="sc-toolbar">
        <CardStylePicker />
        <label className="sc-search">
          <i className="bx bx-search" aria-hidden="true"></i>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tên hoặc số áo" aria-label="Tìm tên hoặc số áo" />
        </label>
        <label className="sc-select">
          <span>Sắp xếp</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="number">Số áo</option>
            <option value="name">Tên</option>
            <option value="tier">Tier cao nhất</option>
            <option value="goals">Nhiều bàn nhất</option>
          </select>
        </label>
      </div>

      <div className={`sc-members ${cardStyle}`}>
        {list.map((m) => {
          const paid = paidNow.has(m.id);
          const matches = state.matches.filter((x) => participantsOf(x).includes(m.id)).length;
          const label = `${m.name}${m.number !== null ? `, số áo ${m.number}` : ''}, tier ${TIERS[m.tier].label}, ${m.goals} bàn, ${paid ? 'đã đóng quỹ' : 'chưa đóng quỹ'}`;
          if (cardStyle !== 'compact') {
            return (
              <button key={m.id} type="button" className="sc-member sc-member-card" onClick={() => onOpen(m)} aria-label={label}>
                <PlayerCard member={m} matches={matches} variant={cardStyle} />
                <span className={`sc-paid-flag${paid ? ' yes' : ''}`}>
                  <i className={`bx ${paid ? 'bx-check-circle' : 'bx-time-five'}`} aria-hidden="true"></i>{paid ? 'Đã đóng quỹ' : 'Chưa đóng'}
                </span>
              </button>
            );
          }
          return (
            <button key={m.id} type="button" className="sc-member" onClick={() => onOpen(m)} aria-label={label}>
              <span className="sc-card-top">
                <span className={`sc-rating t${m.tier}`}><b>{TIERS[m.tier].label}</b><small>{TIERS[m.tier].name} · {ratingOf(m)}</small></span>
                <span className={`sc-shirt${m.number === null ? ' empty' : ''}`} title="Số áo">{m.number ?? '--'}</span>
              </span>
              <span className="sc-card-avatar"><ClubBackdrop club={m.club} logo={m.clubLogo} /><Avatar member={m} size={72} /></span>
              <span className="sc-card-name">{m.name}</span>
              <span className="sc-card-stats">
                <span title="Số bàn thắng"><i className="bx bx-football" aria-hidden="true"></i><b>{m.goals}</b> bàn</span>
                <span className={`sc-paid${paid ? ' yes' : ''}`}>
                  <i className={`bx ${paid ? 'bx-check-circle' : 'bx-time-five'}`} aria-hidden="true"></i>
                  {paid ? 'Đã đóng quỹ' : 'Chưa đóng'}
                </span>
              </span>
            </button>
          );
        })}
        {list.length === 0 && <p className="sc-empty">Không tìm thấy thành viên nào.</p>}
      </div>

      {isAdmin && (
        <form className="sc-inline-form" onSubmit={addMember}>
          <label htmlFor="sc-new-member">Thêm thành viên</label>
          <div>
            <input id="sc-new-member" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} placeholder="Tên thành viên mới" />
            <button type="submit" className="sc-btn" disabled={!newName.trim()}>Thêm</button>
          </div>
        </form>
      )}
    </section>
  );
};

export default MembersTab;
