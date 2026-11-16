export interface Member {
  id: string;
  name: string;
  /** Shirt number 0-99, null when not set. */
  number: number | null;
  /** 1 (D) to 5 (S). */
  tier: number;
  goals: number;
  /** https image URL or an uploaded photo (/api/soccer-avatar?...); initials when empty. */
  avatar: string;
  /** Favourite football club id (see clubs.ts); its crest shows faded behind the avatar. */
  club?: string;
  /** With club === 'custom': the member's own club (name + logo URL or uploaded logo). */
  clubName?: string;
  clubLogo?: string;
  /** With club === 'custom': #rrggbb colour that themes the player card. */
  clubColor?: string;
  /** Avatar frame: circle (default), rounded, square or hex. */
  avatarShape?: string;
  /** Six card attributes 1-99; when absent they are estimated from the rating. */
  stats?: PlayerStats;
}

export interface PlayerStats {
  pac: number; sho: number; pas: number; dri: number; def: number; phy: number;
}

export interface Expense {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  note: string;
  amount: number;
}

export interface Fund {
  id: string;
  /** Name of this collection ("Quỹ mùa đông 2026"). */
  name: string;
  /** YYYY-MM-DD the fund applies from. */
  startDate: string;
  /** Closed funds are read-only and shown in the history. */
  status: 'open' | 'closed';
  /** YYYY-MM-DD, only for closed funds. */
  closedAt?: string;
  /** Monthly fee per member, in VND. */
  fee: number;
  /** "YYYY-MM" -> ids of members who paid that month. */
  payments: Record<string, string[]>;
  expenses: Expense[];
}

export interface Match {
  id: string;
  /** Local date-time string, e.g. 2026-11-20T19:30 */
  date: string;
  location: string;
  note: string;
  score: string;
  /** Member ids per team (empty until teams are saved). */
  teams: string[][];
  /** Members who actually played. When absent, everyone placed in a team counts. */
  attendees?: string[];
  /** Costs of this session (pitch, water...); split evenly between the attendees. */
  costs?: MatchCost[];
}

export interface MatchCost {
  id: string;
  note: string;
  amount: number;
}

export interface SoccerState {
  version: number;
  updatedAt: string | null;
  members: Member[];
  funds: Fund[];
  matches: Match[];
}
