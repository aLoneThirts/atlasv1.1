-- ============================================================
-- ATLAS — Koç sohbetine ayrı konuşma oturumları (thread) desteği
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (schema.sql'den SONRA; tekrar çalıştırmak güvenlidir.)
--
-- ÖNCEKİ DAVRANIŞ: coach_messages kullanıcı başına TEK sürekli akan bir
-- geçmişti — "yeni sohbet başlat" ya da "eski bir konuşmaya geri dön" diye
-- bir kavram yoktu (kullanıcı isteği: gerçek bir AI chat uygulaması gibi
-- geçmiş konuşma listesi + Yeni Sohbet butonu). Bu dosya coach_messages'a
-- conversation_id ekliyor; mevcut satırlar kullanıcı başına TEK bir "eski
-- sohbet" grubuna atanıyor (geriye dönük veri kaybı yok, tek konuşma olarak
-- görünmeye devam eder), sıradaki client kodu her yeni sohbette kendi
-- crypto.randomUUID()'ini üretip gönderiyor.
-- ============================================================

alter table public.coach_messages add column if not exists conversation_id uuid;

-- Mevcut satırları kullanıcı başına tek bir gruba ata (yalnız conversation_id
-- NULL olanlar için — tekrar çalıştırıldığında zaten atanmışları BOZMAZ).
update public.coach_messages cm
set conversation_id = sub.legacy_id
from (
  select user_id, gen_random_uuid() as legacy_id
  from public.coach_messages
  where conversation_id is null
  group by user_id
) sub
where cm.user_id = sub.user_id
  and cm.conversation_id is null;

alter table public.coach_messages alter column conversation_id set not null;
alter table public.coach_messages alter column conversation_id set default gen_random_uuid();

create index if not exists coach_messages_conversation_idx
  on public.coach_messages (user_id, conversation_id, created_at);

-- Geçmiş konuşmalar listesi — Koç ekranındaki 🕘 geçmiş panelinde kullanılır.
-- İlk kullanıcı mesajını "başlık" olarak, son mesaj zamanını ve mesaj
-- sayısını döner; en son konuşulan en üstte.
create or replace function public.list_coach_conversations()
returns table (
  conversation_id uuid,
  first_message text,
  last_message_at timestamptz,
  message_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cm.conversation_id,
    (array_agg(cm.content order by cm.created_at asc) filter (where cm.role = 'user'))[1] as first_message,
    max(cm.created_at) as last_message_at,
    count(*) as message_count
  from public.coach_messages cm
  where cm.user_id = auth.uid()
  group by cm.conversation_id
  order by max(cm.created_at) desc;
$$;

grant execute on function public.list_coach_conversations() to authenticated;
