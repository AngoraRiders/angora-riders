// ---------------------------------------------------------------------
// Arayüz yardımcıları
// ---------------------------------------------------------------------
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.8"/><path d="M16.5 14.6c2.6.2 4.4 1.9 5 5.4"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  chart: '<path d="M3 21h18"/><rect x="5" y="11" width="3.2" height="7" rx="1"/><rect x="10.4" y="6" width="3.2" height="12" rx="1"/><rect x="15.8" y="13" width="3.2" height="5" rx="1"/>',
  shield: '<path d="M12 2.5 4 5.5v6c0 5 3.4 8.8 8 10 4.6-1.2 8-5 8-10v-6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.4 4.2-6.5 8-6.5s7 2.1 8 6.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2"/>',
  drop: '<path d="M12 2.5S5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5z"/>',
  heart: '<path d="M12 20s-7.5-4.6-9-9.5C2 7 4.3 4 7.5 4c2 0 3.4 1 4.5 2.6C13.1 5 14.5 4 16.5 4 19.7 4 22 7 21 10.5 19.5 15.4 12 20 12 20z"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/>',
  bike: '<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 9 10h5l4.5 6.5M14 10l-2-4H9.5M9 10l3 6.5h2"/>',
  chevL: '<path d="m15 5-7 7 7 7"/>',
  chevR: '<path d="m9 5 7 7-7 7"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  printer: '<path d="M6 9V3h12v6M6 18H4v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7h-2"/><rect x="6" y="14" width="12" height="7"/>',
  logout: '<path d="M15 4h4v16h-4M10 17l5-5-5-5M15 12H3"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
  crown: '<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  flame: '<path d="M12 22c4 0 7-2.8 7-7 0-4.5-4-7-4-11-3 1.5-5 4.5-5 7-1-.5-2-2-2-3.5C5.5 9.5 5 12 5 15c0 4.2 3 7 7 7z"/>',
  cake: '<path d="M4 21h16v-8H4zM4 16c2 1 4 1 5.3 0 1.4-1 4-1 5.4 0 1.3 1 3.3 1 5.3 0M12 13V9M12 6.5a1.5 1.5 0 0 0 0-3c0 1-1.5 1.5 0 3z"/>',
  camera: '<path d="M4 7h3.5L9 4.5h6L16.5 7H20a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.8"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
};
export const icon = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------------- tarih
const TR = 'tr-TR';
export const pad = (n) => String(n).padStart(2, '0');
export const fmtDate = (d, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => d ? new Date(d).toLocaleDateString(TR, opts) : '—';
export const fmtShort = (d) => d ? new Date(d).toLocaleDateString(TR, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
export const fmtTime = (d) => d ? new Date(d).toLocaleTimeString(TR, { hour: '2-digit', minute: '2-digit' }) : '';
export const fmtDateTime = (d) => d ? `${fmtDate(d, { day: 'numeric', month: 'long', weekday: 'long' })} · ${fmtTime(d)}` : '—';
export const dateOnly = (d) => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const DAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
export function relativeDays(d) {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(d); b.setHours(0, 0, 0, 0);
  const diff = Math.round((b - a) / 86400000);
  if (diff === 0) return 'Bugün';
  if (diff === 1) return 'Yarın';
  if (diff === -1) return 'Dün';
  return diff > 0 ? `${diff} gün sonra` : `${-diff} gün önce`;
}
export function memberSince(join) {
  if (!join) return '';
  const a = new Date(join), b = new Date();
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months--;
  if (months < 1) return 'Yeni üye';
  const y = Math.floor(months / 12), m = months % 12;
  return [y ? `${y} yıl` : '', m ? `${m} ay` : ''].filter(Boolean).join(' ');
}

// ---------------- avatar
export function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toLocaleUpperCase(TR) || '').join('') || '?';
}
export function avatar(m, size = '') {
  if (m?.photo) return `<span class="avatar ${size}"><img src="${esc(m.photo)}" alt=""></span>`;
  return `<span class="avatar ${size}">${esc(initials(m?.full_name))}</span>`;
}

// ---------------- toast
export function toast(msg, type = 'ok') {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `${icon(type === 'err' ? 'x' : type === 'info' ? 'info' : 'check')}<span>${esc(msg)}</span>`;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, type === 'err' ? 4500 : 2600);
}

// ---------------- modal
export function modal({ title, body, submitText = 'Kaydet', cancelText = 'Vazgeç', danger = false, wide = false, onSubmit, onOpen, hideFooter = false }) {
  return new Promise((resolve) => {
    const root = $('#modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `
      <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true">
        <form class="modal-form" novalidate>
          <header class="modal-head"><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-close aria-label="Kapat">${icon('x')}</button></header>
          <div class="modal-body">${body}</div>
          ${hideFooter ? '' : `<footer class="modal-foot">
            <button type="button" class="btn btn-ghost" data-close>${esc(cancelText)}</button>
            <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(submitText)}</button>
          </footer>`}
        </form>
      </div>`;
    root.appendChild(wrap);
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => wrap.classList.add('show'));
    const form = $('form', wrap);
    const close = (val) => {
      wrap.classList.remove('show');
      setTimeout(() => { wrap.remove(); if (!$('.modal-wrap', root)) document.body.classList.remove('no-scroll'); }, 200);
      document.removeEventListener('keydown', onKey);
      resolve(val);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    $$('[data-close]', wrap).forEach(b => b.addEventListener('click', () => close(null)));
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(null); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const btn = $('button[type=submit]', form);
      try {
        btn && (btn.disabled = true, btn.classList.add('loading'));
        const data = Object.fromEntries(new FormData(form).entries());
        const result = onSubmit ? await onSubmit(data, form) : data;
        if (result !== false) close(result ?? true);
      } catch (err) {
        toast(err.message || String(err), 'err');
      } finally {
        btn && (btn.disabled = false, btn.classList.remove('loading'));
      }
    });
    onOpen && onOpen(wrap, close);
    const first = $('input:not([type=hidden]):not([type=checkbox]), select, textarea', wrap);
    if (first && window.matchMedia('(pointer:fine)').matches) setTimeout(() => first.focus(), 60);
  });
}

export const confirmDialog = (title, message, { danger = true, submitText = 'Evet, devam et' } = {}) =>
  modal({ title, body: `<p class="confirm-text">${esc(message)}</p>`, submitText, danger });

// ---------------- dosya
export function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(v => {
    const s = String(v ?? '');
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function resizeImage(file, max = 240, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      // ortadan kare kırp ve küçült
      const side = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = c.height = Math.min(max, side);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Görsel okunamadı.')); };
    img.src = url;
  });
}

export function debounce(fn, ms = 200) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const emptyState = (iconName, title, text = '', action = '') => `
  <div class="empty">
    <div class="empty-ic">${icon(iconName)}</div>
    <h4>${esc(title)}</h4>
    ${text ? `<p>${esc(text)}</p>` : ''}
    ${action}
  </div>`;

export const telLink = (p) => p ? `<a href="tel:${esc(String(p).replace(/[^\d+]/g, ''))}">${esc(p)}</a>` : '—';
