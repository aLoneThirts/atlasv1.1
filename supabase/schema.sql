-- ============================================================
-- ATLAS — Supabase şeması (v1)
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- Kaynak kararlar: atlas_fable_brief.md + prototip (index.html)
-- ============================================================

-- ------------------------------------------------------------
-- PROFİL — auth.users'a 1:1
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,                   -- benzersiz (bkz. aşağıdaki index) — kayıt formunda/onboarding'de seçilir
  first_name text,
  last_name text,
  exam_track text not null default 'tyt' check (exam_track in ('tyt','tyt_ayt_ea')),
  target_university text,          -- örn. "Boğaziçi"
  target_department text,          -- örn. "İktisat"
  exam_date date,                  -- geri sayım için
  hearts int not null default 5 check (hearts between 0 and 5),
  hearts_updated_at timestamptz not null default now(),  -- zamanla can yenileme
  streak_count int not null default 0,
  streak_updated_on date,          -- son seri günü (gün atlanırsa sıfırla)
  daily_xp_goal int not null default 200,
  is_premium boolean not null default false,  -- monetizasyon: sadece Tarih ücretsiz
  expo_push_token text,            -- Pazar bildirimi için
  onboarding_completed boolean not null default false,  -- hedef okul/bölüm ekranı gösterildi mi
  ads_removed boolean not null default false,  -- reklamsız satın alma (premium'dan bağımsız)
  created_at timestamptz not null default now()
);

-- Client'ın doğrudan UPDATE edebileceği kolonları daralt — is_premium/ads_removed/
-- hearts/streak_*/exam_track gibi hassas alanlar yalnız SECURITY DEFINER RPC'lerle
-- (finish_quiz, refill_hearts, dev_set_premium, dev_set_ads_removed) değişir.
-- Aksi halde RLS yalnız satır sahipliğini kontrol ettiğinden herkes kendine
-- client'tan direkt premium/can verebilirdi.
revoke update on public.profiles from authenticated;
grant update (
  username,
  first_name,
  last_name,
  target_university,
  target_department,
  exam_date,
  daily_xp_goal,
  expo_push_token,
  onboarding_completed
) on public.profiles to authenticated;

-- v1 PLACEHOLDER — gerçek RevenueCat webhook'u kurulunca bunların yerini bir
-- Edge Function (service_role ile) alacak; client bu RPC'leri hiç çağırmayacak.
-- Şimdilik atlas-mobile/src/lib/purchases.ts "test modu" uyarısıyla çağırıyor
-- (gerçek ödeme doğrulaması YOK).
create or replace function public.dev_set_premium(active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles set is_premium = active where id = auth.uid();
end $$;

grant execute on function public.dev_set_premium(boolean) to authenticated;

create or replace function public.dev_set_ads_removed(active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles set ads_removed = active where id = auth.uid();
end $$;

grant execute on function public.dev_set_ads_removed(boolean) to authenticated;

-- username: küçük harf/rakam/alt çizgi, 3-20 karakter, case-insensitive benzersiz.
-- NOT VALID: yalnız bundan sonraki insert/update'lere uygulanır (eski/serbest
-- formatlı satırları geriye dönük doğrulamaz — bkz. supabase/username.sql).
alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$') not valid;

create unique index profiles_username_lower_idx on public.profiles (lower(username)) where username is not null;

-- Yeni kullanıcı kaydında profil satırı aç. username: kayıt formunda seçilen
-- ad (auth.signUp options.data.username) varsa o, yoksa e-posta önekinden
-- türetilir; format dışı karakterler temizlenir. Ad zaten alınmışsa (örn.
-- Google girişinde e-posta önekinden türetilirken çakışma) id'den türeyen bir
-- son ek eklenir — kayıt akışı ASLA bu yüzden kesilmez.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_raw        text;
  v_username   text;
  v_full_name  text;
  v_first_name text;
  v_last_name  text;
begin
  v_raw := lower(coalesce(new.raw_user_meta_data->>'username', split_part(coalesce(new.email, ''), '@', 1)));
  v_username := regexp_replace(v_raw, '[^a-z0-9_]', '', 'g');
  if v_username is null or length(v_username) < 3 then
    v_username := 'atlas' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  v_username := substr(v_username, 1, 20);

  -- first_name/last_name: önce bizim gönderdiğimiz metadata (email kayıt formu),
  -- yoksa Google'ın kendi gönderdiği given_name/family_name veya full_name/name
  -- (boşluktan bölünerek) — Google ile girenler onboarding'de adını yeniden
  -- yazmak zorunda kalmasın.
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name');
  v_first_name := coalesce(
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'given_name',
    nullif(split_part(v_full_name, ' ', 1), '')
  );
  v_last_name := coalesce(
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'family_name',
    nullif(regexp_replace(v_full_name, '^\S+\s*', ''), '')
  );

  begin
    insert into public.profiles (id, username, first_name, last_name)
    values (new.id, v_username, v_first_name, v_last_name);
  exception when unique_violation then
    insert into public.profiles (id, username, first_name, last_name)
    values (
      new.id,
      substr(v_username, 1, 13) || '_' || substr(replace(new.id::text, '-', ''), 1, 6),
      v_first_name,
      v_last_name
    );
  end;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Kayıt ekranının canlı kullanılabilirlik kontrolü için — profiles RLS
-- "sadece sahibi" olduğundan client başka satırları SELECT edemiyor; bu RPC
-- yalnız var/yok bilgisini (boolean) döndürür, başka veri sızdırmaz.
create or replace function public.is_username_available(check_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(trim(check_username))
  );
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;

-- ------------------------------------------------------------
-- İÇERİK — ders (kale) > bölüm > konu > soru / bilgi kartı
-- ------------------------------------------------------------
create table public.subjects (
  id text primary key,             -- 'tarih','turkce','cografya','felsefe','fizik','kimya','biyoloji','edebiyat'
  name text not null,
  emoji text not null,
  color text not null,             -- ana renk (hex)
  color_dark text not null,        -- gölge rengi (hex)
  exam_type text not null check (exam_type in ('tyt','ayt')),
  is_free boolean not null default false,
  sort_order int not null default 0
);

create table public.units (        -- "Bölüm 1 — Kuruluş Dönemi"
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects(id) on delete cascade,
  title text not null,
  sort_order int not null
);

create table public.topics (       -- "Ankara Savaşı ve Fetret Devri"
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  title text not null,
  sort_order int not null
);

create table public.questions (    -- çoktan seçmeli (A-E)
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  prompt text not null,
  options jsonb not null,          -- ["şık A", "şık B", ...] tam 5 eleman
  correct_index int not null check (correct_index between 0 and 4),
  explanation text,
  difficulty int not null default 2 check (difficulty between 1 and 3)
);

create table public.flashcards (   -- yazılı cevaplı bilgi kartları
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  prompt text not null,
  answer text not null,            -- gösterilecek cevap: "Çelebi Mehmed"
  accepted_answers text[] not null, -- normalize eşleşme listesi: {'çelebi','celebi',...}
  explanation text
);

-- ------------------------------------------------------------
-- KULLANICI İLERLEMESİ
-- ------------------------------------------------------------
create table public.topic_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  status text not null default 'locked' check (status in ('locked','active','done')),
  stars int not null default 0 check (stars between 0 and 3),
  completed_at timestamptz,
  primary key (user_id, topic_id)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  mode text not null check (mode in ('topic','weekly','single','flashcards')),
  correct_count int not null default 0,
  wrong_count int not null default 0,
  xp_earned int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Yanlış havuzu — Yanlışlarım ekranı + haftalık sınavın kaynağı
create table public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  wrong_answer_index int,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,         -- doğru çözülünce dolar
  unique (user_id, question_id)
);
create index mistakes_user_open_idx on public.mistakes (user_id) where resolved_at is null;

create table public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null,
  reason text,                     -- 'quiz','flashcards','weekly_exam'...
  created_at timestamptz not null default now()
);
create index xp_events_user_day_idx on public.xp_events (user_id, created_at);

-- ------------------------------------------------------------
-- KOÇ — sohbet + deneme sonuçları (DeepSeek entegrasyonu Edge Function'da)
-- ------------------------------------------------------------
create table public.coach_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user','coach')),
  content text not null,
  created_at timestamptz not null default now()
);
create index coach_messages_user_idx on public.coach_messages (user_id, created_at);

create table public.mock_exams (   -- deneme sonuçları
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  taken_on date not null default current_date,
  nets jsonb not null,             -- {"turkce":32.5,"tarih":7,"cografya":6,...}
  notes text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- HAFTALIK MİNİ SINAV — her Pazar cron ile kurulur + push atılır
-- (pg_cron ya da Supabase Scheduled Edge Function; aşağıdaki nota bak)
-- ------------------------------------------------------------
create table public.weekly_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,        -- o haftanın pazartesi'si
  question_ids uuid[] not null,    -- o haftanın çözülmemiş yanlışlarından 5 soru
  notified_at timestamptz,         -- Pazar push'u atıldığında dolar
  completed_at timestamptz,
  correct_count int,
  unique (user_id, week_start)
);

-- ------------------------------------------------------------
-- RLS — herkes kendi verisini görür; içerik tabloları herkese açık (okuma)
-- ------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.subjects       enable row level security;
alter table public.units          enable row level security;
alter table public.topics         enable row level security;
alter table public.questions      enable row level security;
alter table public.flashcards     enable row level security;
alter table public.topic_progress enable row level security;
alter table public.quiz_attempts  enable row level security;
alter table public.mistakes       enable row level security;
alter table public.xp_events      enable row level security;
alter table public.coach_messages enable row level security;
alter table public.mock_exams     enable row level security;
alter table public.weekly_exams   enable row level security;

-- içerik: oturum açan herkes okur, yazma sadece service_role (dashboard/seed)
create policy "content read" on public.subjects   for select to authenticated using (true);
create policy "content read" on public.units      for select to authenticated using (true);
create policy "content read" on public.topics     for select to authenticated using (true);
create policy "content read" on public.questions  for select to authenticated using (true);
create policy "content read" on public.flashcards for select to authenticated using (true);

-- kullanıcı verisi: sadece sahibi
create policy "own profile"   on public.profiles       for all using (auth.uid() = id)      with check (auth.uid() = id);
create policy "own progress"  on public.topic_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own attempts"  on public.quiz_attempts  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own mistakes"  on public.mistakes       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own xp"        on public.xp_events      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own coach"     on public.coach_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own mocks"     on public.mock_exams     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own weekly"    on public.weekly_exams   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- SEED — dersler (kaleler)
-- ------------------------------------------------------------
insert into public.subjects (id, name, emoji, color, color_dark, exam_type, is_free, sort_order) values
  ('felsefe',  'Felsefe',  '🧠', '#8E44AD', '#5B2C73', 'tyt', false, 1),
  ('cografya', 'Coğrafya', '🌍', '#27AE60', '#145A32', 'tyt', false, 2),
  ('fizik',    'Fizik',    '⚛️', '#2980B9', '#1A5276', 'tyt', false, 3),
  ('kimya',    'Kimya',    '🧪', '#16A085', '#0E6655', 'tyt', false, 4),
  ('biyoloji', 'Biyoloji', '🧬', '#7CB342', '#33691E', 'tyt', false, 5),
  ('turkce',   'Türkçe',   '📖', '#E74C3C', '#922B21', 'tyt', false, 6),
  ('tarih',    'Tarih',    '⚔️', '#E67E22', '#A04000', 'tyt', true,  7),  -- ücretsiz ders
  ('edebiyat', 'Edebiyat', '📚', '#C0392B', '#7B241C', 'ayt', false, 10);

-- ============================================================
-- NOT — Haftalık sınav cron'u (ayrı adım, dashboard'dan):
-- 1) Edge Function "weekly-exam" yaz: her kullanıcı için o haftanın
--    çözülmemiş mistakes kayıtlarından 5 soru seç → weekly_exams'e yaz
--    → expo_push_token'a Expo Push API ile bildirim gönder.
-- 2) Zamanlama: Dashboard > Edge Functions > Schedules
--    cron: "0 9 * * 0"  (her Pazar 09:00 UTC ≈ 12:00 TR)
-- ============================================================
