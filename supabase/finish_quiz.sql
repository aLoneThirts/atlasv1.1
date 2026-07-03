-- ============================================================
-- ATLAS — finish_quiz RPC (BACKEND.md §6.1)
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (schema.sql'den SONRA çalıştırılır; tekrar çalıştırmak güvenlidir.)
--
-- Quiz bitişini TEK transaction'da işler:
--   1. quiz_attempts satırı
--   2. yanlışlar → mistakes upsert; single/weekly'de doğru çözülen → resolved_at
--   3. can düşme (premium hariç, 0 altına inmez; flashcards can yakmaz)
--   4. XP: doğru × 9 → xp_events
--   5. topic modunda: topic_progress done + yıldız, sıradaki konu active
--   6. streak güncelle (gün sınırı Europe/Istanbul)
--   7. weekly modunda: bu haftanın weekly_exams satırını tamamla
--
-- Kullanıcı JWT'den (auth.uid()) alınır — parametreden ASLA user_id alınmaz.
-- ============================================================

create or replace function public.finish_quiz(
  p_topic_id uuid,          -- weekly/single modda null olabilir
  p_mode     text,          -- 'topic' | 'weekly' | 'single' | 'flashcards'
  p_answers  jsonb          -- [{question_id, selected_index, correct}] listesi
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_total       int;
  v_correct     int;
  v_wrong       int;
  v_xp          int;
  v_stars       int := null;
  v_hearts      int;
  v_premium     boolean;
  v_streak      int;
  v_streak_on   date;
  v_today_tr    date := (now() at time zone 'Europe/Istanbul')::date;
  v_week_start  date := date_trunc('week', (now() at time zone 'Europe/Istanbul'))::date;
  v_subject_id  text;
  v_is_free     boolean;
  v_next_topic  uuid;
  v_ans         jsonb;
begin
  if v_user is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  if p_mode not in ('topic','weekly','single','flashcards') then
    raise exception 'invalid_mode: %', p_mode;
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) = 0 then
    raise exception 'invalid_answers';
  end if;

  if p_mode = 'topic' and p_topic_id is null then
    raise exception 'topic_required';
  end if;

  select correct_n, total_n - correct_n, total_n
    into v_correct, v_wrong, v_total
  from (
    select count(*) filter (where (a->>'correct')::boolean) as correct_n,
           count(*) as total_n
    from jsonb_array_elements(p_answers) a
  ) s;

  select hearts, is_premium, streak_count, streak_updated_on
    into v_hearts, v_premium, v_streak, v_streak_on
  from profiles where id = v_user
  for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  -- Premium içerik sunucu tarafında da doğrulanır (BACKEND.md §7)
  if p_mode = 'topic' then
    select s.id, s.is_free into v_subject_id, v_is_free
    from topics t
    join units u on u.id = t.unit_id
    join subjects s on s.id = u.subject_id
    where t.id = p_topic_id;

    if v_subject_id is null then
      raise exception 'topic_not_found';
    end if;
    if not v_is_free and not v_premium then
      raise exception 'premium_required' using errcode = '42501';
    end if;
  end if;

  -- 1) quiz oturumu
  insert into quiz_attempts (user_id, topic_id, mode, correct_count, wrong_count, xp_earned, finished_at)
  values (v_user, p_topic_id, p_mode, v_correct, v_wrong, v_correct * 9, now());

  -- 2) yanlış havuzu (flashcards soruları questions tablosunda değil → atla)
  if p_mode <> 'flashcards' then
    for v_ans in select * from jsonb_array_elements(p_answers) loop
      if (v_ans->>'question_id') is null then
        continue;
      end if;
      if (v_ans->>'correct')::boolean then
        -- Yanlış havuzundaki soru single/weekly'de doğru çözülürse temizlenir
        -- (§4.6 single; §4.7: haftalık sınav "bekleyenleri çözme" işini üstlenir)
        if p_mode in ('single','weekly') then
          update mistakes
             set resolved_at = now()
           where user_id = v_user
             and question_id = (v_ans->>'question_id')::uuid
             and resolved_at is null;
        end if;
      else
        insert into mistakes (user_id, question_id, wrong_answer_index)
        values (v_user, (v_ans->>'question_id')::uuid, nullif(v_ans->>'selected_index','')::int)
        on conflict (user_id, question_id) do update
          set wrong_answer_index = excluded.wrong_answer_index,
              created_at = now(),
              resolved_at = null;
      end if;
    end loop;
  end if;

  -- 3) can düşme — premium sınırsız (§4.1); flashcards can yakmaz
  if not v_premium and p_mode <> 'flashcards' and v_wrong > 0 then
    v_hearts := greatest(0, v_hearts - v_wrong);
    update profiles set hearts = v_hearts, hearts_updated_at = now() where id = v_user;
  end if;

  -- 4) XP — doğru başına 9 (§4.3)
  v_xp := v_correct * 9;
  if v_xp > 0 then
    insert into xp_events (user_id, amount, reason) values (v_user, v_xp, p_mode);
  end if;

  -- 5) konu ilerlemesi + sıradaki konunun kilidini aç (§4.4, §4.5)
  if p_mode = 'topic' then
    v_stars := case
      when v_correct = v_total then 3
      when v_correct >= v_total - 1 then 2
      else 1
    end;

    insert into topic_progress (user_id, topic_id, status, stars, completed_at)
    values (v_user, p_topic_id, 'done', v_stars, now())
    on conflict (user_id, topic_id) do update
      set status = 'done',
          stars = greatest(topic_progress.stars, excluded.stars),  -- tekrar oynayışta yıldız düşmez
          completed_at = coalesce(topic_progress.completed_at, now());

    -- ders içi sıradaki konu (bölüm sırası → konu sırası)
    select t2.id into v_next_topic
    from topics t1
    join units u1 on u1.id = t1.unit_id
    join units u2 on u2.subject_id = u1.subject_id
    join topics t2 on t2.unit_id = u2.id
    where t1.id = p_topic_id
      and (u2.sort_order, t2.sort_order) > (u1.sort_order, t1.sort_order)
    order by u2.sort_order, t2.sort_order
    limit 1;

    if v_next_topic is not null then
      insert into topic_progress (user_id, topic_id, status)
      values (v_user, v_next_topic, 'active')
      on conflict (user_id, topic_id) do update
        set status = 'active'
        where topic_progress.status = 'locked';  -- done olanı geriye çekme
    end if;
  end if;

  -- 6) streak — Europe/Istanbul gününe göre (§4.2)
  if v_streak_on is distinct from v_today_tr then
    if v_streak_on = v_today_tr - 1 then
      v_streak := v_streak + 1;
    else
      v_streak := 1;
    end if;
    update profiles set streak_count = v_streak, streak_updated_on = v_today_tr where id = v_user;
  end if;

  -- 7) haftalık sınavı tamamla (hafta başı = pazartesi, §8)
  if p_mode = 'weekly' then
    update weekly_exams
       set completed_at = now(), correct_count = v_correct
     where user_id = v_user
       and week_start = v_week_start
       and completed_at is null;
  end if;

  return jsonb_build_object(
    'xp_earned',    v_xp,
    'stars',        v_stars,
    'hearts_left',  v_hearts,
    'streak_count', v_streak
  );
end $$;

revoke execute on function public.finish_quiz(uuid, text, jsonb) from public, anon;
grant execute on function public.finish_quiz(uuid, text, jsonb) to authenticated;
