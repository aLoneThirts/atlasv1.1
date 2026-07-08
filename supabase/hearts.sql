-- ============================================================
-- ATLAS — can yönetimi: satın alma + zamanla yenileme + anlık düşme
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (schema.sql + finish_quiz.sql'den SONRA çalıştırılır; tekrar çalıştırmak güvenlidir.)
--
-- Tek/global can havuzu: profiles.hearts (0-5), 7 dersin TAMAMI için ortak —
-- ders bazlı ayrı bir can sistemi yok.
--
-- KARAR GEÇMİŞİ (kafa karışıklığını önlemek için): 8 saatte 1 can zamanla
-- yenileme önce eklendi, sonra "olmasın" denilip tamamen kaldırıldı, sonra
-- TEKRAR istendi (2026-07-08, aynı gün) — bu kez kullanıcı arayüzünde
-- görünür bir geri sayımla birlikte. Şu anki NİHAİ davranış:
--   - Can maks. 5, herkes için aynı (premium dahil).
--   - Zamanla yenileme: 8 saatte 1 can (calc_regen_hearts/get_hearts).
--   - Yanlış cevapta can ANINDA düşer (lose_heart) — quiz bitmesini beklemez.
--   - Ekstra can iyzico ile satın alınca anlık 5/5 doldurur (refill_hearts).
-- ============================================================

create or replace function public.refill_hearts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  update profiles
     set hearts = 5,
         hearts_updated_at = now()
   where id = v_user;

  return jsonb_build_object('hearts', 5);
end $$;

grant execute on function public.refill_hearts() to authenticated;

-- ============================================================
-- calc_regen_hearts: saf hesap fonksiyonu, tabloya dokunmaz. Geçen süreden
-- kaç tam 8 saatlik periyot geçtiyse o kadar can ekler (5'te tavanlar).
-- Tavana ulaşılmadıysa updated_at, TÜKETİLEN periyot kadar ileri alınır
-- (kalan kısmi ilerleme kaybolmaz). Tavana ulaşıldıysa updated_at = now()
-- (bir sonraki düşüşün geri sayımı buradan başlasın).
-- ============================================================

create or replace function public.calc_regen_hearts(
  p_hearts int,
  p_updated_at timestamptz
) returns table(hearts int, updated_at timestamptz)
language sql
stable
as $$
  select
    least(5, p_hearts + periods)::int as hearts,
    case
      when p_hearts + periods >= 5 then now()
      else p_updated_at + (periods * interval '8 hours')
    end as updated_at
  from (
    -- greatest(0, ...): hearts_updated_at ileride bir yanlışlıkla şimdiden
    -- sonraki bir zamana yazılırsa (olmamalı ama savunma amaçlı) periods
    -- negatif çıkıp canı haksız yere düşürmesin
    select greatest(0, floor(extract(epoch from (now() - p_updated_at)) / (8 * 3600)))::int as periods
  ) s;
$$;

-- get_hearts(): client'ın kale/quiz ekranlarını açarken çağırdığı, regen'i
-- hesaplayıp kalıcı hale getiren ve geri sayım için next_heart_at döndüren RPC.
create or replace function public.get_hearts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user         uuid := auth.uid();
  v_hearts       int;
  v_updated_at   timestamptz;
  v_new_hearts   int;
  v_new_updated  timestamptz;
begin
  if v_user is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  select hearts, hearts_updated_at into v_hearts, v_updated_at
  from profiles where id = v_user
  for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  select hearts, updated_at into v_new_hearts, v_new_updated
  from calc_regen_hearts(v_hearts, v_updated_at);

  if v_new_hearts is distinct from v_hearts or v_new_updated is distinct from v_updated_at then
    update profiles set hearts = v_new_hearts, hearts_updated_at = v_new_updated where id = v_user;
  end if;

  return jsonb_build_object(
    'hearts', v_new_hearts,
    'hearts_updated_at', v_new_updated,
    'next_heart_at', case when v_new_hearts < 5 then v_new_updated + interval '8 hours' else null end
  );
end $$;

grant execute on function public.get_hearts() to authenticated;

-- ============================================================
-- lose_heart(): can ANINDA (quiz bitmeden) düşer — önce bekleyen regen'i
-- uygular (aksi halde birikmiş bir can haksız yere kaybolurdu), SONRA 1
-- düşürür. ÖNEMLİ: geri sayım (hearts_updated_at) BURADA SIFIRLANMAZ —
-- yalnız calc_regen_hearts'ın hesapladığı değeri kullanır. Önceki sürümde
-- burada now()'a resetleniyordu; bu, "sıradaki can" sayacının her yanlış
-- cevapta 8 saate GERİ SIÇRAMASI" gibi görünmesine sebep oluyordu (kullanıcı
-- bildirdi) — halbuki tavana ulaşılmadıkça mevcut ilerlemenin bozulmaması
-- gerekiyordu. Quiz yarıda bırakılsa bile can kaybı DB'de kalıcıdır
-- (finish_quiz artık canı kendisi düşürmüyor, yalnız günceli okuyup raporluyor).
-- ============================================================

create or replace function public.lose_heart()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_hearts      int;
  v_updated_at  timestamptz;
  v_new_hearts  int;
  v_new_updated timestamptz;
begin
  if v_user is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  select hearts, hearts_updated_at into v_hearts, v_updated_at
  from profiles where id = v_user
  for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  select hearts, updated_at into v_new_hearts, v_new_updated
  from calc_regen_hearts(v_hearts, v_updated_at);

  v_new_hearts := greatest(0, v_new_hearts - 1);

  update profiles set hearts = v_new_hearts, hearts_updated_at = v_new_updated where id = v_user;

  return jsonb_build_object('hearts', v_new_hearts);
end $$;

grant execute on function public.lose_heart() to authenticated;
