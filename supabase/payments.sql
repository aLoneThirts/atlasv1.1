-- ============================================================
-- ATLAS — payments audit tablosu (iyzico entegrasyonu, BACKEND.md §7)
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (schema.sql'den SONRA; tekrar çalıştırmak güvenlidir.)
--
-- Her iyzico ödeme denemesinin kaydı — destek/hata ayıklama için tek kaynak
-- ("ödeme yaptım ama premium/can açılmadı" gibi taleplerde buradan bakılır).
-- Yalnız iyzico-pay Edge Function'ı (service_role) satır ekler/günceller;
-- kullanıcı yalnız kendi satırlarını okuyabilir, hiçbir şey yazamaz.
-- ============================================================

create table if not exists public.payments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  product           text not null check (product in ('hearts_refill', 'premium_monthly', 'premium_yearly', 'ads_removed')),
  amount            numeric(10, 2) not null,
  currency          text not null default 'TRY',
  status            text not null check (status in ('success', 'failed')),
  iyzico_payment_id text,
  conversation_id   text not null,
  error_message     text,
  raw_response      jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists payments_user_id_idx on public.payments (user_id, created_at desc);

alter table public.payments enable row level security;

drop policy if exists "own payments read" on public.payments;
create policy "own payments read" on public.payments for select using (auth.uid() = user_id);
