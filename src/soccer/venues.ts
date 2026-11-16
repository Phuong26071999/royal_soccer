import { SoccerState, Venue } from './types';

/** Pitches the group usually plays at; picked in the "Tạo lịch đá" form. */
export const VENUES: Venue[] = [
  {
    id: 'hoang-kim',
    name: 'Sân Bóng Hoàng Kim',
    address: '615 Huỳnh Tấn Phát, Tân Thuận, Hồ Chí Minh',
    mapUrl: 'https://www.google.com/maps/place/s%C3%A2n+b%C3%B3ng+%C4%91%C3%A1+ho%C3%A0ng+kim/data=!4m2!3m1!1s0x317525861819c111:0xee9f7d374586e2cf?sa=X&ved=1t:242&ictx=111',
  },
  {
    id: 'd7-sports-park',
    name: 'D7 Sports Park',
    address: '7b Tân Phú, Khu đô thị Phú Mỹ Hưng, Tân Mỹ, Hồ Chí Minh',
    mapUrl: 'https://www.google.com/maps/place/D7+Sports+Park/@10.7317864,106.7267681,277m/data=!3m1!1e3!4m6!3m5!1s0x3175252c279ea0c9:0xb0e280d96e6f6ebe!8m2!3d10.7317565!4d106.7273984!16s%2Fg%2F11sw_7q162?entry=ttu&g_ep=EgoyMDI2MTExMC4wIKXMDSoASAFQAw%3D%3D',
  },
];

export const isPreset = (id: string) => VENUES.some((v) => v.id === id);

/**
 * Built-in pitches first, then the ones the group added. An entry in state.venues with a built-in id
 * overrides that pitch (that is how a built-in pitch gets edited); removing the entry restores the default.
 */
export const allVenues = (state: Pick<SoccerState, 'venues'>): Venue[] => {
  const saved = state.venues || [];
  return [
    ...VENUES.map((preset) => saved.find((v) => v.id === preset.id) || preset),
    ...saved.filter((v) => !isPreset(v.id)),
  ];
};
