import { api, can, eventType } from '../core.js';
import { icon, esc, $, avatar, fmtDate, fmtShort, memberSince, confirmDialog, toast, telLink, emptyState } from '../ui.js';
import { computeStats, levelBadge } from '../stats.js';
import { openMemberForm } from './members.js';

export async function render(el, { id }, ctx) {
  const [m, events, myAtt] = await Promise.all([api.member(id), api.events(), api.attendanceForMember(id)]);
  if (!m) { el.innerHTML = emptyState('users', 'Üye bulunamadı', '', '<a class="btn btn-ghost" href="#/members">Üyelere dön</a>'); return; }
  const priv = can('members.sensitive') ? await api.memberPrivate(id) : null;
  ctx.setTitle(m.full_name);

  const st = computeStats({ members: [m], events, attendance: myAtt }).rows[0];
  const went = new Set(myAtt.map(a => a.event_id));
  const joinT = new Date(m.join_date); joinT.setHours(0, 0, 0, 0);
  const history = events.filter(e => new Date(e.start_at) <= new Date() && (new Date(e.start_at) >= joinT || went.has(e.id)))
    .sort((a, b) => b.start_at.localeCompare(a.start_at));
  const age = m.birth_date ? Math.floor((Date.now() - new Date(m.birth_date)) / 31557600000) : null;

  el.innerHTML = `
    <a href="#/members" class="back">${icon('chevL')} Üyeler</a>
    <section class="profile-hero ${m.status === 'left' ? 'is-left' : ''}">
      ${avatar(m, 'xl')}
      <div class="ph-body">
        <div class="ph-badges">${levelBadge(st.level)}${m.status === 'left' ? '<span class="tag">Gruptan ayrıldı</span>' : ''}</div>
        <h1>${esc(m.full_name)}</h1>
        ${m.nickname ? `<p class="ph-nick">“${esc(m.nickname)}”</p>` : ''}
        <p class="muted">${icon('calendar')} ${fmtDate(m.join_date)} tarihinden beri üye · ${memberSince(m.join_date)}</p>
      </div>
      <div class="ph-actions">
        ${can('members.edit') ? `<button class="btn btn-ghost" id="edit">${icon('edit')}<span>Düzenle</span></button>` : ''}
        ${can('members.delete') ? `<button class="btn btn-ghost danger" id="del">${icon('trash')}<span>Sil</span></button>` : ''}
      </div>
    </section>

    <section class="kpis">
      <div class="kpi"><div class="kpi-ic">${icon('flame')}</div><div><span class="kpi-label">Katılım Oranı</span><b class="kpi-value">%${st.rate}</b><small>${st.attended} / ${st.eligible} etkinlik</small></div></div>
      <div class="kpi"><div class="kpi-ic">${icon('check')}</div><div><span class="kpi-label">Katıldığı Etkinlik</span><b class="kpi-value">${st.attended}</b><small>toplam</small></div></div>
      <div class="kpi"><div class="kpi-ic">${icon('route')}</div><div><span class="kpi-label">Grupla Yapılan Yol</span><b class="kpi-value">${st.km.toLocaleString('tr-TR')} km</b><small>katıldığı etkinlikler</small></div></div>
      <div class="kpi"><div class="kpi-ic">${icon('clock')}</div><div><span class="kpi-label">Son Katılım</span><b class="kpi-value sm">${st.last ? fmtShort(st.last) : '—'}</b><small>${st.last ? '' : 'kayıt yok'}</small></div></div>
    </section>

    <div class="grid-2">
      <section class="card">
        <header class="card-head"><h3>${icon('user')} Bilgiler</h3></header>
        <dl class="info">
          <dt>Telefon</dt><dd>${telLink(m.phone)}</dd>
          <dt>E-posta</dt><dd>${m.email ? `<a href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : '—'}</dd>
          <dt>Doğum tarihi</dt><dd>${m.birth_date ? `${fmtDate(m.birth_date)} <span class="muted">(${age} yaş)</span>` : '—'}</dd>
          <dt>Şehir</dt><dd>${esc(m.city || '—')}</dd>
          <dt>Motosiklet</dt><dd>${esc(m.motorcycle || '—')}</dd>
          <dt>Plaka</dt><dd>${m.plate ? `<span class="plate">${esc(m.plate)}</span>` : '—'}</dd>
          ${m.notes ? `<dt>Notlar</dt><dd>${esc(m.notes)}</dd>` : ''}
        </dl>
      </section>

      ${can('members.sensitive') ? `
      <section class="card emergency">
        <header class="card-head"><h3>${icon('heart')} Acil Durum Bilgileri</h3></header>
        <div class="blood">
          <div class="blood-drop">${icon('drop')}<b>${esc(priv?.blood_type || '?')}</b></div>
          <div><span class="muted sm">Kan Grubu</span><b>${esc(priv?.blood_type || 'Belirtilmemiş')}</b></div>
        </div>
        <dl class="info">
          <dt>Yakını</dt><dd>${esc(priv?.emergency_name || '—')}${priv?.emergency_relation ? ` <span class="muted">(${esc(priv.emergency_relation)})</span>` : ''}</dd>
          <dt>Yakın telefonu</dt><dd>${telLink(priv?.emergency_phone)}</dd>
          <dt>Sağlık notu</dt><dd>${esc(priv?.health_notes || '—')}</dd>
        </dl>
        ${priv?.emergency_phone ? `<a class="btn btn-danger btn-block" href="tel:${esc(priv.emergency_phone.replace(/[^\d+]/g, ''))}">${icon('phone')} Yakınını Ara</a>` : ''}
      </section>` : ''}
    </div>

    <section class="card">
      <header class="card-head"><h3>${icon('calendar')} Katılım Geçmişi</h3><small class="muted">${history.length} etkinlik</small></header>
      ${history.length ? `<ul class="history">
        ${history.map(e => `<li class="${went.has(e.id) ? 'yes' : 'no'}">
          <span class="h-mark">${icon(went.has(e.id) ? 'check' : 'x')}</span>
          <a href="#/events/${e.id}" class="grow"><b>${esc(e.title)}</b><small>${fmtDate(e.start_at)} · ${eventType(e.type).label}${e.distance_km ? ` · ${e.distance_km} km` : ''}</small></a>
          <span class="muted sm">${went.has(e.id) ? 'Katıldı' : 'Katılmadı'}</span>
        </li>`).join('')}
      </ul>` : emptyState('calendar', 'Henüz etkinlik yok', 'Üyenin katılım tarihinden sonraki etkinlikler burada listelenir.')}
    </section>`;

  $('#edit', el)?.addEventListener('click', async () => {
    if (await openMemberForm(m, priv)) render(el, { id }, ctx);
  });
  $('#del', el)?.addEventListener('click', async () => {
    if (!await confirmDialog('Üyeyi sil', `${m.full_name} ve tüm katılım geçmişi kalıcı olarak silinecek. Gruptan ayrıldıysa silmek yerine "Gruptan ayrıldı" olarak işaretlemeniz önerilir.`, { submitText: 'Kalıcı olarak sil' })) return;
    try { await api.deleteMember(id); toast('Üye silindi'); ctx.navigate('members'); }
    catch (e) { toast(e.message, 'err'); }
  });
}
