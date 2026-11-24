-- =====================================================================
--  GÜN SONU OTOMATİK RAPOR — her gün 23:30 (Türkiye saati) çalışır
--  O gün biten her etkinlik için angorariders@gmail.com adresine rapor gider.
--
--  Çalıştırmadan önce aşağıdaki 2 değeri değiştirin:
--    PROJE-ID      -> Supabase proje kimliğiniz (ör. abcdxyz)
--    GIZLI-ANAHTAR -> Edge Function'a CRON_SECRET olarak verdiğiniz değer
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- varsa eski görevi kaldır
select cron.unschedule(jobid) from cron.job where jobname = 'angora-gun-sonu-raporu';

-- 20:30 UTC = 23:30 Türkiye
select cron.schedule(
  'angora-gun-sonu-raporu',
  '30 20 * * *',
  $$
  select net.http_post(
    url     := 'https://PROJE-ID.supabase.co/functions/v1/send-report',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'GIZLI-ANAHTAR'),
    body    := '{"mode":"daily"}'::jsonb
  );
  $$
);
