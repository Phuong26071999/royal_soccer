import React, { useEffect, useState } from 'react';
import { Member } from '../types';
import { avatarColor, initials } from '../utils';
import { crestOf } from '../clubs';

interface Props {
  member: Pick<Member, 'id' | 'name' | 'avatar'>;
  size?: number;
}

/** Photo when an avatar URL is set (and loads), otherwise coloured initials. */
const Avatar = ({ member, size = 48 }: Props) => {
  const [broken, setBroken] = useState(false);
  // A new photo gets a fresh chance to load.
  useEffect(() => setBroken(false), [member.avatar]);
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (member.avatar && !broken) {
    return <img className="sc-avatar" src={member.avatar} alt="" style={style} loading="lazy" onError={() => setBroken(true)} />;
  }
  return (
    <span className="sc-avatar" style={{ ...style, background: avatarColor(member.id) }} aria-hidden="true">
      {initials(member.name)}
    </span>
  );
};

/** Faded crest of the member's favourite club; render it first inside a positioned parent, the avatar sits on top. */
export const ClubBackdrop = ({ club, name, logo }: { club?: string; name?: string; logo?: string }) => {
  const c = crestOf({ club, clubName: name, clubLogo: logo });
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [club, logo]);
  if (!c || broken) return null;
  return <img className="sc-club-bg" src={c.crest} alt="" aria-hidden="true" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
};

export default Avatar;
