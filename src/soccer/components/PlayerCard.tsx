import React from 'react';
import { Member } from '../types';
import { STAT_KEYS, STAT_LABELS, TIERS, ratingOf, statsOf } from '../utils';
import { clubColorOf, crestOf, inkFor } from '../clubs';
import { CardStyle } from '../cardStyle';
import Avatar, { ClubBackdrop } from './Avatar';

export type CardMember = Pick<Member, 'id' | 'name' | 'number' | 'tier' | 'goals' | 'avatar' | 'club' | 'clubName' | 'clubLogo' | 'clubColor' | 'stats'>;

interface Props {
  member: CardMember;
  matches: number;
  variant?: Exclude<CardStyle, 'compact'>;
}

/** "Song Toàn" -> small "Song", big "TOÀN" (Vietnamese given name is the last word). */
function splitName(name: string): [string, string] {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? [parts.slice(0, -1).join(' '), parts[parts.length - 1]] : ['', parts[0] || ''];
}

const SHORT: Record<(typeof STAT_KEYS)[number], string> = { pac: 'TỐC', sho: 'SÚT', pas: 'CHU', dri: 'RÊ', def: 'THỦ', phy: 'LỰC' };

/** Player card in one of three looks, all themed by the favourite club's colour. */
const PlayerCard = ({ member, matches, variant = 'ultimate' }: Props) => {
  const color = clubColorOf(member);
  const club = crestOf(member);
  const rating = ratingOf(member);
  const [first, last] = splitName(member.name);
  const style = { '--cc': color, '--ci': inkFor(color) } as React.CSSProperties;
  const label = `${member.name}, rating ${rating}, tier ${TIERS[member.tier].label}, ${member.goals} bàn, ${matches} trận`;

  if (variant === 'ultimate') {
    const stats = statsOf(member);
    return (
      <div className="sc-ucard" style={style} role="img" aria-label={label}>
        <div className="sc-ucard-in">
          <div className="sc-ucard-mark" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <span key={i}>{(club?.name || last).toUpperCase().slice(0, 8)}</span>)}</div>
          <div className="sc-ucard-head">
            <div className="sc-ucard-id">
              <b title={TIERS[member.tier].name}>{TIERS[member.tier].label}</b>
              <span title="Rating">{rating}</span>
              {club ? <img src={club.crest} alt="" referrerPolicy="no-referrer" /> : <i className="bx bx-shield-quarter" aria-hidden="true"></i>}
              <em>{member.number ?? '--'}</em>
            </div>
            <div className="sc-ucard-photo"><Avatar member={member} size={112} /></div>
          </div>
          <div className="sc-ucard-name">{member.name}</div>
          <div className="sc-ucard-stats">
            {STAT_KEYS.map((k) => <div key={k} title={STAT_LABELS[k]}><b>{stats[k]}</b><span>{SHORT[k]}</span></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'legacy') {
    return (
      <div className="sc-lcard" style={style} role="img" aria-label={label}>
       <div className="sc-lcard-in">
        <div className="sc-lcard-art">
          <ClubBackdrop club={member.club} name={member.clubName} logo={member.clubLogo} />
          <Avatar member={member} size={132} />
        </div>
        {member.number !== null && <div className="sc-lcard-no">{member.number}</div>}
        <div className="sc-lcard-name">{last}</div>
        <div className="sc-lcard-foot">
          <b title={TIERS[member.tier].name}>{TIERS[member.tier].label}</b>
          <span>{[first, club?.name].filter(Boolean).join(' · ') || TIERS[member.tier].name}</span>
          <em title="Rating">{rating}</em>
        </div>
       </div>
      </div>
    );
  }

  return (
    <div className="sc-pcard" style={style} role="img" aria-label={label}>
      <div className="sc-pcard-frame">
        <div className="sc-pcard-photo">
          <ClubBackdrop club={member.club} name={member.clubName} logo={member.clubLogo} />
          <Avatar member={member} size={104} />
        </div>
        <div className="sc-pcard-side">
          <span className="sc-pcard-tag">{TIERS[member.tier].name}</span>
          <div className="sc-pcard-stat"><b>{member.goals}</b><small>Bàn thắng</small></div>
          <div className="sc-pcard-stat"><b>{matches}</b><small>Trận</small></div>
          <div className="sc-pcard-stat"><b>{member.number ?? '--'}</b><small>Số áo</small></div>
          <div className="sc-pcard-stat star"><i className="bx bxs-star" aria-hidden="true"></i><b>{rating}</b><small>Rating</small></div>
        </div>
      </div>
      <div className="sc-pcard-bar">
        {club && <img className="sc-pcard-crest" src={club.crest} alt="" referrerPolicy="no-referrer" />}
        <div className="sc-pcard-name">{first && <small>{first}</small>}<b>{last}</b></div>
        <span className="sc-pcard-tier">{TIERS[member.tier].label}</span>
      </div>
    </div>
  );
};

export default PlayerCard;
