import { one, q } from './db.ts';

// Checkpoints describe saved planning work, not a guarantee of wedding readiness.
export function weddingJourney(w: any) {
  const count = (sql: string) => Number(one(sql, w.id).n);
  const events = q('SELECT date,venue FROM events WHERE wedding_id=?', w.id);
  const guests = count('SELECT COUNT(*) n FROM guests WHERE wedding_id=?');
  const waiting = count("SELECT COUNT(*) n FROM guests WHERE wedding_id=? AND rsvp='pending'");
  const vendors = count("SELECT COUNT(DISTINCT vendor_id) n FROM (SELECT vendor_id FROM bookings WHERE wedding_id=? AND status!='cancelled')");
  const chosen = count('SELECT COUNT(*) n FROM shortlist WHERE wedding_id=? AND chosen=1');
  const runs = count('SELECT COUNT(*) n FROM run_items WHERE wedding_id=?');
  const contacts = count('SELECT COUNT(*) n FROM day_contacts WHERE wedding_id=?');
  const tasks = q('SELECT done,due,owner,priority FROM tasks WHERE wedding_id=?', w.id);
  const open = tasks.filter(t => !t.done);
  const after = tasks.filter(t => t.due && t.due > w.date);
  const gifts = count('SELECT COUNT(*) n FROM gifts WHERE wedding_id=?');
  const thanks = count('SELECT COUNT(*) n FROM gifts WHERE wedding_id=? AND thanked=1');
  const docs = count('SELECT COUNT(*) n FROM documents WHERE wedding_id=? AND done=1');
  const check = (key: string, title: string, done: boolean, detail: string, tab: string) => ({ key, title, done, detail, tab });
  const phases = [
    { key: 'foundations', title: 'Set the foundations', description: 'Agree your date, spending limit and celebrations.', checks: [
      check('details', 'Wedding details', !!(w.date && w.city && w.title), `${w.city} · ${w.date}`, 'settings'),
      check('budget', 'Budget set', w.budget_paise > 0, 'Review allocations and leave a buffer.', 'budget'),
      check('ceremonies', 'Ceremony dates and venues', events.length > 0 && events.every(e => e.date && e.venue?.trim()), `${events.filter(e => e.date && e.venue?.trim()).length} of ${events.length} celebrations have both.`, 'events'),
    ] },
    { key: 'bookings', title: 'Build your wedding team', description: 'Choose suppliers and give everyone a clear responsibility.', checks: [
      check('vendors', 'Record your first vendor booking', vendors + chosen > 0, `${vendors + chosen} booking records or chosen vendors. Review the vendor tracker for coverage.`, 'shortlist'),
      check('owners', 'Assign open checklist tasks', tasks.length > 0 && open.every(t => t.owner.trim()), `${open.filter(t => !t.owner.trim()).length} open tasks need a responsible person.`, 'checklist'),
    ] },
    { key: 'guests', title: 'Welcome your guests', description: 'Invitations, replies and travel plans belong together.', checks: [
      check('guest-list', 'Guest list started', guests > 0, `${guests} households recorded.`, 'guests'),
      check('website', 'Wedding website published', !!one('SELECT 1 x FROM invites WHERE wedding_id=?', w.id), 'Share ceremony details from your wedding website.', 'invite'),
      check('rsvp', 'All recorded households replied', guests > 0 && waiting === 0, `${waiting} households still need a reply. Review stays and transport for travellers.`, 'guests'),
    ] },
    { key: 'details', title: 'Bring the details together', description: 'Keep food, outfits and the guest experience in one place.', checks: [
      check('menu', 'Menu started', count('SELECT COUNT(*) n FROM menu_items WHERE wedding_id=?') > 0, 'Plan ceremony menus and dietary choices.', 'menu'),
      check('shopping', 'Shopping list started', count('SELECT COUNT(*) n FROM shopping WHERE wedding_id=?') > 0, 'Track outfits, jewellery and who is buying each item.', 'shopping'),
      check('travel', 'Guest logistics reviewed', count('SELECT COUNT(*) n FROM stays WHERE wedding_id=?') > 0 || count('SELECT COUNT(*) n FROM vehicles WHERE wedding_id=?') > 0, 'Add stays or vehicles when travel is needed; this checkpoint may not apply.', 'stays'),
    ] },
    { key: 'day', title: 'Run the wedding day', description: 'Hand over timings and contacts so you can enjoy the celebrations.', checks: [
      check('run-sheet', 'Run sheet started', runs > 0, `${runs} timings recorded. Check each ceremony before sharing.`, 'run'),
      check('contacts', 'Day contacts added', contacts > 0, `${contacts} manually added contacts. Confirm arrival times and phone numbers.`, 'contacts'),
      check('urgent', 'High priority tasks cleared', tasks.length > 0 && !open.some(t => t.priority === 'high'), `${open.filter(t => t.priority === 'high').length} high priority tasks remain.`, 'checklist'),
    ] },
    { key: 'after', title: 'After the celebrations', description: 'Close the loop on thank-you notes, paperwork and remaining jobs.', checks: [
      check('thanks', 'Thank recorded gift givers', gifts > 0 && thanks === gifts, `${thanks} of ${gifts} recorded gifts thanked.`, 'shagun'),
      check('documents', 'Registration papers started', docs > 0, `${docs} document items checked. Confirm local requirements in Documents.`, 'documents'),
      check('after-tasks', 'Complete tasks after the wedding', after.length > 0 && after.every(t => t.done), `${after.filter(t => t.done).length} of ${after.length} tasks dated after the wedding completed.`, 'checklist'),
    ] },
  ];
  return { phases, done: phases.flatMap(p => p.checks).filter(c => c.done).length, total: phases.flatMap(p => p.checks).length };
}
