-- ============================================================
-- ATLAS — kullanıcı adı (username) benzersizliği + kayıt akışı
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (schema.sql'den SONRA çalıştırılır; tekrar çalıştırmak güvenlidir.)
--
-- Neden gerekli: YKS öğrencilerinin birbirini kullanıcı adıyla ekleyebilmesi
-- için username artık benzersiz ve kayıt formunda seçilebilir olmalı.
-- Önceden username = e-postanın '@' öncesi kısmıydı (rastgele/çakışabilir).
-- ============================================================

-- 1) Mevcut satırlarda aynı kullanıcı adına sahip olanları (case-insensitive)
--    ilk oluşturulan hariç benzersizleştir — unique index'in patlamaması için.
with dupes as (
  select id, username,
         row_number() over (partition by lower(username) order by created_at) as rn
  from public.profiles
  where username is not null
)
update public.profiles p
set username = substr(p.username, 1, 13) || '_' || substr(replace(p.id::text, '-', ''), 1, 6)
from dupes d
where p.id = d.id and d.rn > 1;

-- 2) Format: küçük harf, rakam, alt çizgi, 3-20 karakter. NOT VALID → eski
--    (bozuk/serbest formatlı) satırları geriye dönük doğrulamaz, sadece
--    bundan sonraki insert/update'lere uygulanır.
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$') not valid;

-- 3) Benzersizlik (case-insensitive).
drop index if exists profiles_username_lower_idx;
create unique index profiles_username_lower_idx on public.profiles (lower(username)) where username is not null;

-- 4) Yeni kullanıcı tetikleyicisi: kayıt formunda seçilen username'i kullan
--    (auth.signUp options.data.username), yoksa e-posta önekinden türet.
--    Türetilen/gönderilen ad formatı bozuyorsa temizlenir; benzersizlik
--    çakışırsa id'den türeyen bir son ek eklenip kayıt YİNE DE tamamlanır
--    (Google girişinde kullanıcı henüz ad seçmemiş olabilir — akış kesilmez).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_raw      text;
  v_username text;
begin
  v_raw := lower(coalesce(new.raw_user_meta_data->>'username', split_part(coalesce(new.email, ''), '@', 1)));
  v_username := regexp_replace(v_raw, '[^a-z0-9_]', '', 'g');
  if v_username is null or length(v_username) < 3 then
    v_username := 'atlas' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  v_username := substr(v_username, 1, 20);

  begin
    insert into public.profiles (id, username) values (new.id, v_username);
  exception when unique_violation then
    insert into public.profiles (id, username)
    values (new.id, substr(v_username, 1, 13) || '_' || substr(replace(new.id::text, '-', ''), 1, 6));
  end;
  return new;
end $$;

-- 5) Kayıt ekranının canlı kullanılabilirlik kontrolü için — profiles RLS
--    "sadece sahibi" olduğundan client başka satırları SELECT edemiyor;
--    bu RPC yalnız var/yok bilgisini (boolean) döndürür, başka veri sızdırmaz.
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
