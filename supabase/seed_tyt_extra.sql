-- ============================================================
-- ATLAS — TYT içerik taslağı: kalan 6 ders (BACKEND.md §6.5 devamı)
-- Kurulum: schema.sql + finish_quiz.sql + seed_tarih.sql'den SONRA
-- SQL Editor'de çalıştır. İçerik tabloları RLS gereği istemciden
-- yazılamaz; bu dosya Dashboard SQL Editor (service_role) ile çalıştırılır.
--
-- ⚠️ TASLAK İÇERİK — bu bir YKS (gerçek üniversite sınavı) hazırlık
-- uygulamasıdır, yanlış/eksik bilgi öğrenciye ciddi zarar verebilir.
-- Buradaki sorular yalnızca uygulamayı OYNANABİLİR hale getirmek için
-- yazıldı (kesin/tartışmasız, ders kitabı seviyesinde temel bilgiler
-- seçildi) — YAYINA ALMADAN ÖNCE bir öğretmen/alan uzmanının
-- doğruluğunu ve müfredat uygunluğunu gözden geçirmesi ŞART.
--
-- Kapsam:
--   • Coğrafya + Felsefe: seed_tarih.sql'deki minimal içeriğe EKLEME
--     yapar (var olan üniteyi/konuları SİLMEZ) — 2'şer yeni konu ekler,
--     hem yeni hem eski konulara flashcard ekler (öncekinde flashcard yoktu).
--   • Fizik, Kimya, Biyoloji, Türkçe: sıfırdan, her biri 1 ünite / 3 konu /
--     konu başına 5 soru + 2-3 flashcard.
--
-- İdempotent: her blok kendi guard'ını kontrol eder (unit/topic zaten
-- varsa o blok atlanır) — dosya güvenle tekrar çalıştırılabilir.
-- ============================================================

-- ----------------------------------------------------------
-- COĞRAFYA — mevcut üniteye 2 yeni konu + tüm konulara flashcard
-- ----------------------------------------------------------
do $cografya_ext$
declare
  u_cografya uuid;
  t_iklim uuid; t_akarsu uuid; t_yerekil uuid; t_gol uuid;
begin
  select id into u_cografya from units where subject_id = 'cografya' and title = 'Türkiye''nin Fiziki Coğrafyası';
  if u_cografya is null then
    raise notice 'Coğrafya temel ünitesi bulunamadı (seed_tarih.sql önce çalıştırılmalı) — blok atlandı.';
    return;
  end if;

  if exists (select 1 from topics where unit_id = u_cografya and title = 'Türkiye''nin Yer Şekilleri') then
    raise notice 'Coğrafya ek içeriği zaten yüklü — blok atlandı.';
    return;
  end if;

  select id into t_iklim from topics where unit_id = u_cografya and title = 'İklim Tipleri';
  select id into t_akarsu from topics where unit_id = u_cografya and title = 'Türkiye''nin Akarsuları';

  insert into topics (unit_id, title, sort_order) values (u_cografya, 'Türkiye''nin Yer Şekilleri', 3) returning id into t_yerekil;
  insert into topics (unit_id, title, sort_order) values (u_cografya, 'Türkiye''nin Gölleri', 4) returning id into t_gol;

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_yerekil, 'Türkiye''nin ortalama yükseltisinin fazla olmasının temel nedeni aşağıdakilerden hangisidir?',
    jsonb_build_array('Ekvatora yakın olması', 'III. jeolojik zamanda oluşan genç kıvrım dağları ve üzerindeki geniş platolar', 'Okyanuslarla çevrili olması', 'Volkanik faaliyetlerin hiç yaşanmamış olması', 'Yüzölçümünün küçük olması'), 1,
    'Türkiye, III. jeolojik zamanda oluşan genç kıvrım dağları ve bunların üzerindeki geniş platolar nedeniyle ortalama yükseltisi fazla bir ülkedir.'),
  (t_yerekil, 'Türkiye''nin en yüksek noktası olan Ağrı Dağı hangi tür bir dağdır?',
    jsonb_build_array('Kıvrım dağı', 'Volkanik dağ', 'Fay (kırık) dağı', 'Mercan resifi', 'Horst'), 1,
    'Ağrı Dağı (5.137 m), volkanik faaliyetler sonucu oluşmuş bir volkanik dağdır.'),
  (t_yerekil, 'Türkiye''de dağların kıyıya paralel uzandığı ve kıyı ile iç kesimler arasındaki ulaşımı zorlaştırdığı kıyı bölgesi aşağıdakilerden hangisidir?',
    jsonb_build_array('Ege kıyıları', 'Karadeniz kıyıları', 'Marmara kıyıları', 'Güneydoğu Anadolu', 'İç Anadolu'), 1,
    'Karadeniz kıyılarında dağlar kıyıya paralel uzanır; bu durum kıyı ile iç kesim arasındaki ulaşımı zorlaştırır.'),
  (t_yerekil, 'Ege Bölümü''nde dağların kıyıya dik uzanmasının kıyı tipine etkisi aşağıdakilerden hangisidir?',
    jsonb_build_array('Kıyı çizgisi düz ve girintisiz olur', 'Kıyı çizgisi girintili çıkıntılı (Ege tipi kıyı) olur', 'Kıyıda hiç körfez oluşmaz', 'Kıyı boyunca sürekli sıradağlar uzanır', 'Kıyıda delta ovaları hiç oluşmaz'), 1,
    'Ege''de dağların kıyıya dik uzanması, girinti-çıkıntılı (Ege tipi/enine kıyı) bir kıyı tipi oluşturur.'),
  (t_yerekil, 'Türkiye''de deprem riski en çok aşağıdaki fay hatlarından hangileriyle ilişkilidir?',
    jsonb_build_array('Yalnızca volkanik alanlarla', 'Kuzey Anadolu ve Doğu Anadolu fay hatlarıyla', 'Yalnızca kıyı ovalarıyla', 'Yalnızca plato alanlarıyla', 'Yalnızca haliç kıyılarıyla'), 1,
    'Türkiye''de deprem riski en çok Kuzey Anadolu Fay Hattı ve Doğu Anadolu Fay Hattı boyunca yoğunlaşır.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_gol, 'Tektonik hareketler sonucu oluşan, Türkiye''nin en büyük gölü aşağıdakilerden hangisidir?',
    jsonb_build_array('Tuz Gölü', 'Van Gölü', 'Beyşehir Gölü', 'Eğirdir Gölü', 'Sapanca Gölü'), 1,
    'Van Gölü, tektonik hareketler sonucu oluşan Türkiye''nin en büyük gölüdür (aynı zamanda volkanik set gölü özelliği de taşır).'),
  (t_gol, 'Kireç taşlarının erimesiyle oluşan çukurluklarda meydana gelen göl türüne ne ad verilir?',
    jsonb_build_array('Tektonik göl', 'Karstik göl', 'Buzul göl', 'Set gölü', 'Baraj gölü'), 1,
    'Karstik göller, kireç taşı gibi eriyebilen kayaçların erimesiyle oluşan çukurluklarda meydana gelir.'),
  (t_gol, 'Volkanik faaliyetler sırasında lav akıntısının bir vadiyi/çukuru kapatmasıyla oluşan göl türü aşağıdakilerden hangisidir?',
    jsonb_build_array('Karstik göl', 'Tektonik göl', 'Volkanik set gölü', 'Buzul gölü', 'Lagün'), 2,
    'Volkanik set gölleri, lav akıntısının önündeki bir çukuru/vadiyi kapatmasıyla oluşur (örn. Nemrut Gölü).'),
  (t_gol, 'Yüksek dağlarda buzulların aşındırmasıyla oluşan, genellikle küçük ve derin göllere ne ad verilir?',
    jsonb_build_array('Buzul (Sirk) gölü', 'Tektonik göl', 'Karstik göl', 'Lagün', 'Baraj gölü'), 0,
    'Buzul (sirk) gölleri, yüksek dağlarda buzulların aşındırmasıyla oluşan küçük, derin göllerdir.'),
  (t_gol, 'Bir koyun kıyı oku/kumsal ile denizden ayrılmasıyla oluşan sığ göllere ne ad verilir?',
    jsonb_build_array('Set gölü', 'Karstik göl', 'Lagün (Kıyı gölü)', 'Buzul gölü', 'Baraj gölü'), 2,
    'Lagünler (kıyı gölleri), bir koyun kıyı oku ile denizden ayrılmasıyla oluşan sığ göllerdir (örn. Terkos Gölü).');

  insert into flashcards (topic_id, prompt, answer, accepted_answers, explanation) values
  (t_iklim, 'Karadeniz ikliminin doğal bitki örtüsü nedir?', 'Orman', array['orman'], 'Her mevsim yağışlı Karadeniz ikliminin doğal bitki örtüsü ormandır.'),
  (t_iklim, 'Akdeniz ikliminin doğal bitki örtüsü nedir?', 'Maki', array['maki'], 'Akdeniz ikliminin doğal bitki örtüsü makidir.'),
  (t_iklim, 'Karasal iklimin doğal bitki örtüsü nedir?', 'Bozkır', array['bozkır','bozkir'], 'Karasal iklimde doğal bitki örtüsü bozkırdır.'),
  (t_akarsu, 'Tamamı Türkiye sınırları içinde kalan en uzun akarsu hangisidir?', 'Kızılırmak', array['kızılırmak','kizilirmak'], 'Kızılırmak (1.355 km), tamamı Türkiye sınırları içinde kalan en uzun akarsudur.'),
  (t_akarsu, 'Kaynağını Türkiye''den alıp toplam uzunluğu en fazla olan akarsu hangisidir?', 'Fırat', array['fırat','firat'], 'Toplam uzunlukta en uzun akarsu Fırat''tır.'),
  (t_yerekil, 'Türkiye''nin en yüksek noktası hangi dağdır?', 'Ağrı Dağı', array['ağrı dağı','ağrı','agri dagi','agri'], 'Ağrı Dağı (5.137 m) Türkiye''nin en yüksek noktasıdır.'),
  (t_yerekil, 'Dağların kıyıya paralel uzandığı, ulaşımı zorlaştırdığı bölge neresidir?', 'Karadeniz Bölgesi', array['karadeniz','karadeniz bölgesi','karadeniz bolgesi'], 'Karadeniz''de dağlar kıyıya paralel uzanır ve iç kesimlerle ulaşımı zorlaştırır.'),
  (t_gol, 'Türkiye''nin en büyük gölü hangisidir?', 'Van Gölü', array['van gölü','van golu','van'], 'Van Gölü, Türkiye''nin en büyük gölüdür.'),
  (t_gol, 'Kireç taşlarının erimesiyle oluşan göllere ne denir?', 'Karstik göl', array['karstik göl','karstik','karstik gol'], 'Karstik göller, eriyebilen kayaçların erimesiyle oluşan çukurluklarda meydana gelir.');

  raise notice 'Coğrafya ek içerik yüklendi: +2 konu, +10 soru, +9 flashcard.';
end $cografya_ext$;

-- ----------------------------------------------------------
-- FELSEFE — mevcut üniteye 2 yeni konu + tüm konulara flashcard
-- ----------------------------------------------------------
do $felsefe_ext$
declare
  u_felsefe uuid;
  t_ilkcag uuid; t_disiplin uuid; t_ozellik uuid;
begin
  select id into u_felsefe from units where subject_id = 'felsefe' and title = 'Felsefeye Giriş';
  if u_felsefe is null then
    raise notice 'Felsefe temel ünitesi bulunamadı (seed_tarih.sql önce çalıştırılmalı) — blok atlandı.';
    return;
  end if;

  if exists (select 1 from topics where unit_id = u_felsefe and title = 'Felsefenin Konusu ve Disiplinleri') then
    raise notice 'Felsefe ek içeriği zaten yüklü — blok atlandı.';
    return;
  end if;

  select id into t_ilkcag from topics where unit_id = u_felsefe and title = 'İlkçağ Felsefesi';

  insert into topics (unit_id, title, sort_order) values (u_felsefe, 'Felsefenin Konusu ve Disiplinleri', 2) returning id into t_disiplin;
  insert into topics (unit_id, title, sort_order) values (u_felsefe, 'Felsefi Düşüncenin Temel Özellikleri', 3) returning id into t_ozellik;

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_disiplin, 'Varlığın ne olduğunu, var olanın temel niteliklerini inceleyen felsefe disiplinine ne ad verilir?',
    jsonb_build_array('Epistemoloji', 'Etik', 'Ontoloji (Varlık Felsefesi)', 'Estetik', 'Mantık'), 2,
    'Ontoloji (varlık felsefesi), varlığın ne olduğunu ve var olanın temel niteliklerini inceler.'),
  (t_disiplin, 'Bilginin kaynağını, sınırlarını ve doğruluğunu inceleyen felsefe disiplinine ne ad verilir?',
    jsonb_build_array('Ontoloji', 'Epistemoloji (Bilgi Felsefesi)', 'Etik', 'Estetik', 'Siyaset Felsefesi'), 1,
    'Epistemoloji (bilgi felsefesi), bilginin kaynağı, sınırları ve doğruluğunu inceler.'),
  (t_disiplin, 'Ahlaki değerleri, "iyi" ve "kötü" kavramlarını inceleyen felsefe disiplinine ne ad verilir?',
    jsonb_build_array('Estetik', 'Mantık', 'Etik (Ahlak Felsefesi)', 'Ontoloji', 'Epistemoloji'), 2,
    'Etik (ahlak felsefesi), ahlaki değerleri, iyi-kötü ve doğru-yanlış kavramlarını inceler.'),
  (t_disiplin, 'Güzelin ve sanatın ne olduğunu, güzellik ölçütlerini inceleyen felsefe disiplinine ne ad verilir?',
    jsonb_build_array('Estetik', 'Etik', 'Ontoloji', 'Mantık', 'Epistemoloji'), 0,
    'Estetik, güzeli, sanatı ve güzellik ölçütlerini konu alan felsefe disiplinidir.'),
  (t_disiplin, 'Doğru düşünmenin kurallarını, akıl yürütme biçimlerini inceleyen felsefe disiplinine ne ad verilir?',
    jsonb_build_array('Etik', 'Estetik', 'Ontoloji', 'Mantık', 'Epistemoloji'), 3,
    'Mantık, doğru düşünmenin ilkelerini ve akıl yürütme (çıkarım) biçimlerini inceler.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_ozellik, 'Felsefi düşüncenin en temel özelliklerinden biri olan, hiçbir bilgiyi sınamadan kabul etmeme tutumuna ne ad verilir?',
    jsonb_build_array('Dogmatizm', 'Sorgulayıcılık (Eleştirellik)', 'Otorite kabulü', 'Kesin kabul', 'Ezbercilik'), 1,
    'Felsefe, hiçbir bilgiyi sınamadan/sorgulamadan kabul etmez; sorgulayıcı ve eleştirel bir tutuma sahiptir.'),
  (t_ozellik, 'Felsefi düşüncenin, birbiriyle çelişmeyen, uyumlu bir bütün oluşturan görüşler ortaya koyma özelliğine ne ad verilir?',
    jsonb_build_array('Tutarlılık (Sistemlilik)', 'Öznellik', 'Kesinlik', 'Deneysellik', 'Dogmatiklik'), 0,
    'Felsefi düşünce sistemlidir; ortaya konan görüşler birbiriyle çelişmeden tutarlı bir bütün oluşturur.'),
  (t_ozellik, 'Felsefenin, bilim gibi kesin/deneysel sonuçlara değil, akıl yürütmeye dayalı yorumlara ulaşması aşağıdaki özelliklerden hangisiyle ilişkilidir?',
    jsonb_build_array('Evrensellik', 'Öznellik (Yoruma Dayalılık)', 'Nesnellik (Bilimsellik)', 'Kanıtlanabilirlik', 'Deneysellik'), 1,
    'Felsefi sonuçlar, bilimin aksine deneyle kesin kanıtlanamaz; filozofun akıl yürütmesine dayalı, göreceli/öznel yorumlardır.'),
  (t_ozellik, 'Felsefenin ele aldığı soruların zamana ve kültüre göre yeniden sorulup tartışılabilir olması aşağıdaki özelliklerden hangisiyle açıklanır?',
    jsonb_build_array('Kesinlik', 'Evrensellik ama süreklilik/yenilenebilirlik', 'Deneysellik', 'Nesnellik', 'Somutluk'), 1,
    'Felsefi sorular evrenseldir ama her çağda yeniden ele alınıp tartışılabilir; kesin/nihai bir cevapla kapanmaz.'),
  (t_ozellik, 'Bilimsel bilginin aksine felsefi bilginin, deney ve gözlemle sınanamayan, akıl yürütmeye dayanan yönüne ne ad verilir?',
    jsonb_build_array('Deneysel bilgi', 'Rasyonel (Akla Dayalı) bilgi', 'Ampirik bilgi', 'Teknik bilgi', 'İstatistiksel bilgi'), 1,
    'Felsefi bilgi, deney ve gözlemden çok akıl yürütmeye (rasyonel düşünmeye) dayanır.');

  insert into flashcards (topic_id, prompt, answer, accepted_answers, explanation) values
  (t_ilkcag, '"Sorgulanmamış bir hayat yaşanmaya değmez" sözü kime aittir?', 'Sokrates', array['sokrates'], 'Bu söz Sokrates''e aittir.'),
  (t_ilkcag, 'İlk filozof kabul edilen, arkheyi su olarak açıklayan düşünür kimdir?', 'Thales', array['thales'], 'Miletli Thales, ilk filozof kabul edilir.'),
  (t_ilkcag, '"Değişmeyen tek şey değişimdir" görüşünü savunan filozof kimdir?', 'Herakleitos', array['herakleitos','heraklit'], 'Herakleitos, evrenin sürekli değişim içinde olduğunu savunur.'),
  (t_disiplin, 'Varlığın ne olduğunu inceleyen felsefe disiplini nedir?', 'Ontoloji', array['ontoloji'], 'Ontoloji, varlık felsefesidir.'),
  (t_disiplin, 'Bilginin kaynağını inceleyen felsefe disiplini nedir?', 'Epistemoloji', array['epistemoloji'], 'Epistemoloji, bilgi felsefesidir.'),
  (t_disiplin, 'Ahlaki değerleri inceleyen felsefe disiplini nedir?', 'Etik', array['etik'], 'Etik, ahlak felsefesidir.'),
  (t_ozellik, 'Felsefi düşüncenin hiçbir bilgiyi sınamadan kabul etmeme özelliğine ne denir?', 'Sorgulayıcılık (Eleştirellik)', array['sorgulayıcılık','sorgulayicilik','eleştirellik','elestirellik'], 'Felsefe sorgulayıcı ve eleştirel bir tutuma sahiptir.'),
  (t_ozellik, 'Felsefi görüşlerin birbiriyle çelişmeyen bir bütün oluşturmasına ne denir?', 'Tutarlılık (Sistemlilik)', array['tutarlılık','sistemlilik','tutarlilik'], 'Felsefi düşünce sistemli ve tutarlıdır.');

  raise notice 'Felsefe ek içerik yüklendi: +2 konu, +10 soru, +8 flashcard.';
end $felsefe_ext$;

-- ----------------------------------------------------------
-- FİZİK — sıfırdan, 1 ünite / 3 konu
-- ----------------------------------------------------------
do $fizik_seed$
declare
  u_giris uuid;
  t_daldar uuid; t_buyukluk uuid; t_olcme uuid;
begin
  if exists (select 1 from units where subject_id = 'fizik') then
    raise notice 'Fizik içeriği zaten yüklü — blok atlandı.';
    return;
  end if;

  insert into units (subject_id, title, sort_order) values ('fizik', 'Fizik Bilimine Giriş', 1) returning id into u_giris;

  insert into topics (unit_id, title, sort_order) values (u_giris, 'Fiziğin Alt Dalları', 1) returning id into t_daldar;
  insert into topics (unit_id, title, sort_order) values (u_giris, 'Fiziksel Büyüklükler ve Birim Sistemleri', 2) returning id into t_buyukluk;
  insert into topics (unit_id, title, sort_order) values (u_giris, 'Ölçme ve Ölçüm Hataları', 3) returning id into t_olcme;

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_daldar, 'Cisimlerin hareketini, kuvvetleri ve denge hallerini inceleyen fizik alt dalı hangisidir?',
    jsonb_build_array('Optik', 'Mekanik', 'Termodinamik', 'Manyetizma', 'Akustik'), 1,
    'Mekanik, cisimlerin hareketi, kuvvet ve denge konularını inceleyen fizik dalıdır.'),
  (t_daldar, 'Isı ve sıcaklık arasındaki ilişkiyi, enerjinin bir biçimden diğerine dönüşümünü inceleyen fizik dalı hangisidir?',
    jsonb_build_array('Elektrik', 'Termodinamik', 'Optik', 'Modern Fizik', 'Mekanik'), 1,
    'Termodinamik, ısı-sıcaklık ilişkisini ve enerji dönüşümlerini inceler.'),
  (t_daldar, 'Işığın doğasını, yayılmasını ve maddeyle etkileşimini inceleyen fizik dalı hangisidir?',
    jsonb_build_array('Akustik', 'Manyetizma', 'Optik', 'Elektrik', 'Mekanik'), 2,
    'Optik, ışığın doğası, yayılması ve maddeyle etkileşimini inceleyen fizik dalıdır.'),
  (t_daldar, 'Sesin oluşumunu, yayılmasını ve özelliklerini inceleyen fizik dalı hangisidir?',
    jsonb_build_array('Optik', 'Termodinamik', 'Akustik', 'Mekanik', 'Elektrik'), 2,
    'Akustik (ses bilimi), sesin oluşumu, yayılması ve özellikleriyle ilgilenir.'),
  (t_daldar, 'Atom altı parçacıkları, görelilik ve kuantum olaylarını inceleyen fizik dalı aşağıdakilerden hangisidir?',
    jsonb_build_array('Klasik Fizik', 'Modern Fizik', 'Mekanik', 'Termodinamik', 'Optik'), 1,
    'Modern Fizik, 20. yüzyılda gelişen görelilik ve kuantum fiziği gibi konuları kapsar; klasik fizikten ayrılır.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_buyukluk, 'Yalnızca büyüklüğü (sayısal değeri ve birimi) ile tam olarak ifade edilebilen büyüklüklere ne ad verilir?',
    jsonb_build_array('Vektörel büyüklük', 'Skaler büyüklük', 'Türetilmiş büyüklük', 'Temel büyüklük', 'Bileşke büyüklük'), 1,
    'Skaler büyüklükler yön içermez; kütle, zaman, sıcaklık gibi yalnızca sayısal değer ve birimle ifade edilir.'),
  (t_buyukluk, 'Yönü, büyüklüğü ve doğrultusu birlikte belirtilmesi gereken büyüklüklere ne denir?',
    jsonb_build_array('Skaler büyüklük', 'Temel büyüklük', 'Vektörel büyüklük', 'Türetilmiş büyüklük', 'Sabit büyüklük'), 2,
    'Vektörel büyüklükler (kuvvet, hız, ivme gibi) yön ve doğrultuyla birlikte tanımlanır.'),
  (t_buyukluk, 'Aşağıdakilerden hangisi SI birim sisteminde bir temel büyüklüktür?',
    jsonb_build_array('Hız', 'Kuvvet', 'Kütle', 'Enerji', 'İvme'), 2,
    'Kütle (kilogram), SI sisteminin temel büyüklüklerinden biridir; hız/kuvvet/enerji/ivme türetilmiş büyüklüklerdir.'),
  (t_buyukluk, 'Uluslararası Birim Sistemi''nde (SI) uzunluğun birimi aşağıdakilerden hangisidir?',
    jsonb_build_array('Santimetre', 'Kilometre', 'Metre', 'Milimetre', 'Mil'), 2,
    'SI sisteminde temel uzunluk birimi metredir (m); diğerleri metrenin katları/askatlarıdır.'),
  (t_buyukluk, 'Hız gibi türetilmiş bir büyüklük aşağıdaki temel büyüklüklerden hangi ikisinin birleşimiyle elde edilir?',
    jsonb_build_array('Kütle ve zaman', 'Uzunluk ve zaman', 'Kütle ve uzunluk', 'Sıcaklık ve zaman', 'Uzunluk ve akım şiddeti'), 1,
    'Hız = yol/zaman olduğundan uzunluk (yol) ve zaman büyüklüklerinin birleşiminden türetilir.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_olcme, 'Bir büyüklüğü, aynı cins bir birimle karşılaştırma işlemine ne ad verilir?',
    jsonb_build_array('Gözlem', 'Deney', 'Ölçme', 'Hipotez kurma', 'Sınıflandırma'), 2,
    'Ölçme, bir büyüklüğü kendi cinsinden bir birimle karşılaştırma işlemidir.'),
  (t_olcme, 'Ölçüm aletinin hatalı kalibre edilmesinden kaynaklanan ve tüm ölçümleri aynı yönde etkileyen hata türü nedir?',
    jsonb_build_array('Rastgele hata', 'Sistematik hata', 'Okuma hatası', 'Çevresel hata', 'Tesadüfi hata'), 1,
    'Sistematik hata, aletin kendisinden kaynaklanır ve tüm ölçümleri aynı yönde/aynı miktarda etkiler.'),
  (t_olcme, '0,0000456 sayısının bilimsel gösterimi aşağıdakilerden hangisidir?',
    jsonb_build_array('4,56 x 10^-5', '4,56 x 10^5', '45,6 x 10^-6', '4,56 x 10^-4', '456 x 10^-7'), 0,
    'Bilimsel gösterimde sayı 1 ile 10 arasına indirgenir: 0,0000456 = 4,56 x 10^-5.'),
  (t_olcme, 'Bir ölçümün gerçek değere ne kadar yakın olduğunu ifade eden kavram aşağıdakilerden hangisidir?',
    jsonb_build_array('Duyarlılık (hassasiyet)', 'Doğruluk', 'Kesinlik', 'Belirsizlik', 'Tutarlılık'), 1,
    'Doğruluk, ölçüm sonucunun gerçek/kabul edilen değere yakınlığını ifade eder.'),
  (t_olcme, 'Farklı bilim insanlarının aynı deneyi tekrarladığında birbirine yakın sonuçlar elde etmesi aşağıdaki kavramlardan hangisiyle ilgilidir?',
    jsonb_build_array('Doğruluk', 'Tekrarlanabilirlik (kesinlik)', 'Bilimsel gösterim', 'Sistematik hata', 'Temel büyüklük'), 1,
    'Tekrarlanabilirlik/kesinlik, ölçümlerin birbirine ne kadar yakın ve tutarlı çıktığını ifade eder.');

  insert into flashcards (topic_id, prompt, answer, accepted_answers, explanation) values
  (t_daldar, 'Cisimlerin hareketini ve kuvvetleri inceleyen fizik dalı nedir?', 'Mekanik', array['mekanik'], 'Mekanik, hareket ve kuvvetleri inceler.'),
  (t_daldar, 'Işığın doğasını inceleyen fizik dalı nedir?', 'Optik', array['optik'], 'Optik, ışığı inceleyen fizik dalıdır.'),
  (t_daldar, 'Isı ve enerji dönüşümlerini inceleyen fizik dalı nedir?', 'Termodinamik', array['termodinamik'], 'Termodinamik, ısı-enerji ilişkisini inceler.'),
  (t_buyukluk, 'Yön belirtmeden yalnızca sayısal değer ve birimle ifade edilen büyüklüklere ne denir?', 'Skaler büyüklük', array['skaler','skaler büyüklük','skaler buyukluk'], 'Skaler büyüklükler yön içermez.'),
  (t_buyukluk, 'SI biriminde kütlenin birimi nedir?', 'Kilogram', array['kilogram','kg'], 'Kütlenin SI birimi kilogramdır.'),
  (t_buyukluk, 'Yön ve doğrultu ile birlikte ifade edilen büyüklüklere ne denir?', 'Vektörel büyüklük', array['vektörel','vektörel büyüklük','vektorel buyukluk'], 'Vektörel büyüklükler yön ve doğrultu içerir.'),
  (t_olcme, 'Bir büyüklüğü kendi cinsinden bir birimle karşılaştırma işlemine ne denir?', 'Ölçme', array['ölçme','olcme'], 'Ölçme, birimle karşılaştırma işlemidir.'),
  (t_olcme, 'Aletin hatalı kalibrasyonundan kaynaklanan, tüm ölçümleri aynı yönde etkileyen hataya ne denir?', 'Sistematik hata', array['sistematik hata','sistematik'], 'Sistematik hata aletten kaynaklanır.');

  raise notice 'Fizik seed tamam: 3 konu, 15 soru, 8 flashcard.';
end $fizik_seed$;

-- ----------------------------------------------------------
-- KİMYA — sıfırdan, 1 ünite / 3 konu
-- ----------------------------------------------------------
do $kimya_seed$
declare
  u_giris uuid;
  t_gelisim uuid; t_atommodel uuid; t_tanecik uuid;
begin
  if exists (select 1 from units where subject_id = 'kimya') then
    raise notice 'Kimya içeriği zaten yüklü — blok atlandı.';
    return;
  end if;

  insert into units (subject_id, title, sort_order) values ('kimya', 'Kimya Bilimine Giriş', 1) returning id into u_giris;

  insert into topics (unit_id, title, sort_order) values (u_giris, 'Kimya Biliminin Gelişimi ve Alt Dalları', 1) returning id into t_gelisim;
  insert into topics (unit_id, title, sort_order) values (u_giris, 'Atom Modellerinin Tarihsel Gelişimi', 2) returning id into t_atommodel;
  insert into topics (unit_id, title, sort_order) values (u_giris, 'Atomun Temel Tanecikleri', 3) returning id into t_tanecik;

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_gelisim, 'Ortaçağ''da altını başka metallerden elde etmeye çalışan, modern kimyanın öncülü sayılan uğraşın adı nedir?',
    jsonb_build_array('Simya (Alşimi)', 'Metalurji', 'Botanik', 'Astroloji', 'Mineraloji'), 0,
    'Simya (alşimi), altını başka metallerden elde etmeye çalışan, modern kimyanın öncülü sayılan Ortaçağ uğraşıdır.'),
  (t_gelisim, 'Maddenin yapısını, bileşimini, özelliklerini ve maddeler arasındaki etkileşimleri inceleyen bilim dalı nedir?',
    jsonb_build_array('Fizik', 'Biyoloji', 'Kimya', 'Jeoloji', 'Astronomi'), 2,
    'Kimya, maddenin yapısı, bileşimi ve maddeler arası etkileşimleri inceleyen temel bilim dalıdır.'),
  (t_gelisim, 'Karbon içeren bileşikleri inceleyen kimya alt dalı hangisidir?',
    jsonb_build_array('Anorganik kimya', 'Analitik kimya', 'Organik kimya', 'Fizikokimya', 'Biyokimya'), 2,
    'Organik kimya, karbon bileşiklerini inceleyen kimya dalıdır.'),
  (t_gelisim, 'Canlı organizmalardaki kimyasal süreçleri inceleyen bilim dalı hangisidir?',
    jsonb_build_array('Organik kimya', 'Biyokimya', 'Anorganik kimya', 'Analitik kimya', 'Nükleer kimya'), 1,
    'Biyokimya, canlılardaki kimyasal süreçleri inceleyen, kimya ile biyolojinin kesişim alanıdır.'),
  (t_gelisim, 'Bir maddenin bileşiminde hangi elementlerin ve ne oranda bulunduğunu belirlemeyi konu alan kimya dalı hangisidir?',
    jsonb_build_array('Analitik kimya', 'Organik kimya', 'Fizikokimya', 'Biyokimya', 'Nükleer kimya'), 0,
    'Analitik kimya, maddelerin bileşimini (nitel/nicel analiz) belirlemekle ilgilenir.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_atommodel, 'Atomu "içi dolu, bölünemeyen katı bir küre" olarak tanımlayan ilk bilimsel atom modelini kim öne sürmüştür?',
    jsonb_build_array('J.J. Thomson', 'John Dalton', 'Ernest Rutherford', 'Niels Bohr', 'Erwin Schrödinger'), 1,
    '19. yüzyıl başında John Dalton, atomu bölünemez katı bir küre olarak tanımlayan ilk bilimsel modeli öne sürdü.'),
  (t_atommodel, 'Elektronu keşfederek atomun "üzümlü kek modeli"ni öneren bilim insanı kimdir?',
    jsonb_build_array('John Dalton', 'J.J. Thomson', 'Ernest Rutherford', 'Niels Bohr', 'James Chadwick'), 1,
    'J.J. Thomson, elektronu keşfetti ve pozitif yüklü hamur içinde elektronların dağıldığı üzümlü kek modelini önerdi.'),
  (t_atommodel, 'Altın yaprak deneyiyle atomun çekirdekli yapısını ortaya koyan bilim insanı kimdir?',
    jsonb_build_array('J.J. Thomson', 'Niels Bohr', 'Ernest Rutherford', 'John Dalton', 'Erwin Schrödinger'), 2,
    'Rutherford, altın yaprak deneyiyle atomun büyük kısmının boşluk, kütlenin ise küçük bir çekirdekte toplandığını gösterdi.'),
  (t_atommodel, 'Elektronların çekirdek etrafında belirli enerji düzeylerinde dolandığını öne süren atom modeli kime aittir?',
    jsonb_build_array('Dalton', 'Thomson', 'Rutherford', 'Bohr', 'Chadwick'), 3,
    'Niels Bohr, elektronların belirli enerji seviyelerinde (yörüngelerde) dolandığı modeli önerdi.'),
  (t_atommodel, 'Nötronu keşfederek atom çekirdeğinin proton ve nötrondan oluştuğunu netleştiren bilim insanı kimdir?',
    jsonb_build_array('Niels Bohr', 'James Chadwick', 'Ernest Rutherford', 'J.J. Thomson', 'John Dalton'), 1,
    'James Chadwick, 1932''de nötronu keşfederek çekirdek yapısını netleştirdi.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_tanecik, 'Atom çekirdeğinde bulunan pozitif yüklü tanecik aşağıdakilerden hangisidir?',
    jsonb_build_array('Elektron', 'Nötron', 'Proton', 'İyon', 'Foton'), 2,
    'Proton, çekirdekte bulunan pozitif yüklü taneciktir.'),
  (t_tanecik, 'Atomda yükü olmayan (nötr), çekirdekte bulunan tanecik hangisidir?',
    jsonb_build_array('Proton', 'Elektron', 'Nötron', 'İyon', 'Molekül'), 2,
    'Nötron, çekirdekte bulunan yüksüz (nötr) taneciktir.'),
  (t_tanecik, 'Çekirdek etrafında hareket eden, negatif yüklü ve kütlesi proton/nötrona göre ihmal edilebilecek kadar küçük olan tanecik hangisidir?',
    jsonb_build_array('Proton', 'Nötron', 'Elektron', 'Çekirdekçik', 'İzotop'), 2,
    'Elektron, çekirdek çevresinde bulunan negatif yüklü, çok küçük kütleli taneciktir.'),
  (t_tanecik, 'Bir atomun proton sayısına ne ad verilir ve neyi belirler?',
    jsonb_build_array('Kütle numarası — izotopu belirler', 'Atom numarası — element türünü belirler', 'Nötron sayısı — kütleyi belirler', 'İyon yükü — çözünürlüğü belirler', 'Değerlik — rengi belirler'), 1,
    'Atom numarası proton sayısına eşittir ve elementin türünü (kimliğini) belirler.'),
  (t_tanecik, 'Bir atomun kütle numarası neyin toplamına eşittir?',
    jsonb_build_array('Proton + elektron', 'Proton + nötron', 'Nötron + elektron', 'Yalnızca proton', 'Yalnızca nötron'), 1,
    'Kütle numarası, proton sayısı ile nötron sayısının toplamına eşittir.');

  insert into flashcards (topic_id, prompt, answer, accepted_answers, explanation) values
  (t_gelisim, 'Kimyanın Ortaçağ''daki öncülü sayılan uğraşın adı nedir?', 'Simya', array['simya','simya (alşimi)','alşimi','alsimi'], 'Simya, kimyanın öncülü sayılır.'),
  (t_gelisim, 'Karbon bileşiklerini inceleyen kimya dalı nedir?', 'Organik Kimya', array['organik kimya','organik'], 'Organik kimya karbon bileşiklerini inceler.'),
  (t_gelisim, 'Canlılardaki kimyasal süreçleri inceleyen dal nedir?', 'Biyokimya', array['biyokimya'], 'Biyokimya, kimya ile biyolojinin kesişimidir.'),
  (t_atommodel, 'Üzümlü kek modelini öneren bilim insanı kimdir?', 'J.J. Thomson', array['thomson','j.j. thomson','jj thomson'], 'Thomson, elektronu keşfedip bu modeli önerdi.'),
  (t_atommodel, 'Atomun çekirdekli yapısını altın yaprak deneyiyle bulan bilim insanı kimdir?', 'Rutherford', array['rutherford','ernest rutherford'], 'Rutherford, çekirdeği keşfetti.'),
  (t_atommodel, 'Elektronların enerji düzeylerinde dolandığını öne süren bilim insanı kimdir?', 'Bohr', array['bohr','niels bohr'], 'Bohr, enerji düzeyi modelini önerdi.'),
  (t_tanecik, 'Çekirdekteki pozitif yüklü tanecik hangisidir?', 'Proton', array['proton'], 'Proton pozitif yüklüdür.'),
  (t_tanecik, 'Atom numarası neyi belirler?', 'Element türünü (proton sayısını)', array['element türünü','proton sayısını','element turunu','proton sayisini'], 'Atom numarası proton sayısına eşittir.');

  raise notice 'Kimya seed tamam: 3 konu, 15 soru, 8 flashcard.';
end $kimya_seed$;

-- ----------------------------------------------------------
-- BİYOLOJİ — sıfırdan, 1 ünite / 3 konu
-- ----------------------------------------------------------
do $biyoloji_seed$
declare
  u_giris uuid;
  t_ortak uuid; t_hucre uuid; t_zar uuid;
begin
  if exists (select 1 from units where subject_id = 'biyoloji') then
    raise notice 'Biyoloji içeriği zaten yüklü — blok atlandı.';
    return;
  end if;

  insert into units (subject_id, title, sort_order) values ('biyoloji', 'Yaşam Bilimi Biyoloji', 1) returning id into u_giris;

  insert into topics (unit_id, title, sort_order) values (u_giris, 'Canlıların Ortak Özellikleri', 1) returning id into t_ortak;
  insert into topics (unit_id, title, sort_order) values (u_giris, 'Hücre ve Hücre Teorisi', 2) returning id into t_hucre;
  insert into topics (unit_id, title, sort_order) values (u_giris, 'Hücre Zarından Madde Geçişleri', 3) returning id into t_zar;

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_ortak, 'Tüm canlıların yapı ve işlev bakımından temel birimi aşağıdakilerden hangisidir?',
    jsonb_build_array('Doku', 'Hücre', 'Organ', 'Sistem', 'Molekül'), 1,
    'Hücre, canlıların en küçük yapısal ve işlevsel birimidir; tüm canlılar hücrelerden oluşur.'),
  (t_ortak, 'Canlıların dış ortam koşullarına bakılmaksızın iç ortamlarını sabit tutma özelliğine ne ad verilir?',
    jsonb_build_array('Metabolizma', 'Homeostazi', 'Adaptasyon', 'Üreme', 'Boşaltım'), 1,
    'Homeostazi, canlının iç ortamını (sıcaklık, pH, su dengesi vb.) sabit tutma yeteneğidir.'),
  (t_ortak, 'Canlılarda gerçekleşen yapım (anabolizma) ve yıkım (katabolizma) reaksiyonlarının tümüne ne ad verilir?',
    jsonb_build_array('Homeostazi', 'Metabolizma', 'Fotosentez', 'Boşaltım', 'Sindirim'), 1,
    'Metabolizma, hücrede gerçekleşen tüm yapım ve yıkım reaksiyonlarının toplamıdır.'),
  (t_ortak, 'Canlıların kendine benzer yeni bireyler oluşturma özelliğine ne ad verilir?',
    jsonb_build_array('Beslenme', 'Solunum', 'Üreme', 'Boşaltım', 'Uyarılma'), 2,
    'Üreme, canlıların kendi türünün devamını sağlamak için yeni bireyler oluşturma özelliğidir.'),
  (t_ortak, 'Canlıların çevresel değişikliklere karşı tepki verme özelliğine ne ad verilir?',
    jsonb_build_array('İrritabilite (uyarılara tepki)', 'Homeostazi', 'Metabolizma', 'Adaptasyon', 'Organizasyon'), 0,
    'İrritabilite, canlının çevresindeki uyaranlara (ışık, sıcaklık, dokunma vb.) tepki verme özelliğidir.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_hucre, 'Mikroskopla ilk kez hücreyi gözlemleyip "hücre" (cell) terimini kullanan bilim insanı kimdir?',
    jsonb_build_array('Robert Hooke', 'Anton van Leeuwenhoek', 'Theodor Schwann', 'Matthias Schleiden', 'Rudolf Virchow'), 0,
    'Robert Hooke, 1665''te mantar dokusunu inceleyerek boş odacıkları gözlemledi ve "hücre" terimini ilk kullandı.'),
  (t_hucre, '"Tüm hayvanlar hücrelerden oluşur" görüşünü öne süren, hücre teorisine katkı sağlayan bilim insanı kimdir?',
    jsonb_build_array('Theodor Schwann', 'Robert Hooke', 'Anton van Leeuwenhoek', 'Rudolf Virchow', 'Charles Darwin'), 0,
    'Theodor Schwann, hayvan hücrelerini inceleyerek tüm hayvanların hücrelerden oluştuğunu ortaya koydu.'),
  (t_hucre, '"Her hücre, kendinden önce var olan bir hücreden oluşur" ilkesini hücre teorisine ekleyen bilim insanı kimdir?',
    jsonb_build_array('Robert Hooke', 'Matthias Schleiden', 'Rudolf Virchow', 'Anton van Leeuwenhoek', 'Theodor Schwann'), 2,
    'Rudolf Virchow, hücrelerin kendinden önceki hücrelerden bölünerek oluştuğu ilkesini ekledi.'),
  (t_hucre, 'Zarla çevrili gerçek bir çekirdeği bulunmayan, DNA''sı sitoplazmada dağınık hâlde olan hücre tipi aşağıdakilerden hangisidir?',
    jsonb_build_array('Ökaryot hücre', 'Prokaryot hücre', 'Bitki hücresi', 'Hayvan hücresi', 'Mantar hücresi'), 1,
    'Prokaryot hücrelerde (bakteriler) zarla çevrili gerçek bir çekirdek bulunmaz.'),
  (t_hucre, 'Zarla çevrili gerçek bir çekirdeğe ve zarlı organellere sahip hücre tipi aşağıdakilerden hangisidir?',
    jsonb_build_array('Prokaryot hücre', 'Bakteri hücresi', 'Ökaryot hücre', 'Virüs', 'Hiçbiri'), 2,
    'Ökaryot hücrelerde zarla çevrili gerçek bir çekirdek ve zarlı organeller bulunur.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_zar, 'Bir maddenin çok yoğun olduğu ortamdan az yoğun olduğu ortama, enerji harcanmadan geçişine ne ad verilir?',
    jsonb_build_array('Aktif taşıma', 'Difüzyon', 'Osmoz', 'Endositoz', 'Ekzositoz'), 1,
    'Difüzyon, maddenin çok yoğun bölgeden az yoğun bölgeye enerji harcanmadan (pasif) geçişidir.'),
  (t_zar, 'Su moleküllerinin yarı geçirgen bir zardan az yoğun ortamdan çok yoğun ortama geçişine ne ad verilir?',
    jsonb_build_array('Difüzyon', 'Osmoz', 'Aktif taşıma', 'Fagositoz', 'Pinositoz'), 1,
    'Osmoz, suyun yarı geçirgen zardan az yoğun (hipotonik) ortamdan çok yoğun (hipertonik) ortama geçişidir.'),
  (t_zar, 'Hücrenin, madde derişim farkına karşı ATP harcayarak madde taşımasına ne ad verilir?',
    jsonb_build_array('Difüzyon', 'Osmoz', 'Aktif taşıma', 'Kolaylaştırılmış difüzyon', 'Plazmoliz'), 2,
    'Aktif taşıma, hücrenin ATP harcayarak derişim farkına karşı madde taşımasıdır.'),
  (t_zar, 'Hücrenin katı/büyük parçacıkları zarını çevirerek içine almasına ne ad verilir?',
    jsonb_build_array('Ekzositoz', 'Osmoz', 'Fagositoz (endositoz türü)', 'Difüzyon', 'Aktif taşıma'), 2,
    'Fagositoz, hücrenin büyük/katı parçacıkları zarla çevirip içine alma şeklidir; bir endositoz türüdür.'),
  (t_zar, 'Bitki hücresinin hipertonik (çok yoğun) bir ortama konulduğunda su kaybederek hücre zarının çeperden ayrılmasına ne ad verilir?',
    jsonb_build_array('Turgor', 'Plazmoliz', 'Hemoliz', 'Deplazmoliz', 'Osmoz basıncı'), 1,
    'Plazmoliz, bitki hücresinin hipertonik ortamda su kaybedip zarının hücre çeperinden ayrılmasıdır.');

  insert into flashcards (topic_id, prompt, answer, accepted_answers, explanation) values
  (t_ortak, 'Canlıların yapısal ve işlevsel temel birimi nedir?', 'Hücre', array['hücre','hucre'], 'Hücre, canlıların temel birimidir.'),
  (t_ortak, 'Canlının iç ortamını sabit tutma özelliğine ne denir?', 'Homeostazi', array['homeostazi','homeostasi'], 'Homeostazi, iç dengeyi korur.'),
  (t_ortak, 'Canlılardaki yapım ve yıkım reaksiyonlarının tümüne ne denir?', 'Metabolizma', array['metabolizma'], 'Metabolizma, tüm yapım/yıkım reaksiyonlarıdır.'),
  (t_hucre, 'Hücre terimini ilk kullanan bilim insanı kimdir?', 'Robert Hooke', array['hooke','robert hooke'], 'Hooke, 1665''te bu terimi kullandı.'),
  (t_hucre, 'Zarla çevrili gerçek çekirdeği olmayan hücre tipi nedir?', 'Prokaryot hücre', array['prokaryot','prokaryot hücre','prokaryot hucre'], 'Prokaryotlarda gerçek çekirdek yoktur.'),
  (t_hucre, 'Zarla çevrili gerçek çekirdeği olan hücre tipi nedir?', 'Ökaryot hücre', array['ökaryot','ökaryot hücre','okaryot','okaryot hucre'], 'Ökaryotlarda gerçek çekirdek vardır.'),
  (t_zar, 'Maddenin çok yoğundan az yoğun ortama pasif geçişine ne denir?', 'Difüzyon', array['difüzyon','difuzyon'], 'Difüzyon pasif bir geçiştir.'),
  (t_zar, 'Suyun yarı geçirgen zardan geçişine ne denir?', 'Osmoz', array['osmoz'], 'Osmoz, suyun zardan geçişidir.');

  raise notice 'Biyoloji seed tamam: 3 konu, 15 soru, 8 flashcard.';
end $biyoloji_seed$;

-- ----------------------------------------------------------
-- TÜRKÇE — sıfırdan, 1 ünite / 3 konu
-- ----------------------------------------------------------
do $turkce_seed$
declare
  u_giris uuid;
  t_sanat uuid; t_anlamiliski uuid; t_cumle uuid;
begin
  if exists (select 1 from units where subject_id = 'turkce') then
    raise notice 'Türkçe içeriği zaten yüklü — blok atlandı.';
    return;
  end if;

  insert into units (subject_id, title, sort_order) values ('turkce', 'Sözcükte ve Cümlede Anlam', 1) returning id into u_giris;

  insert into topics (unit_id, title, sort_order) values (u_giris, 'Söz Sanatları', 1) returning id into t_sanat;
  insert into topics (unit_id, title, sort_order) values (u_giris, 'Anlam İlişkileri: Eş Anlam, Zıt Anlam, Mecaz Anlam', 2) returning id into t_anlamiliski;
  insert into topics (unit_id, title, sort_order) values (u_giris, 'Cümlede Anlam', 3) returning id into t_cumle;

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_sanat, '"Kaşların yay, gözlerin ok" dizesinde kullanılan söz sanatı aşağıdakilerden hangisidir?',
    jsonb_build_array('Kişileştirme', 'Teşbih (Benzetme)', 'Mecaz-ı mürsel', 'Tezat', 'Abartma'), 1,
    'Kaşın yaya, gözün oka benzetilmesi açık bir teşbih (benzetme) örneğidir.'),
  (t_sanat, '"Rüzgâr kapıyı usulca çaldı." cümlesinde kullanılan söz sanatı hangisidir?',
    jsonb_build_array('Teşbih', 'Kişileştirme (Teşhis)', 'Tezat', 'Abartma', 'Kinaye'), 1,
    'İnsana özgü bir davranışın (çalmak) doğaya (rüzgâr) yüklenmesi kişileştirme (teşhis) sanatıdır.'),
  (t_sanat, '"Dünya kadar param var." cümlesindeki söz sanatı hangisidir?',
    jsonb_build_array('Benzetme', 'Kişileştirme', 'Abartma (Mübalağa)', 'Tezat', 'Mecaz-ı mürsel'), 2,
    'Gerçek durumu olduğundan çok/az göstermek abartma (mübalağa) sanatıdır.'),
  (t_sanat, '"Bütün okul bahçeye çıktı." cümlesinde "okul" sözcüğüyle aslında öğrenciler kastedilmiştir. Bu söz sanatına ne ad verilir?',
    jsonb_build_array('Teşbih', 'Kişileştirme', 'Tezat', 'Mecaz-ı mürsel', 'İstiare'), 3,
    'Mecaz-ı mürsel (düz değişmece), bir sözü benzetme amacı olmadan parça-bütün gibi ilgilerle başka anlamda kullanmaktır.'),
  (t_sanat, '"Küçücük elleriyle koca dünyayı kurtardı." cümlesinde birbirine zıt kavramların bir arada kullanılmasına ne ad verilir?',
    jsonb_build_array('Tezat (Karşıtlık)', 'Teşbih', 'Kişileştirme', 'Abartma', 'Kinaye'), 0,
    '"Küçücük" ile "koca" gibi zıt anlamlı ifadelerin bir arada kullanılması tezat sanatıdır.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_anlamiliski, '"Kısmet" sözcüğünün eş (yakın) anlamlısı aşağıdakilerden hangisidir?',
    jsonb_build_array('Talih', 'Emek', 'Başarı', 'Sabır', 'Umut'), 0,
    '"Kısmet" ile "talih/nasip" sözcükleri eş anlamlıdır.'),
  (t_anlamiliski, '"Cömert" sözcüğünün zıt anlamlısı aşağıdakilerden hangisidir?',
    jsonb_build_array('Eli açık', 'Bonkör', 'Cimri', 'Alicenap', 'Yardımsever'), 2,
    '"Cömert" sözcüğünün zıt anlamlısı "cimri"dir; diğerleri cömertlikle eş/yakın anlamlıdır.'),
  (t_anlamiliski, '"Sınıfın en ağır öğrencisi kalemini unutmuş." cümlesinde "ağır" sözcüğü hangi anlamda kullanılmıştır?',
    jsonb_build_array('Gerçek anlamda (kilo bakımından)', 'Mecaz anlamda (ağırbaşlı)', 'Terim anlamda', 'Yan anlamda (fiziksel)', 'Eş anlamda'), 1,
    'Burada "ağır", kilo değil "ağırbaşlı, ciddi" anlamında mecaz olarak kullanılmıştır.'),
  (t_anlamiliski, 'Bir sözcüğün cümle/bağlam içinde kazandığı, sözlük anlamından farklı anlama ne ad verilir?',
    jsonb_build_array('Gerçek anlam', 'Mecaz anlam', 'Terim anlam', 'Yan anlam', 'Sesteş anlam'), 1,
    'Mecaz anlam, sözcüğün gerçek (sözlük) anlamından uzaklaşarak kazandığı benzetmeye dayalı anlamdır.'),
  (t_anlamiliski, '"Kırmızı" ile "kızıl" sözcükleri arasındaki anlam ilişkisi aşağıdakilerden hangisidir?',
    jsonb_build_array('Zıt anlam', 'Eş (yakın) anlam', 'Mecaz anlam', 'Sesteş (eş sesli) anlam', 'Terim anlam'), 1,
    '"Kırmızı" ve "kızıl" birbirine çok yakın/eş anlamlı sözcüklerdir.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_cumle, '"Çalıştı, bu yüzden sınavı kazandı." cümlesindeki anlam ilişkisi aşağıdakilerden hangisidir?',
    jsonb_build_array('Amaç-sonuç', 'Neden-sonuç', 'Koşul-sonuç', 'Karşılaştırma', 'Öznellik'), 1,
    '"Bu yüzden" bağlacı, çalışmanın (neden) kazanmaya (sonuç) yol açtığını gösterir; neden-sonuç ilişkisidir.'),
  (t_cumle, '"Kazanmak için gece gündüz çalıştı." cümlesindeki anlam ilişkisi hangisidir?',
    jsonb_build_array('Neden-sonuç', 'Amaç-sonuç', 'Karşılaştırma', 'Koşul-sonuç', 'Zıtlık'), 1,
    '"İçin" bağlacıyla kurulan bu cümlede eylem, bir amaca (kazanmak) yöneliktir; amaç-sonuç ilişkisidir.'),
  (t_cumle, '"Bence bu film yılın en güzel filmi." cümlesi için aşağıdakilerden hangisi söylenebilir?',
    jsonb_build_array('Nesnel bir yargı bildirir', 'Öznel bir yargı bildirir', 'Kesin bilgi verir', 'Kanıtlanabilir bir yargıdır', 'Sayısal veri içerir'), 1,
    '"Bence" ifadesi kişisel görüş bildirir; bu, kişiden kişiye değişebilen öznel bir yargıdır.'),
  (t_cumle, '"Su, 0 derecede donar." cümlesi için aşağıdakilerden hangisi söylenebilir?',
    jsonb_build_array('Öznel bir yargıdır', 'Nesnel bir yargıdır (kanıtlanabilir gerçek)', 'Varsayımdır', 'Kişisel görüştür', 'Abartılı bir ifadedir'), 1,
    'Herkes için geçerli, kanıtlanabilir, kişiden kişiye değişmeyen yargılar nesneldir.'),
  (t_cumle, '"Eğer erken kalkarsan trene yetişirsin." cümlesindeki anlam ilişkisi hangisidir?',
    jsonb_build_array('Neden-sonuç', 'Amaç-sonuç', 'Koşul-sonuç (şart)', 'Karşılaştırma', 'Tezat'), 2,
    '"Eğer... -sa/-se" yapısı koşul-sonuç (şart) ilişkisi kurar.');

  insert into flashcards (topic_id, prompt, answer, accepted_answers, explanation) values
  (t_sanat, 'Bir şeyi bir başka şeye benzetme sanatına ne ad verilir?', 'Teşbih (Benzetme)', array['teşbih','teşbih (benzetme)','teshih','benzetme'], 'Teşbih, benzetme sanatıdır.'),
  (t_sanat, 'İnsana özgü özelliklerin insan dışı varlıklara verilmesine ne ad verilir?', 'Kişileştirme', array['kişileştirme','teşhis','kisilestirme'], 'Kişileştirme, insan dışı varlıklara insana özgü nitelik vermektir.'),
  (t_sanat, 'Bir durumu olduğundan fazla/az göstermeye ne ad verilir?', 'Abartma (Mübalağa)', array['abartma','mübalağa','mubalaga'], 'Abartma, gerçeği olduğundan farklı göstermektir.'),
  (t_anlamiliski, 'Sözcüğün cümle içinde kazandığı, sözlük anlamından farklı anlama ne denir?', 'Mecaz anlam', array['mecaz anlam','mecaz'], 'Mecaz anlam, gerçek anlamdan uzaklaşmış anlamdır.'),
  (t_anlamiliski, 'Anlamdaş sözcüklere ne denir?', 'Eş anlamlı (anlamdaş)', array['eş anlamlı','anlamdaş','es anlamli','anlamdas'], 'Eş anlamlı sözcükler aynı/çok yakın anlamı taşır.'),
  (t_cumle, 'Herkes için geçerli, kanıtlanabilir yargılara ne denir?', 'Nesnel yargı', array['nesnel yargı','nesnel','nesnel yargi'], 'Nesnel yargı kişiden kişiye değişmez.'),
  (t_cumle, 'Kişiden kişiye değişebilen, kanıtlanamayan yargılara ne denir?', 'Öznel yargı', array['öznel yargı','öznel','oznel yargi','oznel'], 'Öznel yargı kişisel görüştür.');

  raise notice 'Türkçe seed tamam: 3 konu, 15 soru, 7 flashcard.';
end $turkce_seed$;
