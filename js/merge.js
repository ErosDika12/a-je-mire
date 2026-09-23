// Bashkimi i dy profileve (import ose kopje nga cloud) pa humbur asgjë në heshtje.
// Kur e njëjta datë ka vlera të ndryshme në të dy anët, nuk zgjedh kodi: kthehet si konflikt
// dhe përdoruesi vendos. Deri atëherë mbahet versioni lokal.

import { migrate } from './storage.js';

function sameEntry(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

// Gjen datat ku dy anët nuk përputhen. Nuk ndryshon asgjë.
export function findConflicts(local, incoming) {
  const localByDate = new Map(local.checkins.map(entry => [entry.date, entry]));
  const conflicts = [];
  for (const entry of incoming.checkins) {
    const mine = localByDate.get(entry.date);
    if (mine && !sameEntry(mine, entry)) conflicts.push({ date: entry.date, local: mine, incoming: entry });
  }
  return conflicts;
}

/**
 * resolutions: { 'VVVV-MM-DD': 'local' | 'incoming' } për çdo konflikt.
 * Kthen { profile, summary } ku summary numëron çfarë ndodhi, që ta shohë përdoruesi.
 */
export function mergeProfiles(local, incoming, resolutions = {}) {
  const byDate = new Map(local.checkins.map(entry => [entry.date, entry]));
  const summary = { added: 0, identical: 0, keptLocal: 0, tookIncoming: 0, people: 0, connections: 0 };

  for (const entry of incoming.checkins) {
    const mine = byDate.get(entry.date);
    if (!mine) {
      byDate.set(entry.date, entry);
      summary.added += 1;
    } else if (sameEntry(mine, entry)) {
      summary.identical += 1;
    } else if (resolutions[entry.date] === 'incoming') {
      byDate.set(entry.date, entry);
      summary.tookIncoming += 1;
    } else {
      summary.keptLocal += 1;
    }
  }

  // MY 5: njerëzit identifikohen me emër. Nuk kalohet kurrë kufiri prej pesë.
  const people = [...(local.my5 || [])];
  for (const person of incoming.my5 || []) {
    if (people.length >= 5) break;
    if (!people.some(item => item.name.toLowerCase() === person.name.toLowerCase())) {
      people.push(person);
      summary.people += 1;
    }
  }

  const connectionKey = item => `${item.date}|${item.personName}|${item.activityKey}`;
  const connections = [...(local.connections || [])];
  const seen = new Set(connections.map(connectionKey));
  for (const item of incoming.connections || []) {
    if (!seen.has(connectionKey(item))) {
      connections.push(item);
      seen.add(connectionKey(item));
      summary.connections += 1;
    }
  }

  const merged = migrate({
    ...local,
    checkins: [...byDate.values()],
    my5: people,
    connections,
    dismissed: [...(local.dismissed || []), ...(incoming.dismissed || [])],
    // Nëse njëra anë ka të dhëna reale, profili i bashkuar nuk është më demo.
    mode: local.mode === 'private' || incoming.mode === 'private' ? 'private' : 'demo'
  });
  return { profile: merged, summary };
}
