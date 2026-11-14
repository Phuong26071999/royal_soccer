export interface Club {
  id: string;
  name: string;
  crest: string;
}

// Crests are hot-linked from football-data.org; a broken link just means no backdrop.
const crest = (n: number) => `https://crests.football-data.org/${n}.png`;

export const CLUBS: Club[] = [
  { id: 'man-utd', name: 'Manchester United', crest: crest(66) },
  { id: 'man-city', name: 'Manchester City', crest: crest(65) },
  { id: 'liverpool', name: 'Liverpool', crest: crest(64) },
  { id: 'arsenal', name: 'Arsenal', crest: crest(57) },
  { id: 'chelsea', name: 'Chelsea', crest: crest(61) },
  { id: 'tottenham', name: 'Tottenham', crest: crest(73) },
  { id: 'real-madrid', name: 'Real Madrid', crest: crest(86) },
  { id: 'barcelona', name: 'Barcelona', crest: crest(81) },
  { id: 'atletico', name: 'Atlético Madrid', crest: crest(78) },
  { id: 'bayern', name: 'Bayern Munich', crest: crest(5) },
  { id: 'dortmund', name: 'Dortmund', crest: crest(4) },
  { id: 'juventus', name: 'Juventus', crest: crest(109) },
  { id: 'ac-milan', name: 'AC Milan', crest: crest(98) },
  { id: 'inter', name: 'Inter Milan', crest: crest(108) },
  { id: 'napoli', name: 'Napoli', crest: crest(113) },
  { id: 'psg', name: 'Paris Saint-Germain', crest: crest(524) },
];

export const clubOf = (id?: string): Club | undefined => CLUBS.find((c) => c.id === id);

export const CUSTOM_CLUB = 'custom';

/** The crest + name to show for a member: a listed club, or their own custom one. */
export function crestOf(m: { club?: string; clubName?: string; clubLogo?: string }): { name: string; crest: string } | undefined {
  if (m.club === CUSTOM_CLUB) return m.clubLogo ? { name: m.clubName || 'Đội của mình', crest: m.clubLogo } : undefined;
  return clubOf(m.club);
}
