import { api, state, can, eventType } from '../core.js';
import { icon, esc, avatar, fmtTime, relativeDays, MONTHS, emptyState } from '../ui.js';
import { computeStats, levelBadge } from '../stats.js';

export async function render(el) {
  const now = new Date();
  const [members, events, attendance] = await Promise.all([api.members(), api.events(), api.allAttendance()]);
  const active = members.filter(m => m.status === 'active');
  const upcoming = events.filter(e => new Date(e.start_at) >= new Date(now.getFullYear(), now.getMonth(), now.getDate())).slice(0, 5);
  const next = upcoming[0];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const thisMonth = events.filter(e => { const t = new Date(e.start_at); return t >= monthStart && t < monthEnd; });

  const last90 = new Date(now); last90.setDate(last90.getDate() - 90);
  const st = computeStats({ members: active, events, attendance, from: last90 });
  const top = [...st.rows].filter(r => r.attended > 0).sort((a, b) => b.attended - a.attended || b.rate - a.rate).slice(0, 5);

  const birthdays = active.filter(m => m.birth_date && new Date(m.birth_date).getMonth() === now.getMonth())
    .sort((a, b) => new Date(a.birth_date).getDate() - new Date(b.birth_date).getDate());

  const hour = now.getHours();
  const hello = hour < 6 ? 'İyi geceler' : hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';
  const name = (state.profile.full_name || state.profile.username).split(' ')[0];

  el.innerHTML = `
    <section class="hero">
      <div class="hero-text">
        <p class="eyebrow">${hello}, ${esc(name)}</p>
        <h1 lang="en">${esc(state.settings.group_name || 'Angora Riders')}</h1>
        <p class="muted">Yollar bizi bekliyor. Grubun son durumu burada.</p>
      </div>
      <img src="/assets/logo.png" alt="" class="hero-logo">
    </section>

    <section class="kpis">
      ${kpi('users', 'Aktif Üye', active.length, `${members.length} toplam kayıt`)}
      ${kpi('calendar', 'Bu Ay Etkinlik', thisMonth.length, `${MONTHS[now.getMonth()]} ${now.getFullYear()}`)}
      ${kpi('flame', 'Ort. Katılım Oranı', st.totals.avgRate + '%', 'Son 90 gün')}
      ${kpi('route', 'Toplam Yol', st.totals.km.toLocaleString('tr-TR') + ' km', 'Son 90 gün etkinlik mesafesi')}
    </section>

    <div class="grid-2">
      <section class="card">
        <header class="card-head"><h3>${icon('calendar')} Yaklaşan Program</h3>${can('events.view') ? '<a href="#/calendar" class="link">Takvim →</a>' : ''}</header>
        ${next ? `
          <a class="next-event" href="#/events/${next.id}" style="--c:${eventType(next.type).color}">
            <div class="ne-date"><b>${new Date(next.start_at).getDate()}</b><span>${MONTHS[new Date(next.start_at).getMonth()].slice(0, 3)}</span></div>
            <div class="ne-body">
              <span class="tag" style="--c:${eventType(next.type).color}">${eventType(next.type).label}</span>
              <h4>${esc(next.title)}</h4>
              <p>${icon('clock')} ${relativeDays(next.start_at)} · ${fmtTime(next.start_at)} ${next.meeting_point || next.location ? `· ${icon('pin')} ${esc(next.meeting_point || next.location)}` : ''}</p>
            </div>
          </a>
          <ul class="mini-list">
            ${upcoming.slice(1).map(e => `
              <li><a href="#/events/${e.id}">
                <i class="dot" style="--c:${eventType(e.type).color}"></i>
                <span class="grow">${esc(e.title)}</span>
                <span class="muted sm">${new Date(e.start_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
              </a></li>`).join('')}
          </ul>` : emptyState('calendar', 'Yaklaşan program yok', 'Takvime yeni bir sürüş ekleyin.', can('events.create') ? '<a href="#/calendar" class="btn btn-primary btn-sm">Takvime git</a>' : '')}
      </section>

      <section class="card">
        <header class="card-head"><h3>${icon('flame')} En Aktif Üyeler <small>son 90 gün</small></h3>${can('reports.view') ? '<a href="#/reports" class="link">Raporlar →</a>' : ''}</header>
        ${top.length ? `<ol class="rank">
          ${top.map((r, i) => `
            <li>
              <span class="rank-no">${i + 1}</span>
              ${avatar(r.member, 'sm')}
              <span class="grow"><b>${esc(r.member.full_name)}</b><small>${r.attended} etkinlik · ${r.km} km</small></span>
              ${levelBadge(r.level)}
            </li>`).join('')}
        </ol>` : emptyState('flame', 'Henüz katılım kaydı yok', 'Etkinliklerde yoklama alındıkça burada görünecek.')}
      </section>
    </div>

    <div class="grid-2">
      <section class="card">
        <header class="card-head"><h3>${icon('chart')} Aktiflik Dağılımı <small>son 90 gün</small></h3></header>
        ${levelBar(st.totals.levels)}
      </section>
      <section class="card">
        <header class="card-head"><h3>${icon('cake')} Bu Ay Doğum Günleri</h3></header>
        ${birthdays.length ? `<ul class="mini-list">
          ${birthdays.map(m => `<li><a href="#/members/${m.id}">${avatar(m, 'xs')}<span class="grow">${esc(m.full_name)}</span>
            <span class="muted sm">${new Date(m.birth_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</span></a></li>`).join('')}
        </ul>` : emptyState('cake', 'Bu ay doğum günü yok')}
      </section>
    </div>`;
}

const kpi = (ic, label, value, sub) => `
  <div class="kpi">
    <div class="kpi-ic">${icon(ic)}</div>
    <div><span class="kpi-label">${label}</span><b class="kpi-value">${value}</b><small>${sub}</small></div>
  </div>`;

export function levelBar(lv) {
  const total = lv.active + lv.mid + lv.passive + lv.new;
  if (!total) return emptyState('users', 'Üye yok');
  const seg = (k, label) => lv[k] ? `<span class="seg seg-${k}" style="flex:${lv[k]}" title="${label}: ${lv[k]}"></span>` : '';
  const s = state.settings;
  return `
    <div class="levelbar">${seg('active', 'Aktif')}${seg('mid', 'Orta')}${seg('passive', 'Pasif')}${seg('new', 'Veri yok')}</div>
    <ul class="legend">
      <li><i class="seg-active"></i>Aktif <small>(%${s.active_threshold}+)</small><b>${lv.active}</b></li>
      <li><i class="seg-mid"></i>Orta <small>(%${s.passive_threshold}–${s.active_threshold - 1})</small><b>${lv.mid}</b></li>
      <li><i class="seg-passive"></i>Pasif <small>(%${s.passive_threshold} altı)</small><b>${lv.passive}</b></li>
      <li><i class="seg-new"></i>Veri yok<b>${lv.new}</b></li>
    </ul>`;
}
