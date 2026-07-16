-- ============================================================
-- ATLAS — uygulama içi bildirim gelen kutusu (Bildirimler ekranı)
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (schema.sql'den SONRA, badges.sql'den ÖNCE çalıştırılır — badges.sql'deki
-- check_and_award_badges() RPC'si bu tabloya satır ekliyor.)
--
-- Yazma yalnız SECURITY DEFINER RPC'ler (badges.sql) veya service-role
-- Edge Function'lar (streak-reminder) üzerinden yapılır (BACKEND.md §7) —
-- authenticated'a insert GRANT'ı bilerek YOK, yalnız kendi bildirimini
-- okuma + okundu işaretleme (read_at update) izni var.
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title text not null,
  body text not null,
  route text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "own notifications select" on public.notifications
  for select using (auth.uid() = user_id);

create policy "own notifications mark read" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
