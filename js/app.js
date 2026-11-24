import { sb, state, api, configured, can, canAny, isFounder, translateError } from './core.js';
import { icon, esc, $, $$, toast, initials } from './ui.js';

const app = document.getElementById('app');

// ---------------------------------------------------------------------
// Rotalar
// ---------------------------------------------------------------------
const ROUTES = [
  { path: 'dashboard', title: 'Ana Sayfa', icon: 'home', nav: true, allow: () => can('dashboard.view'), load: () => import('./views/dashboard.js') },
  { path: 'members', title: 'Üyeler', icon: 'users', nav: true, allow: () => can('members.view'), load: () => import('./views/members.js') },
  { path: 'members/:id', title: 'Üye Profili', allow: () => can('members.view'), load: () => import('./views/member.js') },
  { path: 'calendar', title: 'Takvim', icon: 'calendar', nav: true, allow: () => canAny('events.view', 'attendance.view', 'attendance.mark'), load: () => import('./views/calendar.js') },
  { path: 'events/:id', title: 'Etkinlik', allow: () => canAny('events.view', 'attendance.view', 'attendance.mark'), load: () => import('./views/event.js') },
  { path: 'reports', title: 'Raporlar', icon: 'chart', nav: true, allow: () => can('reports.view'), load: () => import('./views/reports.js') },
  { path: 'users', title: 'Yetkiler', icon: 'shield', nav: true, allow: () => isFounder(), load: () => import('./views/users.js') },
  { path: 'settings', title: 'Ayarlar', icon: 'settings', nav: true, allow: () => can('settings.manage'), load: () => import('./views/settings.js') },
  { path: 'account', title: 'Hesabım', icon: 'user', allow: () => true, load: () => import('./views/account.js') },
];

function matchRoute(hash) {
  const parts = hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
  for (const r of ROUTES) {
    const rp = r.path.split('/');
    if (rp.length !== parts.length) continue;
    const params = {};
    if (rp.every((seg, i) => seg.startsWith(':') ? (params[seg.slice(1)] = decodeURIComponent(parts[i]), true) : seg === parts[i])) {
      return { route: r, params };
    }
  }
  return null;
}

const firstAllowed = () => ROUTES.find(r => r.nav && r.allow()) || ROUTES.find(r => r.path === 'account');

export function navigate(path) { location.hash = '#/' + path; }

// ---------------------------------------------------------------------
// Başlatma
// ---------------------------------------------------------------------
async function boot() {
  if (!configured) return renderNotConfigured();
  const { data } = await sb.auth.getSession();
  state.session = data.session;
  sb.auth.onAuthStateChange((event, session) => {
    const had = !!state.session;
    state.session = session;
    if (event === 'SIGNED_OUT' || (!had && session && event === 'SIGNED_IN')) start();
  });
  start();
}

async function start() {
  if (!state.session) {
    let needed = false;
    try { needed = await api.setupNeeded(); } catch (e) { return renderError(e); }
    return needed ? renderSetup() : renderLogin();
  }
  try {
    state.profile = await api.loadProfile();
    if (!state.profile) throw new Error('Profil bulunamadı. Veritabanı kurulumunu kontrol edin.');
    if (!state.profile.active) return renderPending();
    const s = await api.loadSettings();
    if (s) state.settings = s;
  } catch (e) { return renderError(e); }
  renderShell();
  window.removeEventListener('hashchange', route);
  window.addEventListener('hashchange', route);
  route();
}

// ---------------------------------------------------------------------
// Kimlik doğrulama ekranları
// ---------------------------------------------------------------------
const authFrame = (inner) => `
  <div class="auth">
    <div class="auth-bg"></div>
    <div class="auth-card">
      <img src="/assets/logo.png" alt="Angora Riders" class="auth-logo">
      <h1 class="auth-title">ANGORA <span>RIDERS</span></h1>
      <p class="auth-sub">Grup Takip Sistemi</p>
      ${inner}
    </div>
    <p class="auth-foot">Ankara · 2023</p>
  </div>`;

function renderLogin() {
  app.innerHTML = authFrame(`
    <form id="login" class="auth-form">
      <label class="field"><span>Kullanıcı adı</span>
        <input name="username" autocomplete="username" autocapitalize="none" required></label>
      <label class="field"><span>Şifre</span>
        <input name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn btn-primary btn-block btn-lg" type="submit">Giriş Yap</button>
    </form>`);
  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = $('button', e.target);
    btn.disabled = true; btn.classList.add('loading');
    try { await api.signIn(f.get('username'), f.get('password')); }
    catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.classList.remove('loading'); }
  });
}

function renderSetup() {
  app.innerHTML = authFrame(`
    <div class="auth-note">${icon('crown')}<div><b>İlk kurulum</b><br>Sistemin ilk <b>kurucu</b> hesabını oluşturun. Diğer kurucu ve yönetici hesaplarını içeriden ekleyeceksiniz.</div></div>
    <form id="setup" class="auth-form">
      <label class="field"><span>Ad Soyad</span><input name="full_name" required></label>
      <label class="field"><span>Kullanıcı adı</span><input name="username" autocapitalize="none" pattern="[a-zA-Z0-9._\\-]{3,30}" title="3-30 karakter: harf, rakam, nokta, tire" required></label>
      <label class="field"><span>Şifre</span><input name="password" type="password" minlength="6" autocomplete="new-password" required></label>
      <button class="btn btn-primary btn-block btn-lg" type="submit">Kurucu Hesabını Oluştur</button>
    </form>`);
  $('#setup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const btn = $('button', e.target);
    btn.disabled = true; btn.classList.add('loading');
    try {
      await api.registerFounder(f);
      const { data } = await sb.auth.getSession();
      if (!data.session) await api.signIn(f.username, f.password);
    } catch (err) {
      toast(translateError(err.message), 'err');
      btn.disabled = false; btn.classList.remove('loading');
    }
  });
}

function renderPending() {
  app.innerHTML = authFrame(`
    <div class="auth-note">${icon('info')}<div>Hesabınız <b>pasif</b> durumda. Bir kurucunun hesabınızı etkinleştirmesi gerekiyor.</div></div>
    <button class="btn btn-ghost btn-block" id="out">${icon('logout')} Çıkış yap</button>`);
  $('#out').onclick = () => api.signOut();
}

function renderNotConfigured() {
  app.innerHTML = authFrame(`
    <div class="auth-note">${icon('settings')}<div><b>Bağlantı ayarı eksik.</b><br><code>js/config.js</code> dosyasına Supabase adresinizi ve anon anahtarınızı yazın. Ayrıntılar <code>KURULUM.md</code> dosyasında.</div></div>`);
}

function renderError(e) {
  app.innerHTML = authFrame(`
    <div class="auth-note err">${icon('info')}<div><b>Bir sorun oluştu</b><br>${esc(translateError(e.message || String(e)))}</div></div>
    <button class="btn btn-primary btn-block" onclick="location.reload()">Tekrar dene</button>
    ${state.session ? '<button class="btn btn-ghost btn-block" id="out" style="margin-top:8px">Çıkış yap</button>' : ''}`);
  const o = $('#out'); if (o) o.onclick = () => api.signOut();
}

// ---------------------------------------------------------------------
// Uygulama iskeleti
// ---------------------------------------------------------------------
function renderShell() {
  const p = state.profile;
  const navItems = ROUTES.filter(r => r.nav && r.allow());
  const mobileMain = navItems.filter(r => ['dashboard', 'members', 'calendar', 'reports'].includes(r.path));
  const mobileMore = navItems.filter(r => !mobileMain.includes(r));
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <a href="#/" class="brand">
          <img src="/assets/logo.png" alt="">
          <div><b>ANGORA</b><span>RIDERS</span></div>
        </a>
        <nav class="side-nav">
          ${navItems.map(r => `<a href="#/${r.path}" data-path="${r.path}">${icon(r.icon)}<span>${r.title}</span></a>`).join('')}
        </nav>
        <a href="#/account" class="me" data-path="account">
          <span class="avatar sm">${esc(initials(p.full_name || p.username))}</span>
          <div><b>${esc(p.full_name || p.username)}</b><span>${p.role === 'founder' ? 'Kurucu' : 'Yönetici'}</span></div>
          ${icon('chevR')}
        </a>
      </aside>
      <div class="main">
        <header class="topbar">
          <a href="#/" class="topbar-brand"><img src="/assets/logo.png" alt=""></a>
          <h2 id="page-title"></h2>
          <a href="#/account" class="avatar sm" title="Hesabım">${esc(initials(p.full_name || p.username))}</a>
        </header>
        <main id="view" class="view"></main>
      </div>
      <nav class="tabbar">
        ${mobileMain.map(r => `<a href="#/${r.path}" data-path="${r.path}">${icon(r.icon)}<span>${r.title}</span></a>`).join('')}
        <button type="button" id="more-btn" data-path="more">${icon('menu')}<span>Daha</span></button>
      </nav>
      <div class="sheet" id="more-sheet">
        <div class="sheet-panel">
          <div class="sheet-grip"></div>
          ${mobileMore.map(r => `<a href="#/${r.path}">${icon(r.icon)}<span>${r.title}</span></a>`).join('')}
          <a href="#/account">${icon('user')}<span>Hesabım</span></a>
          <button type="button" id="sheet-out">${icon('logout')}<span>Çıkış Yap</span></button>
        </div>
      </div>
    </div>`;
  const sheet = $('#more-sheet');
  $('#more-btn').onclick = () => sheet.classList.add('show');
  sheet.addEventListener('click', (e) => { if (e.target === sheet || e.target.closest('a')) sheet.classList.remove('show'); });
  $('#sheet-out').onclick = () => api.signOut();
}

let routeToken = 0;
async function route() {
  if (!state.session || !$('#view')) return;
  const hash = location.hash || '#/';
  let m = matchRoute(hash);
  if (!m) { const f = firstAllowed(); if (hash !== '#/' + f.path) return navigate(f.path); m = { route: f, params: {} }; }
  const token = ++routeToken;

  // yetkiler kurucu tarafından değiştirilmiş olabilir — profili tazele
  try {
    const fresh = await api.loadProfile();
    if (!fresh || !fresh.active) return start();
    const changed = JSON.stringify(fresh.permissions) !== JSON.stringify(state.profile.permissions) || fresh.role !== state.profile.role;
    state.profile = fresh;
    if (changed) renderShell();
  } catch { /* çevrimdışı olabilir */ }
  if (token !== routeToken) return;

  if (!m.route.allow()) { toast('Bu sayfayı görüntüleme yetkiniz yok.', 'err'); return navigate(firstAllowed().path); }

  const view = $('#view');
  const base = m.route.path.split('/')[0];
  $$('[data-path]').forEach(a => a.classList.toggle('active', a.dataset.path === base || (base === 'events' && a.dataset.path === 'calendar')));
  $('#page-title').textContent = m.route.title;
  document.title = `${m.route.title} · Angora Riders`;
  view.innerHTML = '<div class="loader"><span></span></div>';
  view.classList.remove('fade-in');
  try {
    const mod = await m.route.load();
    if (token !== routeToken) return;
    await mod.render(view, m.params, { navigate, setTitle: (t) => { $('#page-title').textContent = t; } });
    view.classList.add('fade-in');
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card err-card">${icon('info')}<div><b>Sayfa yüklenemedi</b><p>${esc(translateError(e.message || String(e)))}</p></div></div>`;
  }
}

export const refresh = () => route();

boot();
