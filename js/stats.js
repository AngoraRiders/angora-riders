import { state } from './core.js';

export const LEVELS = {
  active:  { label: 'Aktif',  cls: 'lv-active' },
  mid:     { label: 'Orta',   cls: 'lv-mid' },
  passive: { label: 'Pasif',  cls: 'lv-passive' },
  new:     { label: 'Veri yok', cls: 'lv-new' },
};

export function levelOf(rate, eligible) {
  const s = state.settings;
  if (!eligible) return 'new';
  if (rate >= s.active_threshold) return 'active';
  if (rate < s.passive_threshold) return 'passive';
  return 'mid';
}

export const levelBadge = (lv) => `<span class="lv ${LEVELS[lv].cls}"><i></i>${LEVELS[lv].label}</span>`;

const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };

/**
 * Üye bazında aktiflik istatistikleri.
 * Sadece tarihi geçmiş etkinlikler ve üyenin katılım tarihinden sonraki etkinlikler hesaba katılır.
 */
export function computeStats({ members, events, attendance, from = null, to = null }) {
  const now = Date.now();
  const inRange = events.filter(e => {
    const t = new Date(e.start_at).getTime();
    return t <= now && (!from || t >= from.getTime()) && (!to || t < to.getTime());
  });
  const eventById = new Map(events.map(e => [e.id, e]));
  const byEvent = new Map();
  const byMember = new Map();
  for (const a of attendance) {
    if (!byEvent.has(a.event_id)) byEvent.set(a.event_id, new Set());
    byEvent.get(a.event_id).add(a.member_id);
    if (!byMember.has(a.member_id)) byMember.set(a.member_id, new Set());
    byMember.get(a.member_id).add(a.event_id);
  }

  const rows = members.map(m => {
    const joinT = m.join_date ? dayStart(m.join_date) : 0;
    const mine = byMember.get(m.id) || new Set();
    let eligible = 0, attended = 0, km = 0;
    for (const e of inRange) {
      const went = mine.has(e.id);
      if (dayStart(e.start_at) >= joinT || went) eligible++;
      if (went) { attended++; km += Number(e.distance_km) || 0; }
    }
    let last = null;
    for (const id of mine) {
      const e = eventById.get(id);
      if (e && new Date(e.start_at).getTime() <= now && (!last || e.start_at > last)) last = e.start_at;
    }
    const rate = eligible ? Math.round((attended / eligible) * 100) : 0;
    return { member: m, eligible, attended, rate, km: Math.round(km), last, level: levelOf(rate, eligible) };
  });

  const eventRows = inRange.map(e => {
    const count = (byEvent.get(e.id) || new Set()).size;
    const eligibleMembers = members.filter(m => m.status === 'active' && (!m.join_date || dayStart(m.join_date) <= dayStart(e.start_at))).length;
    return { event: e, count, rate: eligibleMembers ? Math.round((count / eligibleMembers) * 100) : 0 };
  }).sort((a, b) => b.event.start_at.localeCompare(a.event.start_at));

  const totalAtt = eventRows.reduce((s, r) => s + r.count, 0);
  const activeMembers = rows.filter(r => r.member.status === 'active');
  const avgRate = activeMembers.filter(r => r.eligible).length
    ? Math.round(activeMembers.filter(r => r.eligible).reduce((s, r) => s + r.rate, 0) / activeMembers.filter(r => r.eligible).length)
    : 0;

  return {
    rows, eventRows, byEvent,
    totals: {
      events: inRange.length,
      attendance: totalAtt,
      avgPerEvent: inRange.length ? Math.round((totalAtt / inRange.length) * 10) / 10 : 0,
      avgRate,
      km: inRange.reduce((s, e) => s + (Number(e.distance_km) || 0), 0),
      levels: {
        active: activeMembers.filter(r => r.level === 'active').length,
        mid: activeMembers.filter(r => r.level === 'mid').length,
        passive: activeMembers.filter(r => r.level === 'passive').length,
        new: activeMembers.filter(r => r.level === 'new').length,
      },
    },
  };
}
