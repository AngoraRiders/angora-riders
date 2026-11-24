import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, LOGIN_DOMAIN } from './config.js';

export const configured = !SUPABASE_URL.includes('PROJE-ID') && !SUPABASE_ANON_KEY.includes('BURAYA');

export const sb = configured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

// ---------------------------------------------------------------------
// Uygulama durumu
// ---------------------------------------------------------------------
export const state = {
  session: null,
  profile: null,
  settings: { group_name: 'Angora Riders', active_threshold: 60, passive_threshold: 30, auto_report: true },
};

// ---------------------------------------------------------------------
// YETKİLER  — her özellik ayrı ayrı yöneticiye verilebilir
// ---------------------------------------------------------------------
export const PERMISSION_GROUPS = [
  { key: 'dashboard', label: 'Ana Sayfa', icon: 'home', perms: [
    ['dashboard.view', 'Özet paneli görüntüleme', 'Yaklaşan etkinlikler, istatistikler, en aktif üyeler'],
  ]},
  { key: 'members', label: 'Üyeler', icon: 'users', perms: [
    ['members.view', 'Üye listesini ve profilleri görüntüleme', 'İsim, telefon, motosiklet, katılım geçmişi'],
    ['members.sensitive', 'Hassas bilgileri görüntüleme', 'Kan grubu, yakın kişi telefonu, sağlık notları'],
    ['members.create', 'Yeni üye ekleme', ''],
    ['members.edit', 'Üye bilgilerini düzenleme', ''],
    ['members.delete', 'Üye silme', 'Üye ve tüm katılım geçmişi silinir'],
    ['members.export', 'Üye listesini dışa aktarma', 'Excel (CSV) olarak indirme'],
  ]},
  { key: 'events', label: 'Takvim & Program', icon: 'calendar', perms: [
    ['events.view', 'Takvimi görüntüleme', ''],
    ['events.create', 'Takvime program / etkinlik ekleme', ''],
    ['events.edit', 'Etkinlik düzenleme', ''],
    ['events.delete', 'Etkinlik silme', ''],
  ]},
  { key: 'attendance', label: 'Katılım (Yoklama)', icon: 'check', perms: [
    ['attendance.view', 'Etkinliğe kimlerin geldiğini görüntüleme', ''],
    ['attendance.mark', 'Katılım işaretleme (tik atma)', 'Gelen üyeleri işaretleme / kaldırma'],
  ]},
  { key: 'reports', label: 'Raporlar', icon: 'chart', perms: [
    ['reports.view', 'Aktiflik raporlarını görüntüleme', ''],
    ['reports.export', 'Raporu Excel / PDF olarak alma', ''],
    ['reports.email', 'Raporu e-postaya gönderme', 'Raporlar her zaman grubun e-posta adresine gider'],
  ]},
  { key: 'settings', label: 'Ayarlar', icon: 'settings', perms: [
    ['settings.manage', 'Grup ayarlarını değiştirme', 'Grup adı, aktif / pasif eşikleri'],
  ]},
];
export const ALL_PERMS = PERMISSION_GROUPS.flatMap(g => g.perms.map(p => p[0]));

export const isFounder = () => state.profile?.role === 'founder' && state.profile?.active;
export const can = (p) => !!state.profile?.active && (isFounder() || (state.profile.permissions || []).includes(p));
export const canAny = (...ps) => ps.some(can);

// ---------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------
export const EVENT_TYPES = {
  ride:     { label: 'Sürüş',           color: '#e11d2a' },
  tour:     { label: 'Tur / Uzun Yol',  color: '#f97316' },
  meeting:  { label: 'Toplantı',        color: '#3b82f6' },
  camp:     { label: 'Kamp',            color: '#22c55e' },
  social:   { label: 'Sosyal Etkinlik', color: '#a855f7' },
  training: { label: 'Eğitim',          color: '#eab308' },
  charity:  { label: 'Sosyal Sorumluluk', color: '#14b8a6' },
  other:    { label: 'Diğer',           color: '#94a3b8' },
};
export const eventType = (t) => EVENT_TYPES[t] || EVENT_TYPES.other;

export const BLOOD_TYPES = ['0 Rh+', '0 Rh-', 'A Rh+', 'A Rh-', 'B Rh+', 'B Rh-', 'AB Rh+', 'AB Rh-'];

export const REPORT_EMAIL = 'angorariders@gmail.com';   // bilgi amaçlı; asıl alıcı sunucuda sabit

export const usernameToEmail = (u) => `${String(u).trim().toLowerCase()}@${LOGIN_DOMAIN}`;

// ---------------------------------------------------------------------
// Veri erişimi
// ---------------------------------------------------------------------
function check({ data, error }) {
  if (error) throw new Error(translateError(error.message));
  return data;
}

export function translateError(msg = '') {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'Kullanıcı adı veya şifre hatalı.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Bu kullanıcı adı zaten kullanılıyor.';
  if (m.includes('duplicate key') && m.includes('username')) return 'Bu kullanıcı adı zaten kullanılıyor.';
  if (m.includes('row-level security') || m.includes('permission denied')) return 'Bu işlem için yetkiniz yok.';
  if (m.includes('password should be')) return 'Şifre en az 6 karakter olmalı.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.';
  if (m.includes('rate limit')) return 'Çok fazla deneme yapıldı, lütfen biraz sonra tekrar deneyin.';
  return msg;
}

export const api = {
  // --- oturum
  async signIn(username, password) {
    check(await sb.auth.signInWithPassword({ email: usernameToEmail(username), password }));
  },
  async signOut() { await sb.auth.signOut(); },
  async setupNeeded() { return check(await sb.rpc('setup_needed')); },
  async registerFounder({ username, full_name, password }) {
    check(await sb.auth.signUp({ email: usernameToEmail(username), password, options: { data: { username, full_name } } }));
  },
  async changeOwnPassword(password) { check(await sb.auth.updateUser({ password })); },
  async loadProfile() {
    const uid = state.session?.user?.id;
    if (!uid) return null;
    return check(await sb.from('profiles').select('*').eq('id', uid).maybeSingle());
  },

  // --- ayarlar
  async loadSettings() { return check(await sb.from('settings').select('*').eq('id', 1).maybeSingle()); },
  async saveSettings(patch) { return check(await sb.from('settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1).select().single()); },

  // --- üyeler
  async members() { return check(await sb.from('members').select('*').order('full_name')); },
  async member(id) { return check(await sb.from('members').select('*').eq('id', id).maybeSingle()); },
  async memberPrivate(id) { return check(await sb.from('member_private').select('*').eq('member_id', id).maybeSingle()); },
  async allPrivate() { return check(await sb.from('member_private').select('*')); },
  async saveMember(id, data, priv) {
    let row;
    if (id) row = check(await sb.from('members').update(data).eq('id', id).select().single());
    else row = check(await sb.from('members').insert(data).select().single());
    if (priv && can('members.sensitive')) {
      check(await sb.from('member_private').upsert({ member_id: row.id, ...priv }));
    }
    return row;
  },
  async deleteMember(id) { check(await sb.from('members').delete().eq('id', id)); },

  // --- etkinlikler
  async events(fromISO, toISO) {
    let q = sb.from('events').select('*').order('start_at');
    if (fromISO) q = q.gte('start_at', fromISO);
    if (toISO) q = q.lt('start_at', toISO);
    return check(await q);
  },
  async event(id) { return check(await sb.from('events').select('*').eq('id', id).maybeSingle()); },
  async saveEvent(id, data) {
    if (id) return check(await sb.from('events').update(data).eq('id', id).select().single());
    return check(await sb.from('events').insert({ ...data, created_by: state.profile.id }).select().single());
  },
  async deleteEvent(id) { check(await sb.from('events').delete().eq('id', id)); },

  // --- katılım
  async attendance(eventId) { return check(await sb.from('attendance').select('*').eq('event_id', eventId)); },
  async attendanceForMember(memberId) { return check(await sb.from('attendance').select('*').eq('member_id', memberId)); },
  async allAttendance() {
    // Supabase tek sorguda 1000 satır sınırı uygular; sayfalayarak çek
    const out = []; const size = 1000;
    for (let from = 0; ; from += size) {
      const rows = check(await sb.from('attendance').select('event_id,member_id').range(from, from + size - 1));
      out.push(...rows);
      if (rows.length < size) break;
    }
    return out;
  },
  async mark(eventId, memberId, present) {
    if (present) check(await sb.from('attendance').upsert({ event_id: eventId, member_id: memberId, marked_by: state.profile.id }));
    else check(await sb.from('attendance').delete().eq('event_id', eventId).eq('member_id', memberId));
  },
  async markMany(eventId, memberIds, present) {
    if (!memberIds.length) return;
    if (present) check(await sb.from('attendance').upsert(memberIds.map(m => ({ event_id: eventId, member_id: m, marked_by: state.profile.id }))));
    else check(await sb.from('attendance').delete().eq('event_id', eventId).in('member_id', memberIds));
  },

  // --- e-posta raporları (sunucu fonksiyonu; alıcı sunucuda sabittir)
  async sendReport(body) {
    const { data, error } = await sb.functions.invoke('send-report', { body });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch { /* yok say */ }
      if (/failed to send|fetch/i.test(msg)) msg = 'Rapor sunucusuna ulaşılamadı. "send-report" fonksiyonu kurulu mu?';
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  },
  async reportLog(limit = 15) {
    return check(await sb.from('report_log').select('*').order('created_at', { ascending: false }).limit(limit));
  },

  // --- hesaplar (kurucu)
  async profiles() { return check(await sb.from('profiles').select('*').order('created_at')); },
  async updateProfile(id, patch) { return check(await sb.from('profiles').update(patch).eq('id', id).select().single()); },
  async createAccount({ username, full_name, password, role, permissions }) {
    // Ayrı bir istemciyle kayıt aç (mevcut kurucu oturumu bozulmasın)
    const temp = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'ar-temp-' + Date.now() },
    });
    const res = check(await temp.auth.signUp({ email: usernameToEmail(username), password, options: { data: { username, full_name } } }));
    const uid = res.user?.id;
    if (!uid) throw new Error('Hesap oluşturulamadı.');
    if (res.user.identities && res.user.identities.length === 0) throw new Error('Bu kullanıcı adı zaten kullanılıyor.');
    return check(await sb.from('profiles').update({ role, permissions, active: true, full_name }).eq('id', uid).select().single());
  },
  async setPassword(uid, pw) { check(await sb.rpc('admin_set_password', { uid, new_password: pw })); },
  async deleteAccount(uid) { check(await sb.rpc('admin_delete_user', { uid })); },
};
