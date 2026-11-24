-- =====================================================================
--  ANGORA RIDERS - Grup Takip Sistemi  |  Supabase veritabanı şeması
--  Supabase > SQL Editor > New query  içine yapıştırıp RUN deyin.
--  (Tekrar çalıştırılabilir; mevcut verileri silmez.)
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- TABLOLAR
-- ---------------------------------------------------------------------

-- Sisteme giriş yapan hesaplar (kurucular & yöneticiler)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  full_name   text not null default '',
  role        text not null default 'admin' check (role in ('founder','admin')),
  permissions text[] not null default '{}',
  active      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Grup üyeleri
create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  nickname    text,
  phone       text,
  email       text,
  birth_date  date,
  join_date   date not null default current_date,
  motorcycle  text,
  plate       text,
  city        text,
  status      text not null default 'active' check (status in ('active','left')),
  photo       text,               -- küçük boyutlu base64 jpeg
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Hassas bilgiler (ayrı yetkiyle korunur)
create table if not exists public.member_private (
  member_id          uuid primary key references public.members(id) on delete cascade,
  blood_type         text,
  emergency_name     text,
  emergency_relation text,
  emergency_phone    text,
  health_notes       text,
  updated_at         timestamptz not null default now()
);

-- Takvim etkinlikleri
create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  type          text not null default 'ride',
  start_at      timestamptz not null,
  end_at        timestamptz,
  location      text,
  meeting_point text,
  distance_km   numeric,
  description   text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists events_start_idx on public.events(start_at);

-- Katılım (satır varsa = etkinliğe geldi)
create table if not exists public.attendance (
  event_id   uuid not null references public.events(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  marked_by  uuid references public.profiles(id) on delete set null,
  marked_at  timestamptz not null default now(),
  primary key (event_id, member_id)
);
create index if not exists attendance_member_idx on public.attendance(member_id);

-- Genel ayarlar (tek satır)
create table if not exists public.settings (
  id                int primary key default 1 check (id = 1),
  group_name        text not null default 'Angora Riders',
  active_threshold  int  not null default 60,   -- % ve üzeri: Aktif
  passive_threshold int  not null default 30,   -- % altı: Pasif
  updated_at        timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict do nothing;
alter table public.settings add column if not exists auto_report boolean not null default true;

-- Etkinlik bitiş raporu gönderildi mi?
alter table public.events add column if not exists report_sent_at timestamptz;

-- Gönderilen e-posta raporlarının kaydı (yalnızca sunucu fonksiyonu yazar)
create table if not exists public.report_log (
  id           bigint generated always as identity primary key,
  kind         text not null,              -- period | event | daily
  subject      text not null,
  recipient    text not null,
  sent_by      uuid references public.profiles(id) on delete set null,
  sent_by_name text,
  status       text not null default 'sent', -- sent | error
  error        text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- YETKİ FONKSİYONLARI
-- ---------------------------------------------------------------------
create or replace function public.is_founder() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active and role = 'founder');
$$;

create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and active and (role = 'founder' or p = any(permissions))
  );
$$;

create or replace function public.has_any(ps text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and active and (role = 'founder' or permissions && ps)
  );
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active);
$$;

-- İlk kurulum gerekiyor mu? (hiç kurucu yoksa true)
create or replace function public.setup_needed() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles where role = 'founder');
$$;
grant execute on function public.setup_needed() to anon, authenticated;

-- ---------------------------------------------------------------------
-- YENİ HESAP -> PROFİL (ilk hesap otomatik KURUCU olur)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare first_user boolean;
begin
  select not exists (select 1 from profiles where role = 'founder') into first_user;
  insert into profiles (id, username, full_name, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when first_user then 'founder' else 'admin' end,
    first_user                      -- sonraki hesaplar kurucu onayına kadar pasif
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Son aktif kurucunun yetkisi düşürülemez / pasif yapılamaz
create or replace function public.protect_last_founder() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'founder' and old.active and (new.role <> 'founder' or not new.active) then
    if (select count(*) from profiles where role = 'founder' and active and id <> old.id) = 0 then
      raise exception 'Sistemde en az bir aktif kurucu kalmalıdır.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect_founder on public.profiles;
create trigger profiles_protect_founder before update on public.profiles
  for each row execute function public.protect_last_founder();

-- updated_at
create or replace function public.touch_updated() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists members_touch on public.members;
create trigger members_touch before update on public.members for each row execute function public.touch_updated();
drop trigger if exists member_private_touch on public.member_private;
create trigger member_private_touch before update on public.member_private for each row execute function public.touch_updated();

-- ---------------------------------------------------------------------
-- KURUCU İŞLEMLERİ (RPC)
-- ---------------------------------------------------------------------
create or replace function public.admin_set_password(uid uuid, new_password text) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not public.is_founder() then raise exception 'Bu işlem için kurucu yetkisi gerekir.'; end if;
  if length(new_password) < 6 then raise exception 'Şifre en az 6 karakter olmalı.'; end if;
  update auth.users set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
         updated_at = now() where id = uid;
end $$;

create or replace function public.admin_delete_user(uid uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_founder() then raise exception 'Bu işlem için kurucu yetkisi gerekir.'; end if;
  if uid = auth.uid() then raise exception 'Kendi hesabınızı silemezsiniz.'; end if;
  if (select role from profiles where id = uid) = 'founder'
     and (select count(*) from profiles where role = 'founder' and active and id <> uid) = 0 then
    raise exception 'Son kurucu silinemez.';
  end if;
  delete from auth.users where id = uid;
end $$;

revoke execute on function public.admin_set_password(uuid, text) from anon;
revoke execute on function public.admin_delete_user(uuid) from anon;

-- ---------------------------------------------------------------------
-- SATIR BAZLI GÜVENLİK (RLS)
-- ---------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.members        enable row level security;
alter table public.member_private enable row level security;
alter table public.events         enable row level security;
alter table public.attendance     enable row level security;
alter table public.settings       enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_active_user());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (public.is_founder()) with check (public.is_founder());

-- members
drop policy if exists members_select on public.members;
create policy members_select on public.members for select
  using (public.has_any(array['members.view','attendance.view','attendance.mark','reports.view','dashboard.view']));
drop policy if exists members_insert on public.members;
create policy members_insert on public.members for insert with check (public.has_perm('members.create'));
drop policy if exists members_update on public.members;
create policy members_update on public.members for update
  using (public.has_perm('members.edit')) with check (public.has_perm('members.edit'));
drop policy if exists members_delete on public.members;
create policy members_delete on public.members for delete using (public.has_perm('members.delete'));

-- member_private
drop policy if exists mp_select on public.member_private;
create policy mp_select on public.member_private for select using (public.has_perm('members.sensitive'));
drop policy if exists mp_insert on public.member_private;
create policy mp_insert on public.member_private for insert
  with check (public.has_perm('members.sensitive') and public.has_any(array['members.create','members.edit']));
drop policy if exists mp_update on public.member_private;
create policy mp_update on public.member_private for update
  using (public.has_perm('members.sensitive') and public.has_any(array['members.create','members.edit']))
  with check (public.has_perm('members.sensitive') and public.has_any(array['members.create','members.edit']));

-- events
drop policy if exists events_select on public.events;
create policy events_select on public.events for select
  using (public.has_any(array['events.view','attendance.view','attendance.mark','reports.view','dashboard.view','members.view']));
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert with check (public.has_perm('events.create'));
drop policy if exists events_update on public.events;
create policy events_update on public.events for update
  using (public.has_perm('events.edit')) with check (public.has_perm('events.edit'));
drop policy if exists events_delete on public.events;
create policy events_delete on public.events for delete using (public.has_perm('events.delete'));

-- attendance
drop policy if exists att_select on public.attendance;
create policy att_select on public.attendance for select
  using (public.has_any(array['attendance.view','attendance.mark','reports.view','dashboard.view','members.view']));
drop policy if exists att_insert on public.attendance;
create policy att_insert on public.attendance for insert with check (public.has_perm('attendance.mark'));
drop policy if exists att_delete on public.attendance;
create policy att_delete on public.attendance for delete using (public.has_perm('attendance.mark'));

-- report_log (okuma: rapor yetkisi; yazma: sadece sunucu fonksiyonu / service role)
alter table public.report_log enable row level security;
drop policy if exists report_log_select on public.report_log;
create policy report_log_select on public.report_log for select
  using (public.has_any(array['reports.view','reports.email']));

-- settings
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select using (public.is_active_user());
drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings for update
  using (public.has_perm('settings.manage')) with check (public.has_perm('settings.manage'));
