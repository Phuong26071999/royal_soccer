export interface Club {
  id: string;
  name: string;
  crest: string;
  /** Primary kit colour: themes the player card. */
  color: string;
}

// Crests are hot-linked from football-data.org; a broken link just means no backdrop.
const crest = (n: number) => `https://crests.football-data.org/${n}.png`;

export const CLUBS: Club[] = [
  { id: 'man-utd', name: 'Manchester United', crest: crest(66), color: '#da291c' },
  { id: 'man-city', name: 'Manchester City', crest: crest(65), color: '#6cabdd' },
  { id: 'liverpool', name: 'Liverpool', crest: crest(64), color: '#c8102e' },
  { id: 'arsenal', name: 'Arsenal', crest: crest(57), color: '#ef0107' },
  { id: 'chelsea', name: 'Chelsea', crest: crest(61), color: '#034694' },
  { id: 'tottenham', name: 'Tottenham', crest: crest(73), color: '#1b2a6b' },
  { id: 'real-madrid', name: 'Real Madrid', crest: crest(86), color: '#d4a017' },
  { id: 'barcelona', name: 'Barcelona', crest: crest(81), color: '#a50044' },
  { id: 'atletico', name: 'Atlético Madrid', crest: crest(78), color: '#cb3524' },
  { id: 'bayern', name: 'Bayern Munich', crest: crest(5), color: '#dc052d' },
  { id: 'dortmund', name: 'Dortmund', crest: crest(4), color: '#e6b800' },
  { id: 'juventus', name: 'Juventus', crest: crest(109), color: '#161616' },
  { id: 'ac-milan', name: 'AC Milan', crest: crest(98), color: '#fb090b' },
  { id: 'inter', name: 'Inter Milan', crest: crest(108), color: '#0068a8' },
  { id: 'napoli', name: 'Napoli', crest: crest(113), color: '#12a0d7' },
  { id: 'psg', name: 'Paris Saint-Germain', crest: crest(524), color: '#004170' },
];

export const clubOf = (id?: string): Club | undefined => CLUBS.find((c) => c.id === id);

export const CUSTOM_CLUB = 'custom';

/** The crest + name to show for a member: a listed club, or their own custom one. */
export function crestOf(m: { club?: string; clubName?: string; clubLogo?: string }): { name: string; crest: string } | undefined {
  if (m.club === CUSTOM_CLUB) return m.clubLogo ? { name: m.clubName || 'Đội của mình', crest: m.clubLogo } : undefined;
  return clubOf(m.club);
}

export const DEFAULT_CARD_COLOR = '#1f7a4a';

/** Card theme colour: the listed club's kit colour, the member's own pick for a custom club, else the site green. */
export function clubColorOf(m: { club?: string; clubColor?: string }): string {
  if (m.club === CUSTOM_CLUB) return /^#[0-9a-f]{6}$/i.test(m.clubColor || '') ? (m.clubColor as string) : DEFAULT_CARD_COLOR;
  return clubOf(m.club)?.color || DEFAULT_CARD_COLOR;
}

/** Dark or white text, whichever reads better on the given hex colour. */
export function inkFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.6 ? '#10201a' : '#ffffff';
}
