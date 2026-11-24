// =====================================================================
//  ANGORA RIDERS — E-posta rapor fonksiyonu (Supabase Edge Function)
//  Tüm raporlar REPORT_EMAIL adresine gider (varsayılan: angorariders@gmail.com)
//
//  mode: "period" -> tarih aralığı aktiflik raporu (elle, yetkili kullanıcı)
//        "event"  -> tek etkinlik katılım raporu (elle, yetkili kullanıcı)
//        "daily"  -> gün sonu otomatik rapor (zamanlanmış görev, x-cron-secret)
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const REPORT_EMAIL = Deno.env.get('REPORT_EMAIL') || 'angorariders@gmail.com';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'Angora Riders <onboarding@resend.dev>';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '');
const TZ = 'Europe/Istanbul';
const TZ_OFFSET_MS = 3 * 3600 * 1000; // Türkiye UTC+3 (yaz saati yok)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const TYPES: Record<string, string> = {
  ride: 'Sürüş', tour: 'Tur / Uzun Yol', meeting: 'Toplantı', camp: 'Kamp',
  social: 'Sosyal Etkinlik', training: 'Eğitim', charity: 'Sosyal Sorumluluk', other: 'Diğer',
};
const typeLabel = (t: string) => TYPES[t] || TYPES.other;

// ---------------------------------------------------------------- yardımcılar
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const fDate = (d: string | Date) => new Date(d).toLocaleDateString('tr-TR', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' });
const fShort = (d: string | Date | null) => d ? new Date(d).toLocaleDateString('tr-TR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
const fTime = (d: string | Date) => new Date(d).toLocaleTimeString('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
// Türkiye saatine göre günün başlangıcı (UTC zaman damgası)
const trDayStart = (d: Date | string) => {
  const t = new Date(d).getTime() + TZ_OFFSET_MS;
  return Math.floor(t / 86400000) * 86400000 - TZ_OFFSET_MS;
};

type Member = { id: string; full_name: string; nickname: string | null; join_date: string | null; status: string };
type Ev = { id: string; title: string; type: string; start_at: string; end_at: string | null; location: string | null; meeting_point: string | null; distance_km: number | null; description: string | null; report_sent_at: string | null };
type Att = { event_id: string; member_id: string };
type Settings = { group_name: string; active_threshold: number; passive_threshold: number; auto_report: boolean };

function level(rate: number, eligible: number, s: Settings) {
  if (!eligible) return 'Veri yok';
  if (rate >= s.active_threshold) return 'Aktif';
  if (rate < s.passive_threshold) return 'Pasif';
  return 'Orta';
}
const LEVEL_COLOR: Record<string, string> = { Aktif: '#16a34a', Orta: '#d97706', Pasif: '#dc2626', 'Veri yok': '#6b7280' };

function computeStats(members: Member[], events: Ev[], att: Att[], s: Settings, from: Date | null, to: Date | null) {
  const now = Date.now();
  const inRange = events.filter(e => {
    const t = new Date(e.start_at).getTime();
    return t <= now && (!from || t >= from.getTime()) && (!to || t < to.getTime());
  });
  const byMember = new Map<string, Set<string>>();
  const byEvent = new Map<string, Set<string>>();
  for (const a of att) {
    if (!byMember.has(a.member_id)) byMember.set(a.member_id, new Set());
    byMember.get(a.member_id)!.add(a.event_id);
    if (!byEvent.has(a.event_id)) byEvent.set(a.event_id, new Set());
    byEvent.get(a.event_id)!.add(a.member_id);
  }
  const evById = new Map(events.map(e => [e.id, e]));
  const rows = members.map(m => {
    const joinT = m.join_date ? trDayStart(m.join_date + 'T12:00:00Z') : 0;
    const mine = byMember.get(m.id) || new Set();
    let eligible = 0, attended = 0, km = 0;
    for (const e of inRange) {
      const went = mine.has(e.id);
      if (trDayStart(e.start_at) >= joinT || went) eligible++;
      if (went) { attended++; km += Number(e.distance_km) || 0; }
    }
    let last: string | null = null;
    for (const id of mine) { const e = evById.get(id); if (e && new Date(e.start_at).getTime() <= now && (!last || e.start_at > last)) last = e.start_at; }
    const rate = eligible ? Math.round(attended / eligible * 100) : 0;
    return { m, eligible, attended, rate, km: Math.round(km), last, level: level(rate, eligible, s) };
  }).sort((a, b) => b.rate - a.rate || b.attended - a.attended || a.m.full_name.localeCompare(b.m.full_name, 'tr'));
  const eventRows = inRange.map(e => {
    const count = (byEvent.get(e.id) || new Set()).size;
    const elig = members.filter(m => m.status === 'active' && (!m.join_date || trDayStart(m.join_date + 'T12:00:00Z') <= trDayStart(e.start_at))).length;
    return { e, count, rate: elig ? Math.round(count / elig * 100) : 0 };
  }).sort((a, b) => b.e.start_at.localeCompare(a.e.start_at));
  const active = rows.filter(r => r.m.status === 'active' && r.eligible);
  const total = eventRows.reduce((s2, r) => s2 + r.count, 0);
  return {
    rows, eventRows, byEvent,
    totals: {
      events: inRange.length, attendance: total,
      avgPerEvent: inRange.length ? Math.round(total / inRange.length * 10) / 10 : 0,
      avgRate: active.length ? Math.round(active.reduce((s2, r) => s2 + r.rate, 0) / active.length) : 0,
    },
  };
}

// ---------------------------------------------------------------- e-posta şablonu
function layout(title: string, subtitle: string, inner: string, sender: string) {
  const logo = APP_URL ? `<img src="${APP_URL}/assets/icon-192.png" width="64" height="64" alt="" style="display:block;border-radius:50%">` : '';
  return `<!doctype html><html><body style="margin:0;background:#f2f2f4;font-family:Segoe UI,Arial,sans-serif;color:#18181b">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f4;padding:24px 0"><tr><td align="center">
  <table width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;background:#fff;border-radius:14px;overflow:hidden">
    <tr><td style="background:#0b0b0e;padding:22px 26px;border-bottom:4px solid #e11d2a">
      <table width="100%"><tr><td width="76">${logo}</td><td>
        <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:2px">ANGORA <span style="color:#e11d2a">RIDERS</span></div>
        <div style="color:#bbb;font-size:13px;margin-top:2px">${esc(title)}</div></td></tr></table></td></tr>
    <tr><td style="padding:22px 26px 8px"><div style="font-size:15px;color:#52525b">${esc(subtitle)}</div></td></tr>
    <tr><td style="padding:8px 26px 24px">${inner}</td></tr>
    <tr><td style="padding:16px 26px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#71717a">
      Raporu oluşturan: <b>${esc(sender)}</b> · ${fDate(new Date())} ${fTime(new Date())}
      ${APP_URL ? `<br><a href="${APP_URL}" style="color:#e11d2a">Uygulamayı aç</a>` : ''}</td></tr>
  </table></td></tr></table></body></html>`;
}
const kpiRow = (items: [string, string | number][]) => `<table width="100%" cellpadding="0" cellspacing="6" style="margin-bottom:12px"><tr>${items.map(([l, v]) =>
  `<td style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:12px;text-align:center">
    <div style="font-size:24px;font-weight:800;color:#e11d2a">${esc(v)}</div><div style="font-size:12px;color:#71717a">${esc(l)}</div></td>`).join('')}</tr></table>`;
const table = (head: string[], rows: (string | number)[][], rawCols: number[] = []) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;margin:6px 0 18px">
  <tr>${head.map(h => `<th align="left" style="padding:8px;background:#18181b;color:#fff;font-weight:600">${esc(h)}</th>`).join('')}</tr>
  ${rows.map((r, i) => `<tr style="background:${i % 2 ? '#fafafa' : '#fff'}">${r.map((c, j) =>
    `<td style="padding:7px 8px;border-bottom:1px solid #eee">${rawCols.includes(j) ? c : esc(c)}</td>`).join('')}</tr>`).join('')}
  </table>`;
const h3 = (t: string) => `<h3 style="font-size:16px;margin:16px 0 6px;border-left:4px solid #e11d2a;padding-left:8px">${esc(t)}</h3>`;
const badge = (lv: string) => `<span style="color:${LEVEL_COLOR[lv]};font-weight:700">● ${esc(lv)}</span>`;

function csv(rows: (string | number | null | undefined)[][]) {
  const text = '﻿' + rows.map(r => r.map(v => {
    const s = String(v ?? '');
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';')).join('\r\n');
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// ---------------------------------------------------------------- rapor üreticiler
function periodReport(d: Data, opts: { from?: string; to?: string; type?: string; includeLeft?: boolean; label?: string }, sender: string) {
  const from = opts.from ? new Date(opts.from) : null;
  const to = opts.to ? new Date(opts.to) : null;
  const events = opts.type && opts.type !== 'all' ? d.events.filter(e => e.type === opts.type) : d.events;
  const members = opts.includeLeft ? d.members : d.members.filter(m => m.status === 'active');
  const st = computeStats(members, events, d.att, d.settings, from, to);
  const label = opts.label || (from || to ? `${from ? fDate(from) : 'Başlangıç'} – ${to ? fDate(new Date(to.getTime() - 1)) : 'Bugün'}` : 'Tüm zamanlar');
  const typeTxt = opts.type && opts.type !== 'all' ? ` · ${typeLabel(opts.type)}` : '';
  const subject = `${d.settings.group_name} · Aktiflik Raporu · ${label}${typeTxt}`;
  const html = layout('Aktiflik Raporu', `${label}${typeTxt}`,
    kpiRow([['Etkinlik', st.totals.events], ['Toplam katılım', st.totals.attendance], ['Etkinlik başına', st.totals.avgPerEvent], ['Ort. oran', '%' + st.totals.avgRate]]) +
    h3('Üye Bazında Aktiflik') +
    table(['#', 'Üye', 'Katıldı', 'Fırsat', 'Oran', 'Km', 'Son katılım', 'Durum'],
      st.rows.map((r, i) => [i + 1, r.m.full_name + (r.m.status === 'left' ? ' (ayrıldı)' : ''), r.attended, r.eligible, '%' + r.rate, r.km, fShort(r.last), badge(r.level)]), [7]) +
    h3('Etkinlik Bazında Katılım') +
    (st.eventRows.length ? table(['Tarih', 'Etkinlik', 'Tür', 'Katılımcı', 'Oran'],
      st.eventRows.map(r => [fShort(r.e.start_at), r.e.title, typeLabel(r.e.type), r.count, '%' + r.rate])) : '<p style="color:#71717a">Bu aralıkta gerçekleşmiş etkinlik yok.</p>'),
    sender);
  const attachment = csv([
    [subject], [],
    ['Üye', 'Katılım Tarihi', 'Durum', 'Katıldığı', 'Katılabileceği', 'Oran (%)', 'Km', 'Son Katılım', 'Aktiflik'],
    ...st.rows.map(r => [r.m.full_name, fShort(r.m.join_date), r.m.status === 'active' ? 'Aktif' : 'Ayrıldı', r.attended, r.eligible, r.rate, r.km, fShort(r.last), r.level]),
    [], ['Tarih', 'Etkinlik', 'Tür', 'Km', 'Katılımcı', 'Oran (%)'],
    ...st.eventRows.map(r => [fShort(r.e.start_at), r.e.title, typeLabel(r.e.type), r.e.distance_km ?? '', r.count, r.rate]),
  ]);
  return { subject, html, attachments: [{ filename: 'aktiflik-raporu.csv', content: attachment }] };
}

function eventSection(d: Data, e: Ev) {
  const present = new Set(d.att.filter(a => a.event_id === e.id).map(a => a.member_id));
  const evDay = trDayStart(e.start_at);
  const roster = d.members.filter(m => (m.status === 'active' && (!m.join_date || trDayStart(m.join_date + 'T12:00:00Z') <= evDay)) || present.has(m.id));
  const came = roster.filter(m => present.has(m.id)).sort((a, b) => a.full_name.localeCompare(b.full_name, 'tr'));
  const missed = roster.filter(m => !present.has(m.id)).sort((a, b) => a.full_name.localeCompare(b.full_name, 'tr'));
  const rate = roster.length ? Math.round(came.length / roster.length * 100) : 0;
  // genel aktiflik (tüm zamanlar) — gelmeyenlerin durumu için
  const st = computeStats(d.members.filter(m => m.status === 'active'), d.events, d.att, d.settings, null, null);
  const lv = new Map(st.rows.map(r => [r.m.id, r]));
  const html = `
    <div style="border:1px solid #eee;border-left:5px solid #e11d2a;border-radius:10px;padding:14px 16px;margin:6px 0 14px">
      <div style="font-size:12px;color:#e11d2a;font-weight:700;text-transform:uppercase">${esc(typeLabel(e.type))}</div>
      <div style="font-size:19px;font-weight:800;margin:2px 0 6px">${esc(e.title)}</div>
      <div style="font-size:13px;color:#52525b;line-height:1.7">
        📅 ${fDate(e.start_at)} · ${fTime(e.start_at)}${e.end_at ? ' – ' + fTime(e.end_at) : ''}<br>
        ${e.meeting_point ? `📍 Toplanma: ${esc(e.meeting_point)}<br>` : ''}${e.location ? `🏁 ${esc(e.location)}<br>` : ''}${e.distance_km ? `🛣️ ${esc(e.distance_km)} km<br>` : ''}
      </div></div>` +
    kpiRow([['Katılan', came.length], ['Katılmayan', missed.length], ['Katılım oranı', '%' + rate]]) +
    h3(`Katılanlar (${came.length})`) +
    (came.length ? table(['#', 'Üye', 'Genel oran', 'Durum'], came.map((m, i) => [i + 1, m.full_name, lv.get(m.id) ? '%' + lv.get(m.id)!.rate : '', badge(lv.get(m.id)?.level || 'Veri yok')]), [3])
      : '<p style="color:#dc2626">Bu etkinlik için katılım işaretlenmemiş.</p>') +
    h3(`Katılmayanlar (${missed.length})`) +
    (missed.length ? table(['#', 'Üye', 'Genel oran', 'Durum'], missed.map((m, i) => [i + 1, m.full_name, lv.get(m.id) ? '%' + lv.get(m.id)!.rate : '', badge(lv.get(m.id)?.level || 'Veri yok')]), [3]) : '<p style="color:#71717a">Herkes katıldı 🎉</p>');
  const rows = [
    [e.title, fShort(e.start_at), typeLabel(e.type)], [],
    ['Üye', 'Durum'], ...came.map(m => [m.full_name, 'Katıldı']), ...missed.map(m => [m.full_name, 'Katılmadı']),
  ];
  return { html, rows, came: came.length, total: roster.length };
}

function eventReport(d: Data, e: Ev, sender: string, auto = false) {
  const s = eventSection(d, e);
  const subject = `${d.settings.group_name} · Etkinlik Raporu · ${e.title} · ${fShort(e.start_at)} (${s.came}/${s.total})`;
  const html = layout(auto ? 'Gün Sonu Etkinlik Raporu' : 'Etkinlik Katılım Raporu', `${e.title} — ${fDate(e.start_at)}`, s.html, sender);
  return { subject, html, attachments: [{ filename: 'etkinlik-katilim.csv', content: csv(s.rows) }] };
}

function dailyReport(d: Data, evs: Ev[]) {
  const today = fDate(new Date());
  if (evs.length === 1) return eventReport(d, evs[0], 'Otomatik gün sonu raporu', true);
  const parts = evs.map(e => eventSection(d, e));
  const subject = `${d.settings.group_name} · Gün Sonu Raporu · ${today} (${evs.length} etkinlik)`;
  const html = layout('Gün Sonu Etkinlik Raporu', `${today} tarihinde tamamlanan ${evs.length} etkinlik`,
    parts.map(p => p.html).join('<hr style="border:0;border-top:2px dashed #eee;margin:22px 0">'), 'Otomatik gün sonu raporu');
  return { subject, html, attachments: [{ filename: 'gun-sonu-raporu.csv', content: csv(parts.flatMap(p => [...p.rows, []])) }] };
}

// ---------------------------------------------------------------- veri
type Data = { settings: Settings; members: Member[]; events: Ev[]; att: Att[] };
// deno-lint-ignore no-explicit-any
async function loadData(db: any): Promise<Data> {
  const [s, m, e] = await Promise.all([
    db.from('settings').select('*').eq('id', 1).single(),
    db.from('members').select('id,full_name,nickname,join_date,status'),
    db.from('events').select('id,title,type,start_at,end_at,location,meeting_point,distance_km,description,report_sent_at').order('start_at'),
  ]);
  if (m.error) throw m.error;
  if (e.error) throw e.error;
  const att: Att[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await db.from('attendance').select('event_id,member_id').range(from, from + 999);
    if (r.error) throw r.error;
    att.push(...r.data);
    if (r.data.length < 1000) break;
  }
  return { settings: s.data ?? { group_name: 'Angora Riders', active_threshold: 60, passive_threshold: 30, auto_report: true }, members: m.data, events: e.data, att };
}

async function sendMail(msg: { subject: string; html: string; attachments?: { filename: string; content: string }[] }) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY tanımlı değil (Supabase > Edge Functions > Secrets).');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [REPORT_EMAIL], subject: msg.subject, html: msg.html, attachments: msg.attachments }),
  });
  if (!res.ok) throw new Error('E-posta gönderilemedi: ' + (await res.text()));
}

// ---------------------------------------------------------------- giriş noktası
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  // deno-lint-ignore no-explicit-any
  const body: any = await req.json().catch(() => ({}));
  const mode = body.mode || 'period';
  let sender = 'Otomatik gün sonu raporu';
  let senderId: string | null = null;

  // --- yetki kontrolü
  if (mode === 'daily') {
    if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) return json({ error: 'Yetkisiz' }, 401);
  } else {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: u } = await db.auth.getUser(token);
    if (!u?.user) return json({ error: 'Oturum geçersiz, tekrar giriş yapın.' }, 401);
    const { data: prof } = await db.from('profiles').select('*').eq('id', u.user.id).single();
    const ok = prof?.active && (prof.role === 'founder' || (prof.permissions || []).includes('reports.email'));
    if (!ok) return json({ error: 'Rapor gönderme yetkiniz yok.' }, 403);
    sender = prof.full_name || prof.username;
    senderId = prof.id;
  }

  let subject = '';
  try {
    const d = await loadData(db);
    let msg;
    if (mode === 'daily') {
      if (!d.settings.auto_report) return json({ ok: true, skipped: 'Otomatik rapor kapalı' });
      // Bugün (TR saati) biten ve henüz raporlanmamış etkinlikler; kaçırılanlar için son 7 gün
      const now = Date.now();
      const dayEnd = trDayStart(new Date()) + 86400000;
      const evs = d.events.filter(e => {
        if (e.report_sent_at) return false;
        const end = new Date(e.end_at || e.start_at).getTime();
        return end < dayEnd && end <= now + 3600000 && end >= now - 7 * 86400000;
      });
      if (!evs.length) return json({ ok: true, skipped: 'Bugün tamamlanan etkinlik yok' });
      msg = dailyReport(d, evs);
      subject = msg.subject;
      await sendMail(msg);
      await db.from('events').update({ report_sent_at: new Date().toISOString() }).in('id', evs.map(e => e.id));
    } else if (mode === 'event') {
      const e = d.events.find(x => x.id === body.eventId);
      if (!e) return json({ error: 'Etkinlik bulunamadı' }, 404);
      msg = eventReport(d, e, sender);
      subject = msg.subject;
      await sendMail(msg);
    } else {
      msg = periodReport(d, body, sender);
      subject = msg.subject;
      await sendMail(msg);
    }
    await db.from('report_log').insert({ kind: mode, subject, recipient: REPORT_EMAIL, sent_by: senderId, sent_by_name: sender });
    return json({ ok: true, recipient: REPORT_EMAIL, subject });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.from('report_log').insert({ kind: mode, subject: subject || '(oluşturulamadı)', recipient: REPORT_EMAIL, sent_by: senderId, sent_by_name: sender, status: 'error', error: message });
    return json({ error: message }, 500);
  }
});
