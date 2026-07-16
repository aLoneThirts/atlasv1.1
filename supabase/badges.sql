-- ============================================================
-- ATLAS — rozet/başarım sistemi
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (schema.sql + notifications.sql'den SONRA çalıştırılır; tekrar çalıştırmak
-- güvenlidir — "insert ... on conflict do nothing" ile katalog idempotent.)
--
-- badges: sabit katalog, uygulama koduna bağlı, elle yönetilir.
-- user_badges: kullanıcının kazandığı rozetler — KALICI (sonradan streak
-- sıfırlansa bile rozet elinden alınmaz, yalnız yeni kazanım eklenir).
-- check_and_award_badges(): profildeki güncel istatistikleri (seri, toplam
-- XP, fethedilen konu sayısı, temizlenen yanlış sayısı) rozet eşikleriyle
-- karşılaştırır, yeni hak edilenleri user_badges'e ekler + notifications'a
-- bildirim düşer, yeni kazanılanları döner (client kutlama popup'ı gösterir).
-- Ev yüklenişinde ve her quiz bitişinde çağrılmalı.
-- ============================================================

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null,
  description text not null,
  emoji text not null,
  threshold_type text not null check (threshold_type in ('streak', 'topics_done', 'total_xp', 'mistakes_resolved')),
  threshold_value int not null,
  sort_order int not null default 0
);

alter table public.badges enable row level security;
create policy "content read" on public.badges for select to authenticated using (true);
grant select on public.badges to authenticated;

insert into public.badges (key, title, description, emoji, threshold_type, threshold_value, sort_order) values
  ('seri_3',    '3 Gün Seri',           'Art arda 3 gün çalış',    '🔥', 'streak',            3,    1),
  ('seri_7',    '7 Gün Seri',           'Art arda 7 gün çalış',    '🔥', 'streak',            7,    2),
  ('seri_30',   '30 Gün Seri',          'Art arda 30 gün çalış',   '🔥', 'streak',            30,   3),
  ('ilk_kale',  'İlk Kale',             'İlk konuyu fethet',       '🏰', 'topics_done',       1,    4),
  ('bes_kale',  '5 Konu Fethedildi',    '5 konuyu fethet',         '🏯', 'topics_done',       5,    5),
  ('yirmi_kale','20 Konu Fethedildi',   '20 konuyu fethet',        '🏆', 'topics_done',       20,   6),
  ('xp_500',    '500 XP',               'Toplam 500 XP kazan',     '⭐', 'total_xp',          500,  7),
  ('xp_2000',   '2000 XP',              'Toplam 2000 XP kazan',    '🌟', 'total_xp',          2000, 8),
  ('yanlis_10', '10 Yanlış Temizlendi', '10 yanlışını çöz',        '🧹', 'mistakes_resolved', 10,   9),
  ('yanlis_50', '50 Yanlış Temizlendi', '50 yanlışını çöz',        '🧹', 'mistakes_resolved', 50,   10)
on conflict (key) do nothing;

create table if not exists public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

alter table public.user_badges enable row level security;
create policy "own badges select" on public.user_badges for select using (auth.uid() = user_id);
grant select on public.user_badges to authenticated;
-- NOT: insert için authenticated'a GRANT verilmiyor — yazma yalnız aşağıdaki
-- SECURITY DEFINER RPC üzerinden (BACKEND.md §7 kuralı, hearts.sql/finish_quiz.sql
-- ile aynı desen).

create or replace function public.check_and_award_badges()
returns setof public.badges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_streak int;
  v_total_xp int;
  v_topics_done int;
  v_mistakes_resolved int;
  r record;
begin
  if v_user is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  select streak_count into v_streak from profiles where id = v_user;
  select coalesce(sum(amount), 0) into v_total_xp from xp_events where user_id = v_user;
  select count(*) into v_topics_done from topic_progress where user_id = v_user and status = 'done';
  select count(*) into v_mistakes_resolved from mistakes where user_id = v_user and resolved_at is not null;

  for r in
    select b.* from public.badges b
    where not exists (select 1 from public.user_badges ub where ub.user_id = v_user and ub.badge_id = b.id)
      and (
        (b.threshold_type = 'streak' and coalesce(v_streak, 0) >= b.threshold_value) or
        (b.threshold_type = 'topics_done' and v_topics_done >= b.threshold_value) or
        (b.threshold_type = 'total_xp' and v_total_xp >= b.threshold_value) or
        (b.threshold_type = 'mistakes_resolved' and v_mistakes_resolved >= b.threshold_value)
      )
  loop
    insert into public.user_badges (user_id, badge_id) values (v_user, r.id);
    insert into public.notifications (user_id, title, body, route)
      values (v_user, '🏅 Yeni Rozet: ' || r.title, r.description, '/');
    return next r;
  end loop;
  return;
end $$;

grant execute on function public.check_and_award_badges() to authenticated;
