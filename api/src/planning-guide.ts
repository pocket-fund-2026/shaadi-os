// Original task wording, informed by the time-based approach in Brides and
// multi-event logistics in Marigold Events. Suggestions remain optional.
type GuideItem = readonly [key: string, title: string, daysBefore: number, phase: string, communities?: readonly string[]];
const HINDU = ['North Indian Hindu', 'South Indian', 'Bengali', 'Gujarati', 'Marathi', 'Jain'];
const SANGEET = ['North Indian Hindu', 'Gujarati', 'Punjabi/Sikh'];
export const GUIDE: readonly GuideItem[] = [
  ['priorities', 'Agree on your priorities together', 330, 'Foundations'],
  ['events', 'Choose the celebrations you want with both families', 330, 'Foundations'],
  ['guest_estimate', 'Estimate your guest count', 330, 'Foundations'],
  ['venue_visits', 'Visit venues and check capacity', 300, 'Foundations'],
  ['venue_rules', 'Ask venues about ceremony, fire, parking and vendor rules', 270, 'Venues'],
  ['event_guests', 'Estimate guest numbers for each celebration', 270, 'Guests'],
  ['catering', 'Compare caterers and plan a tasting', 270, 'Vendors'],
  ['photography', 'Shortlist photographers and videographers', 270, 'Vendors'],
  ['coverage', 'Agree which celebrations need photo and video coverage', 240, 'Vendors'],
  ['music', 'Choose music and entertainment', 240, 'Vendors'],
  ['design', 'Decide on colours and celebration style', 240, 'Design'],
  ['mandap', 'Plan mandap or ceremony decor with the venue', 210, 'Ceremony', HINDU],
  ['stay', 'Arrange guest accommodation if needed', 210, 'Guests'],
  ['outfits', 'Start shopping for wedding outfits', 210, 'Style'],
  ['invite_design', 'Plan invitation design and wording', 180, 'Guests'],
  ['officiant', 'Confirm your officiant and ceremony requirements', 180, 'Ceremony'],
  ['decor', 'Confirm flowers, decor and rentals', 150, 'Design'],
  ['mehndi', 'Confirm mehndi artists and timing if planned', 150, 'Style', ['North Indian Hindu', 'South Indian', 'Punjabi/Sikh', 'Muslim', 'Jain']],
  ['transport', 'Plan transport for guests and family', 120, 'Logistics'],
  ['family_roles', 'Agree who in the family coordinates each event', 90, 'Logistics'],
  ['menu', 'Confirm your menu and dietary options', 90, 'Vendors'],
  ['rings', 'Arrange wedding rings if you want them', 90, 'Style'],
  ['beauty_trial', 'Schedule hair and makeup trials', 75, 'Style'],
  ['event_invites', 'Check invitations and RSVPs for every celebration', 75, 'Guests'],
  ['baraat', 'Confirm baraat route, music and permissions if planned', 60, 'Ceremony', ['North Indian Hindu', 'Gujarati', 'Punjabi/Sikh', 'Jain']],
  ['ceremony', 'Review ceremony details with your officiant', 60, 'Ceremony'],
  ['ritual_items', 'Confirm ceremony items and who brings them', 30, 'Ceremony'],
  ['sangeet_music', 'Collect performance music and share it with your DJ', 30, 'Final details', SANGEET],
  ['rsvp', 'Follow up on invitations and RSVPs', 30, 'Guests'],
  ['seating', 'Draft seating and accessibility needs', 30, 'Guests'],
  ['run_sheet', 'Give family and vendors a schedule for each event', 21, 'Final details'],
  ['final_headcount', 'Give vendors your final guest count', 14, 'Final details'],
  ['timeline', 'Share the day-of timeline and contacts', 14, 'Final details'],
  ['final_fitting', 'Confirm outfit fittings and collection', 7, 'Final details'],
  ['emergency_kit', 'Pack a small day-of essentials kit', 7, 'Final details'],
  ['thanks', 'Thank guests and the people who helped you', -21, 'After the wedding'],
];

export function guideForWedding(date: string, tasks: { title: string }[], now = new Date(), community = '') {
  const today = now.toISOString().slice(0, 10);
  const weddingDay = new Date(date + 'T00:00:00Z').getTime();
  const existing = new Set(tasks.map(t => t.title.toLocaleLowerCase()));
  return GUIDE.filter(([, , , , communities]) => !communities || !community || communities.includes(community)).map(([key, title, daysBefore, phase]) => {
    const ideal = new Date(weddingDay - daysBefore * 864e5).toISOString().slice(0, 10);
    // A short engagement brings past milestones forward without marking them overdue immediately.
    const due = date >= today && ideal < today ? today : ideal;
    return { key, title, phase, due, already_added: existing.has(title.toLocaleLowerCase()), is_catch_up: ideal < today && date >= today };
  });
}
