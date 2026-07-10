-- ============================================================
-- ATLAS — AYT-EA taslak içerik seed'i (BACKEND.md §9 madde 4 — "AYT v1'e
-- girsin mi?" EVET karar verildi)
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
--
-- ⚠️ BAĞIMLILIK: Bu dosyadan ÖNCE `ayt-subjects.sql` çalıştırılmış olmalı —
-- 'tarih_ayt'/'cografya_ayt'/'felsefe_ayt' subjects.id'leri orada eklenir,
-- burada units.subject_id foreign key'i olarak kullanılır. 'edebiyat' zaten
-- schema.sql'de kayıtlı.
--
-- Kapsam — 4 AYT dersi, her biri 1 ünite + 3-4 konu + konu başına 5 soru +
-- konu başına 2-3 bilgi kartı (giriş seviyesi, AYT müfredatının temel/klasik
-- konuları):
--   • Edebiyat        — Güzel Sanatlar ve Edebiyat (3 konu, 15 soru, 8 kart)
--   • Tarih (AYT)      — İslam Tarihi ve Türk-İslam Devletleri (4 konu, 20 soru, 12 kart)
--   • Coğrafya (AYT)   — Ekosistem ve Madde Döngüleri (4 konu, 20 soru, 11 kart)
--   • Felsefe (AYT)    — Bilgi Felsefesi (4 konu, 20 soru, 10 kart)
--
-- ⚠️ TASLAK İÇERİK — pedagojik/alan uzmanı doğruluk kontrolünden geçmedi.
-- Yayına almadan önce bir öğretmenin/içerik uzmanının gözden geçirmesi
-- önerilir (BACKEND.md §6.5 ile aynı yaklaşım — Tarih (TYT) seed'i de böyle
-- başladı).
--
-- İdempotent: her ders kendi `if not exists` kontrolüyle korunur — dosya
-- tekrar çalıştırılırsa zaten yüklenmiş dersler atlanır, diğerleri yüklenir.
-- ============================================================

-- ----------------------------------------------------------
-- EDEBİYAT — Güzel Sanatlar ve Edebiyat
-- ----------------------------------------------------------
do $edebiyat$
declare
  u_gsve uuid;
  t_yer uuid; t_bilim uuid; t_metin uuid;
begin
  if exists (select 1 from units where subject_id = 'edebiyat') then
    raise notice 'Edebiyat içeriği zaten yüklü — atlandı.';
    return;
  end if;

  insert into units (subject_id, title, sort_order) values ('edebiyat', 'Güzel Sanatlar ve Edebiyat', 1) returning id into u_gsve;

  insert into topics (unit_id, title, sort_order) values (u_gsve, 'Güzel Sanatlar İçinde Edebiyatın Yeri', 1) returning id into t_yer;
  insert into topics (unit_id, title, sort_order) values (u_gsve, 'Edebiyatın Bilimlerle İlişkisi', 2) returning id into t_bilim;
  insert into topics (unit_id, title, sort_order) values (u_gsve, 'Metinlerin Sınıflandırılması', 3) returning id into t_metin;

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_yer, 'Sanatlar, kullanılan malzemeye/algılanma biçimine göre sınıflandırılırken edebiyat hangi grupta yer alır?',
    jsonb_build_array('Plastik Sanatlar', 'Fonetik (Sessel) Sanatlar', 'Ritmik-Dramatik Sanatlar', 'Mimari Sanatlar', 'Görsel Sanatlar'), 1,
    'Edebiyat, sözcükleri/sesi malzeme olarak kullandığı için fonetik (sessel) sanatlar grubunda yer alır; müzik de bu gruptadır.'),
  (t_yer, 'Edebiyatın temel malzemesi nedir?',
    jsonb_build_array('Renk', 'Nota (ses tonu)', 'Dil (sözcükler)', 'Taş/Mermer', 'Hareket'), 2,
    'Ressam boyayı, heykeltıraş taşı nasıl kullanırsa, edebiyatçı da dili/sözcükleri malzeme olarak kullanır.'),
  (t_yer, 'Aşağıdakilerden hangisi güzel sanatların ortak özelliklerinden biri DEĞİLDİR?',
    jsonb_build_array('Estetik haz uyandırma', 'Kurmaca/hayal gücü içerme', 'Öznellik taşıma', 'Yalnızca bilimsel doğrulukla sınırlı olma', 'Sanatçının duygu ve düşüncelerini yansıtma'), 3,
    'Sanat eserleri bilimsel doğruluktan çok estetik/öznel bir anlatım içerir; bilimsel metinler nesnelliğe dayanır.'),
  (t_yer, 'Resim, heykel ve mimari gibi sanatlar hangi grupta yer alır?',
    jsonb_build_array('Fonetik Sanatlar', 'Plastik (Görsel) Sanatlar', 'Ritmik-Dramatik Sanatlar', 'Sessel Sanatlar', 'Yazınsal Sanatlar'), 1,
    'Görme duyusuyla algılanan, malzemesi madde/şekil olan sanatlar plastik sanatlar grubundadır.'),
  (t_yer, 'Tiyatro ve sinema gibi hem görme hem işitme duyusuna hitap eden, hareket içeren sanatlar hangi grupta değerlendirilir?',
    jsonb_build_array('Fonetik Sanatlar', 'Plastik Sanatlar', 'Ritmik-Dramatik Sanatlar', 'Mimari Sanatlar', 'Edebi Sanatlar'), 2,
    'Tiyatro/sinema/bale gibi sanatlar hem görsel hem işitsel öğeleri bir arada, hareketle sunduğu için ritmik-dramatik sanatlar grubunda yer alır.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_bilim, 'Bir eserde dönemin siyasi/sosyal olaylarının yansıtılması edebiyatın hangi bilimle ilişkisini gösterir?',
    jsonb_build_array('Tarih', 'Fizik', 'Kimya', 'Matematik', 'Astronomi'), 0,
    'Edebî eserler dönemin sosyal/siyasi/kültürel yapısını yansıttığından tarih biliminin kaynaklarından biridir.'),
  (t_bilim, 'Edebiyat eserlerinde geçen yer adları, coğrafi özellikler ve doğa tasvirleri edebiyatın hangi bilimle ilişkisini örnekler?',
    jsonb_build_array('Coğrafya', 'Psikoloji', 'Sosyoloji', 'Felsefe', 'Hukuk'), 0,
    'Eserlerdeki mekân tasvirleri ve yer adları edebiyat-coğrafya ilişkisinin göstergesidir.'),
  (t_bilim, 'Bir romanda kahramanların iç dünyasının, duygu ve davranışlarının gerçekçi biçimde işlenmesi edebiyatın en çok hangi bilimle ilişkisini gösterir?',
    jsonb_build_array('Psikoloji', 'Kimya', 'Fizik', 'Astronomi', 'Jeoloji'), 0,
    'Karakterlerin ruhsal durumlarının, güdülerinin incelenmesi psikolojiyle ilişkilidir.'),
  (t_bilim, 'Bir eserde toplumsal sınıflar, gelenek-görenekler ve toplumsal ilişkilerin işlenmesi edebiyatın hangi bilimle ilişkisini gösterir?',
    jsonb_build_array('Sosyoloji', 'Matematik', 'Biyoloji', 'Kimya', 'Astronomi'), 0,
    'Toplumsal yapı, ilişkiler ve kurumların incelenmesi sosyolojinin konusudur; edebiyat eserleri bu açıdan sosyolojik kaynak olabilir.'),
  (t_bilim, 'Destanlar, mitler ve efsanelerin incelenmesinde edebiyat en çok hangi bilimden yararlanır?',
    jsonb_build_array('Halkbilimi (Folklor)', 'Fizik', 'Kimya', 'Astronomi', 'Jeoloji'), 0,
    'Sözlü gelenekten gelen destan/efsane/mit gibi ürünler halkbilimi (folklor) biliminin inceleme alanına girer.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_metin, 'Metinler, oluşum amaçlarına göre kaça ayrılır?',
    jsonb_build_array('İkiye', 'Üçe', 'Dörde', 'Beşe', 'Altıya'), 1,
    'Metinler; coşku ve heyecanı dile getiren metinler, olay çevresinde oluşan metinler ve öğretici metinler olmak üzere üçe ayrılır.'),
  (t_metin, 'Roman, hikâye, masal ve destan gibi türler hangi metin grubunda yer alır?',
    jsonb_build_array('Coşku ve Heyecanı Dile Getiren Metinler', 'Olay Çevresinde Oluşan Metinler', 'Öğretici Metinler', 'Söylev Türü Metinler', 'Mektup Türü Metinler'), 1,
    'Bir olay örgüsü, zaman ve mekân içinde anlatılan roman/hikâye/masal/destan gibi türler olay çevresinde oluşan metinlerdendir.'),
  (t_metin, 'Olay çevresinde oluşan metinler kendi içinde temelde neye göre ikiye ayrılır?',
    jsonb_build_array('Anlatmaya bağlı ve göstermeye bağlı metinler', 'Manzum ve mensur metinler', 'Yerli ve yabancı metinler', 'Klasik ve modern metinler', 'Dini ve din dışı metinler'), 0,
    'Roman/hikâye gibi anlatmaya bağlı metinler ile sahnede oynanmak üzere yazılan tiyatro gibi göstermeye bağlı metinler, olay çevresinde oluşan metinlerin iki alt türüdür.'),
  (t_metin, 'Şiir, hangi metin grubunun tipik örneğidir?',
    jsonb_build_array('Öğretici Metinler', 'Olay Çevresinde Oluşan Metinler', 'Coşku ve Heyecanı Dile Getiren Metinler', 'Söylev Metinleri', 'Mensur Metinler'), 2,
    'Şiir; duygu, coşku ve heyecanın yoğun biçimde dile getirildiği metin türüdür.'),
  (t_metin, 'Makale, deneme, fıkra ve sohbet gibi türler hangi metin grubunda yer alır?',
    jsonb_build_array('Coşku ve Heyecanı Dile Getiren Metinler', 'Olay Çevresinde Oluşan Metinler', 'Öğretici Metinler', 'Dramatik Metinler', 'Lirik Metinler'), 2,
    'Bilgi vermek, öğretmek amacıyla yazılan makale/deneme/fıkra/sohbet gibi türler öğretici metinlerdendir.');

  insert into flashcards (topic_id, prompt, answer, accepted_answers, explanation) values
  (t_yer, 'Edebiyat, güzel sanatlar sınıflandırmasında hangi grupta yer alır?', 'Fonetik (Sessel) Sanatlar',
    array['fonetik','fonetik sanatlar','sessel','sessel sanatlar','fonetik sessel sanatlar'], 'Edebiyat, dili/sesi malzeme olarak kullandığından fonetik sanatlar grubundadır.'),
  (t_yer, 'Edebiyatın temel malzemesi nedir?', 'Dil',
    array['dil','sözcük','sözcükler','soz','sozcukler'], 'Edebiyatçı dili/sözcükleri malzeme olarak kullanır.'),
  (t_yer, 'Resim, heykel ve mimari hangi sanat grubundadır?', 'Plastik Sanatlar',
    array['plastik','plastik sanatlar','görsel sanatlar','gorsel sanatlar'], 'Görme duyusuyla algılanan sanatlar plastik sanatlar grubundadır.'),
  (t_bilim, 'Bir eserde dönemin siyasi/sosyal olaylarının yansıtılması edebiyatın hangi bilimle ilişkisini gösterir?', 'Tarih',
    array['tarih'], 'Edebî eserler döneminin tarihine ışık tutar.'),
  (t_bilim, 'Destan ve efsanelerin incelendiği bilim dalı nedir?', 'Halkbilimi (Folklor)',
    array['halkbilimi','folklor','halk bilimi'], 'Sözlü gelenek ürünleri halkbilimi biliminin konusudur.'),
  (t_bilim, 'Karakterlerin ruh halinin işlenmesi edebiyatın hangi bilimle ilişkilidir?', 'Psikoloji',
    array['psikoloji'], 'Karakter tahlili psikolojiyle ilişkilidir.'),
  (t_metin, 'Roman ve hikâye hangi metin grubundadır?', 'Olay Çevresinde Oluşan Metinler',
    array['olay çevresinde oluşan metinler','olay cevresinde olusan metinler','olay çevresinde oluşan','olay metinleri'], 'Bir olay örgüsü etrafında kurulan metinler bu gruptandır.'),
  (t_metin, 'Makale ve deneme hangi metin grubundadır?', 'Öğretici Metinler',
    array['öğretici metinler','ogretici metinler','öğretici','ogretici'], 'Bilgi verme amaçlı metinler öğretici metinlerdir.');

  raise notice 'Edebiyat seed tamam: 3 konu / 15 soru / 8 kart.';
end $edebiyat$;

-- ----------------------------------------------------------
-- TARİH (AYT) — İslam Tarihi ve Türk-İslam Devletleri
-- ----------------------------------------------------------
do $tarih_ayt$
declare
  u_islam uuid;
  t_dogus uuid; t_dorthalife uuid; t_emevi uuid; t_turkislam uuid;
begin
  if exists (select 1 from units where subject_id = 'tarih_ayt') then
    raise notice 'Tarih (AYT) içeriği zaten yüklü — atlandı.';
    return;
  end if;

  insert into units (subject_id, title, sort_order) values ('tarih_ayt', 'İslam Tarihi ve Türk-İslam Devletleri', 1) returning id into u_islam;

  insert into topics (unit_id, title, sort_order) values (u_islam, 'İslamiyet''in Doğuşu ve Hz. Muhammed Dönemi', 1) returning id into t_dogus;
  insert into topics (unit_id, title, sort_order) values (u_islam, 'Dört Halife Dönemi', 2) returning id into t_dorthalife;
  insert into topics (unit_id, title, sort_order) values (u_islam, 'Emeviler ve Abbasiler', 3) returning id into t_emevi;
  insert into topics (unit_id, title, sort_order) values (u_islam, 'Türklerin İslamiyet''i Kabulü ve İlk Türk-İslam Devletleri', 4) returning id into t_turkislam;

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_dogus, 'İslamiyet''in doğduğu yıl olarak kabul edilen, Hz. Muhammed''e ilk vahyin geldiği yıl hangisidir?',
    jsonb_build_array('570', '610', '622', '632', '656'), 1,
    'Hz. Muhammed''e ilk vahiy 610 yılında Hira Mağarası''nda gelmiştir; bu tarih İslamiyet''in doğuşu kabul edilir.'),
  (t_dogus, 'Hz. Muhammed''in Mekke''den Medine''ye göç etmesi olayına ne ad verilir?',
    jsonb_build_array('Miraç', 'Hicret', 'Bedir', 'Fetih', 'Veda Haccı'), 1,
    '622''deki bu göç "Hicret" olarak adlandırılır ve Hicri takvimin başlangıcı kabul edilir.'),
  (t_dogus, 'Müslümanlarla Mekkeli müşrikler arasında yapılan ve Müslümanların kazandığı ilk büyük savaş hangisidir?',
    jsonb_build_array('Uhud Savaşı', 'Bedir Savaşı', 'Hendek Savaşı', 'Huneyn Savaşı', 'Mute Savaşı'), 1,
    '624''te yapılan Bedir Savaşı, Müslümanların kazandığı ilk büyük meydan savaşıdır.'),
  (t_dogus, 'Hicret hangi yıl gerçekleşmiştir?',
    jsonb_build_array('610', '620', '622', '630', '632'), 2,
    'Hicret, 622 yılında gerçekleşmiş ve Hicri takvimin başlangıcı sayılmıştır.'),
  (t_dogus, 'Mekke''nin fethi hangi yıl gerçekleşmiştir?',
    jsonb_build_array('622', '624', '630', '632', '656'), 2,
    'Mekke, 630 yılında fethedilmiş ve Kâbe putlardan temizlenmiştir.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_dorthalife, 'Hz. Muhammed''in vefatının ardından seçilen ilk halife kimdir?',
    jsonb_build_array('Hz. Ömer', 'Hz. Ebu Bekir', 'Hz. Osman', 'Hz. Ali', 'Hz. Hamza'), 1,
    'Hz. Ebu Bekir, 632''de ilk halife seçilmiştir.'),
  (t_dorthalife, 'Dört Halife Dönemi''nde halifelerin seçim/biat yoluyla belirlenmesi bu dönemin hangi özelliğini gösterir?',
    jsonb_build_array('Saltanata dayalı olduğunu', 'Halifeliğin babadan oğula geçtiğini', 'Halifeliğin seçime/biate dayalı olduğunu', 'Halifeliğin veraset usulüyle belirlendiğini', 'Halifelerin Emevi soyundan geldiğini'), 2,
    'Dört Halife Dönemi''nde halifeler saltanatla değil, biat/seçim yoluyla belirlenmiştir.'),
  (t_dorthalife, 'Kur''an-ı Kerim''in kitap hâline getirilip çoğaltılması hangi halifeler döneminde tamamlanmıştır?',
    jsonb_build_array('Hz. Ebu Bekir - Hz. Osman', 'Hz. Ömer - Hz. Ali', 'Hz. Osman - Hz. Ali', 'Hz. Ebu Bekir - Hz. Ömer', 'Hz. Ali - Hz. Muaviye'), 0,
    'Kur''an ayetleri Hz. Ebu Bekir döneminde bir araya getirilmiş, Hz. Osman döneminde çoğaltılıp yaygınlaştırılmıştır (Mushaf-ı Osmani).'),
  (t_dorthalife, 'Dört Halife Dönemi''nin sonuncusu kimdir?',
    jsonb_build_array('Hz. Ebu Bekir', 'Hz. Ömer', 'Hz. Osman', 'Hz. Ali', 'Hz. Hasan'), 3,
    'Hz. Ali, Dört Halife Dönemi''nin son halifesidir; onun şehadetinden sonra Emeviler dönemi başlamıştır.'),
  (t_dorthalife, 'Sasani Devleti''nin yıkılışını hızlandıran, 642 yılında yapılan ve "fetih zaferi" olarak da anılan savaş hangisidir?',
    jsonb_build_array('Yermük Savaşı', 'Kadisiye Savaşı', 'Nihavend Savaşı', 'Talas Savaşı', 'Malazgirt Savaşı'), 2,
    '642''deki Nihavend Savaşı''yla Sasani ordusu ağır bir yenilgiye uğramış, İran''ın fethi hızlanmıştır.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_emevi, 'Emevi Devleti hangi şehri başkent yapmıştır?',
    jsonb_build_array('Bağdat', 'Şam', 'Medine', 'Kahire', 'Kûfe'), 1,
    'Emeviler, 661''de Şam merkezli olarak kurulmuştur.'),
  (t_emevi, 'Halifeliği babadan oğula geçen bir saltanata dönüştüren hanedan hangisidir?',
    jsonb_build_array('Dört Halife', 'Emeviler', 'Abbasiler', 'Selçuklular', 'Gazneliler'), 1,
    'Emeviler döneminde halifelik, Muaviye ile birlikte veraset usulüne (babadan oğula geçen saltanata) dönüşmüştür.'),
  (t_emevi, 'Abbasi Devleti hangi şehri başkent yapmıştır?',
    jsonb_build_array('Şam', 'Bağdat', 'Medine', 'Kudüs', 'Semerkant'), 1,
    'Abbasiler, 750''de kurulmuş ve Bağdat''ı başkent yapmıştır.'),
  (t_emevi, 'Emevilerin Arap olmayan Müslümanlara (mevali) yönelik ayrımcı politikalarından duyulan rahatsızlık, hangi hanedanın iktidara gelmesini kolaylaştırmıştır?',
    jsonb_build_array('Abbasiler', 'Selçuklular', 'Karahanlılar', 'Gazneliler', 'Eyyübiler'), 0,
    'Emevilerin Arap milliyetçiliğine dayalı politikalarına tepki, Abbasilerin iktidara gelmesini kolaylaştırmıştır.'),
  (t_emevi, 'Türk-Arap ilişkilerinde dönüm noktası olan, Türklerin Abbasiler safında Çin''e karşı savaştığı savaş hangisidir?',
    jsonb_build_array('Kadisiye Savaşı', 'Nihavend Savaşı', 'Talas Savaşı', 'Malazgirt Savaşı', 'Miryokefalon Savaşı'), 2,
    '751 Talas Savaşı''nda Abbasi-Türk ittifakı Çin''i (Tang Hanedanı) yenmiş; bu zafer Türklerin İslamiyet''e yönelik ilgisini artıran önemli bir dönüm noktası olmuştur.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_turkislam, 'Talas Savaşı''nın Türk-İslam ilişkileri açısından önemi nedir?',
    jsonb_build_array('Türklerin Hristiyanlığı kabul etmesine yol açması', 'Türk-Arap ilişkilerini olumsuz etkilemesi', 'Türklerin kitleler hâlinde İslamiyet''e girişini hızlandırması', 'Türklerin Anadolu''ya yerleşmesini sağlaması', 'Türklerin Çin''e bağlanmasını sağlaması'), 2,
    '751 Talas zaferi, Türkler arasında İslamiyet''in yayılmasını hızlandıran önemli bir etken olmuştur.'),
  (t_turkislam, 'İlk Müslüman Türk devleti kabul edilen devlet hangisidir?',
    jsonb_build_array('Gazneliler', 'Karahanlılar', 'Selçuklular', 'Akkoyunlular', 'Harzemşahlar'), 1,
    '840''ta kurulan Karahanlı Devleti, hükümdarı Satuk Buğra Han''ın İslamiyet''i resmî din olarak kabulüyle ilk Müslüman Türk devleti olmuştur.'),
  (t_turkislam, 'Karahanlı hükümdarı Satuk Buğra Han hangi olayla tarihe geçmiştir?',
    jsonb_build_array('İlk Türk-İslam devletini kurmasıyla', 'İslamiyet''i resmî din olarak kabul eden ilk Türk hükümdarı olmasıyla', 'Anadolu''yu fetheden ilk Türk hükümdarı olmasıyla', 'İlk Türk sultanı unvanını almasıyla', 'Bağdat''ı fetheden ilk Türk komutanı olmasıyla'), 1,
    'Satuk Buğra Han, İslamiyet''i resmî olarak kabul eden ilk Türk hükümdarı olarak bilinir; bu, Karahanlıları ilk Müslüman Türk devleti yapmıştır.'),
  (t_turkislam, 'İslam dünyasında ilk kez "sultan" unvanını kullanan Türk-İslam hükümdarı kimdir?',
    jsonb_build_array('Satuk Buğra Han', 'Gazneli Mahmud', 'Tuğrul Bey', 'Alparslan', 'Melikşah'), 1,
    'Gazneli Mahmud, Abbasi halifesi tarafından "sultan" unvanıyla onurlandırılan ilk Türk-İslam hükümdarıdır.'),
  (t_turkislam, 'Gazneliler hangi bölgede kurulmuş bir Türk-İslam devletidir?',
    jsonb_build_array('Mısır', 'Horasan-Afganistan', 'Anadolu', 'Kafkasya', 'Kırım'), 1,
    'Gazneliler, 963''te bugünkü Afganistan-Horasan bölgesinde kurulmuş bir Türk-İslam devletidir.');

  insert into flashcards (topic_id, prompt, answer, accepted_answers, explanation) values
  (t_dogus, 'Hz. Muhammed''e ilk vahiy hangi yıl gelmiştir?', '610', array['610'], 'İlk vahiy 610''da Hira Mağarası''nda gelmiştir.'),
  (t_dogus, 'Hicret hangi yıl gerçekleşmiştir?', '622', array['622'], 'Hicret 622''de gerçekleşmiş, Hicri takvimin başlangıcı olmuştur.'),
  (t_dogus, 'Mekke hangi yıl fethedilmiştir?', '630', array['630'], 'Mekke 630''da fethedilmiştir.'),
  (t_dorthalife, 'Dört Halife Dönemi''nin ilk halifesi kimdir?', 'Hz. Ebu Bekir', array['ebu bekir','hz. ebu bekir','ebubekir'], 'İlk halife Hz. Ebu Bekir''dir.'),
  (t_dorthalife, 'Dört Halife Dönemi''nin son halifesi kimdir?', 'Hz. Ali', array['ali','hz. ali'], 'Son halife Hz. Ali''dir.'),
  (t_dorthalife, 'Kur''an ayetlerinin kitap hâline getirilmesi hangi halife döneminde başlamıştır?', 'Hz. Ebu Bekir', array['ebu bekir','hz. ebu bekir','ebubekir'], 'Kur''an, Hz. Ebu Bekir döneminde bir araya getirilmiştir.'),
  (t_emevi, 'Emeviler hangi şehri başkent yapmıştır?', 'Şam', array['şam','sam'], 'Emeviler Şam merkezlidir.'),
  (t_emevi, 'Abbasiler hangi şehri başkent yapmıştır?', 'Bağdat', array['bağdat','bagdat'], 'Abbasiler Bağdat merkezlidir.'),
  (t_emevi, 'Talas Savaşı hangi yıl yapılmıştır?', '751', array['751'], 'Talas Savaşı 751''de yapılmıştır.'),
  (t_turkislam, 'İlk Müslüman Türk devleti hangisidir?', 'Karahanlılar', array['karahanlılar','karahanlı','karahanlilar'], 'İlk Müslüman Türk devleti Karahanlılardır.'),
  (t_turkislam, 'İslamiyet''i kabul eden ilk Türk hükümdarı kimdir?', 'Satuk Buğra Han', array['satuk buğra han','satuk bugra han','satuk buğra','satuk bugra'], 'Satuk Buğra Han ilk Müslüman Türk hükümdardır.'),
  (t_turkislam, 'İlk kez "sultan" unvanını kullanan Türk-İslam hükümdarı kimdir?', 'Gazneli Mahmud', array['gazneli mahmud','mahmud','gazneli mahmut'], 'Gazneli Mahmud ilk kez sultan unvanını kullanmıştır.');

  raise notice 'Tarih (AYT) seed tamam: 4 konu / 20 soru / 12 kart.';
end $tarih_ayt$;

-- ----------------------------------------------------------
-- COĞRAFYA (AYT) — Ekosistem ve Madde Döngüleri
-- ----------------------------------------------------------
do $cografya_ayt$
declare
  u_eko uuid;
  t_bilesen uuid; t_enerji uuid; t_dongu uuid; t_biyo uuid;
begin
  if exists (select 1 from units where subject_id = 'cografya_ayt') then
    raise notice 'Coğrafya (AYT) içeriği zaten yüklü — atlandı.';
    return;
  end if;

  insert into units (subject_id, title, sort_order) values ('cografya_ayt', 'Ekosistem ve Madde Döngüleri', 1) returning id into u_eko;

  insert into topics (unit_id, title, sort_order) values (u_eko, 'Ekosistem Bileşenleri', 1) returning id into t_bilesen;
  insert into topics (unit_id, title, sort_order) values (u_eko, 'Enerji Akışı ve Besin Zinciri', 2) returning id into t_enerji;
  insert into topics (unit_id, title, sort_order) values (u_eko, 'Madde Döngüleri (Karbon, Azot, Su)', 3) returning id into t_dongu;
  insert into topics (unit_id, title, sort_order) values (u_eko, 'Biyoçeşitlilik ve Ekolojik Kavramlar', 4) returning id into t_biyo;

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_bilesen, 'Bir ekosistemde güneş enerjisini kullanarak organik madde üreten canlılara ne ad verilir?',
    jsonb_build_array('Tüketiciler', 'Ayrıştırıcılar', 'Üreticiler', 'Parazitler', 'Simbiyotlar'), 2,
    'Fotosentez yaparak inorganik maddelerden organik madde üreten bitkiler ve bazı bakteriler "üretici" olarak adlandırılır.'),
  (t_bilesen, 'Ölü organizmaları ve organik atıkları parçalayarak inorganik maddelere dönüştüren canlılara ne ad verilir?',
    jsonb_build_array('Üreticiler', 'Ayrıştırıcılar', 'Birincil Tüketiciler', 'Otoburlar', 'Etoburlar'), 1,
    'Bakteri ve mantar gibi ayrıştırıcılar, organik maddeleri parçalayarak besin döngüsünün tamamlanmasını sağlar.'),
  (t_bilesen, 'Bir ekosistemde yalnızca bitkilerle beslenen canlılara ne ad verilir?',
    jsonb_build_array('Etoburlar', 'Ayrıştırıcılar', 'Otoburlar (Birincil Tüketiciler)', 'Üreticiler', 'Omnivorlar'), 2,
    'Yalnızca bitkisel besinlerle beslenen canlılar otobur (birincil/1. dereceden tüketici) olarak adlandırılır.'),
  (t_bilesen, 'Ekosistemin canlı (biyotik) bileşenleri arasında aşağıdakilerden hangisi YER ALMAZ?',
    jsonb_build_array('Üreticiler', 'Tüketiciler', 'Ayrıştırıcılar', 'İklim', 'Mikroorganizmalar'), 3,
    'İklim, toprak, su gibi unsurlar ekosistemin cansız (abiyotik) bileşenlerindendir; biyotik bileşenler canlılardır.'),
  (t_bilesen, 'Belirli bir alanda yaşayan canlılar (biyotik) ile bu canlıların etkileşim içinde olduğu cansız (abiyotik) çevrenin oluşturduğu bütüne ne ad verilir?',
    jsonb_build_array('Popülasyon', 'Habitat', 'Ekosistem', 'Biyom', 'Tür'), 2,
    'Canlılar ile cansız çevrenin madde ve enerji alışverişi içinde oluşturduğu işlevsel bütüne ekosistem denir.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_enerji, 'Ekosistemde enerji akışı temelde hangi kaynağa dayanır?',
    jsonb_build_array('Rüzgar enerjisi', 'Güneş enerjisi', 'Jeotermal enerji', 'Kimyasal enerji', 'Nükleer enerji'), 1,
    'Ekosistemlerdeki enerjinin temel kaynağı güneştir; üreticiler bu enerjiyi fotosentezle organik maddeye dönüştürür.'),
  (t_enerji, 'Besin zincirinde enerji, halkalar arasında hangi yönde aktarılır?',
    jsonb_build_array('Ayrıştırıcıdan üreticiye', 'Üreticiden tüketiciye', 'Tüketiciden üreticiye', 'Rastgele yönde', 'İki yönlü olarak'), 1,
    'Enerji, üreticiden başlayarak birincil, ikincil ve üçüncül tüketicilere doğru tek yönlü olarak aktarılır.'),
  (t_enerji, 'Bir besin zincirinde bir basamaktan diğerine geçen enerjinin büyük kısmına ne olur?',
    jsonb_build_array('Tamamı bir sonraki basamağa aktarılır', 'Solunum ve ısı olarak kullanılıp kaybolur', 'Ayrıştırıcılar tarafından depolanır', 'Yeniden güneşe döner', 'Üreticiler tarafından geri alınır'), 1,
    'Her basamakta enerjinin büyük bölümü canlılık faaliyetleri (solunum vb.) sırasında ısı olarak kaybolur, yalnızca küçük bir kısmı bir sonraki basamağa geçer.'),
  (t_enerji, 'Birbirine bağlı birden çok besin zincirinin oluşturduğu karmaşık yapıya ne ad verilir?',
    jsonb_build_array('Besin Piramidi', 'Besin Ağı', 'Enerji Döngüsü', 'Popülasyon Ağı', 'Habitat Zinciri'), 1,
    'Bir ekosistemdeki çok sayıda besin zincirinin birbirine bağlanmasıyla oluşan karmaşık yapıya besin ağı denir.'),
  (t_enerji, 'Enerji akışı ile madde döngüsü arasındaki temel fark nedir?',
    jsonb_build_array('Enerji ekosistemde tekrar kullanılırken madde kullanılmaz', 'Madde ekosistemde döngüsel biçimde tekrar kullanılırken enerji tek yönlü akar ve kaybolur', 'İkisi de tek yönlüdür', 'İkisi de döngüseldir', 'Aralarında fark yoktur'), 1,
    'Madde (karbon, azot, su vb.) doğada döngüsel olarak tekrar kullanılırken enerji tek yönlü akar ve sonunda ısı olarak sistemden ayrılır.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_dongu, 'Atmosferdeki karbondioksitin fotosentezle organik bileşiklere dönüştürülmesi hangi döngünün bir parçasıdır?',
    jsonb_build_array('Azot Döngüsü', 'Su Döngüsü', 'Karbon Döngüsü', 'Fosfor Döngüsü', 'Oksijen Döngüsü'), 2,
    'Karbon, fotosentez ve solunum süreçleriyle atmosfer-canlılar arasında sürekli döngü hâlindedir; bu karbon döngüsüdür.'),
  (t_dongu, 'Havadaki serbest azotun bitkilerin kullanabileceği forma dönüştürülmesi işlemine ne ad verilir?',
    jsonb_build_array('Fotosentez', 'Azot Bağlama (Fiksasyon)', 'Buharlaşma', 'Terleme', 'Ayrıştırma'), 1,
    'Serbest azotu bitkilerin kullanabileceği bileşiklere dönüştüren işleme azot bağlama (fiksasyonu) denir; bazı bakteriler bu işlevi görür.'),
  (t_dongu, 'Su döngüsünde suyun sıvı hâlden gaz hâline geçerek atmosfere karışmasına ne ad verilir?',
    jsonb_build_array('Yoğuşma', 'Buharlaşma', 'Yağış', 'Sızma', 'Donma'), 1,
    'Suyun ısı alarak sıvıdan gaz hâline geçmesi buharlaşmadır; su döngüsünün ilk aşamalarından biridir.'),
  (t_dongu, 'Fosil yakıtların yakılması hangi madde döngüsünü doğrudan etkileyerek küresel ısınmaya katkıda bulunur?',
    jsonb_build_array('Azot Döngüsü', 'Fosfor Döngüsü', 'Karbon Döngüsü', 'Su Döngüsü', 'Kükürt Döngüsü'), 2,
    'Fosil yakıtların yakılması atmosferdeki karbondioksit miktarını artırarak karbon döngüsünü ve sera etkisini doğrudan etkiler.'),
  (t_dongu, 'Bitkilerin kökleriyle aldığı suyun yapraklardaki gözeneklerden buhar hâlinde atmosfere verilmesine ne ad verilir?',
    jsonb_build_array('Terleme (Transpirasyon)', 'Yoğuşma', 'Sızma', 'Yüzeysel Akış', 'Buzullaşma'), 0,
    'Bitkilerin su kaybının büyük kısmı yapraklardaki stomalardan gerçekleşen terleme (transpirasyon) yoluyla olur; su döngüsüne katkı sağlar.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_biyo, 'Belirli bir alanda yaşayan aynı türe ait bireylerin oluşturduğu topluluğa ne ad verilir?',
    jsonb_build_array('Habitat', 'Popülasyon', 'Komünite (Biyosönoz)', 'Ekosistem', 'Biyom'), 1,
    'Aynı türden bireylerin belirli bir alanda oluşturduğu topluluğa popülasyon denir.'),
  (t_biyo, 'Bir bölgedeki farklı popülasyonların (farklı türlerin) bir arada oluşturduğu topluluğa ne ad verilir?',
    jsonb_build_array('Habitat', 'Popülasyon', 'Komünite (Biyosönoz)', 'Ekolojik Niş', 'Tür'), 2,
    'Farklı türlere ait popülasyonların bir arada yaşadığı topluluğa komünite (biyosönoz) denir.'),
  (t_biyo, 'Bir canlının yaşadığı, üreyip barınabildiği doğal ortama ne ad verilir?',
    jsonb_build_array('Ekolojik Niş', 'Habitat', 'Popülasyon', 'Biyom', 'Komünite'), 1,
    'Bir türün doğal olarak yaşadığı fiziksel ortama habitat (yaşama alanı) denir.'),
  (t_biyo, 'Bir canlının ekosistem içindeki rolünü, beslenme biçimini ve diğer canlılarla ilişkisini ifade eden kavram nedir?',
    jsonb_build_array('Habitat', 'Ekolojik Niş', 'Popülasyon', 'Biyom', 'Tür'), 1,
    'Bir canlının ekosistemdeki "mesleği" olarak da tanımlanan, beslenme ve ilişki biçimini kapsayan kavrama ekolojik niş denir.'),
  (t_biyo, 'Bir bölgedeki canlı türlerinin ve genetik çeşitliliğin zenginliğine ne ad verilir?',
    jsonb_build_array('Popülasyon Yoğunluğu', 'Biyoçeşitlilik', 'Ekolojik Denge', 'Habitat Kaybı', 'Karbon Ayak İzi'), 1,
    'Bir bölgedeki tür, gen ve ekosistem çeşitliliğinin toplamına biyoçeşitlilik denir.');

  insert into flashcards (topic_id, prompt, answer, accepted_answers, explanation) values
  (t_bilesen, 'Fotosentezle organik madde üreten canlılara ne ad verilir?', 'Üreticiler', array['üreticiler','üretici','ureticiler','uretici'], 'Fotosentez yapan canlılara üretici denir.'),
  (t_bilesen, 'Organik atıkları parçalayan canlılara ne ad verilir?', 'Ayrıştırıcılar', array['ayrıştırıcılar','ayrıştırıcı','ayristiricilar','ayristirici'], 'Bakteri/mantar gibi ayrıştırıcılar organik maddeyi parçalar.'),
  (t_bilesen, 'Canlılar ile cansız çevrenin oluşturduğu bütüne ne ad verilir?', 'Ekosistem', array['ekosistem'], 'Biyotik ve abiyotik bileşenlerin bütününe ekosistem denir.'),
  (t_enerji, 'Ekosistemdeki enerjinin temel kaynağı nedir?', 'Güneş', array['güneş','gunes'], 'Enerji akışının temel kaynağı güneştir.'),
  (t_enerji, 'Birbirine bağlı besin zincirlerinin oluşturduğu yapıya ne denir?', 'Besin Ağı', array['besin ağı','besin agi'], 'Çok sayıda besin zincirinin birleşmesiyle besin ağı oluşur.'),
  (t_dongu, 'Serbest azotun bitkilerin kullanabileceği forma dönüştürülmesine ne denir?', 'Azot Bağlama (Fiksasyon)', array['azot bağlama','fiksasyon','azot fiksasyonu','azot baglama'], 'Bakteriler serbest azotu bağlayarak bitkilerin kullanmasını sağlar.'),
  (t_dongu, 'Suyun sıvıdan gaz hâline geçmesine ne denir?', 'Buharlaşma', array['buharlaşma','buharlasma'], 'Su döngüsünün ilk aşaması buharlaşmadır.'),
  (t_dongu, 'Bitkilerin yapraklardan su buharı vermesine ne ad verilir?', 'Terleme (Transpirasyon)', array['terleme','transpirasyon'], 'Yapraklardaki stomalardan su buharı çıkışına terleme denir.'),
  (t_biyo, 'Aynı türe ait bireylerin oluşturduğu topluluğa ne ad verilir?', 'Popülasyon', array['popülasyon','populasyon'], 'Aynı tür bireylerinin topluluğuna popülasyon denir.'),
  (t_biyo, 'Bir canlının doğal yaşama ortamına ne ad verilir?', 'Habitat', array['habitat'], 'Bir türün doğal yaşama alanına habitat denir.'),
  (t_biyo, 'Bir bölgedeki tür ve gen çeşitliliğine ne ad verilir?', 'Biyoçeşitlilik', array['biyoçeşitlilik','biyocesitlilik'], 'Tür/gen/ekosistem çeşitliliğinin toplamına biyoçeşitlilik denir.');

  raise notice 'Coğrafya (AYT) seed tamam: 4 konu / 20 soru / 11 kart.';
end $cografya_ayt$;

-- ----------------------------------------------------------
-- FELSEFE (AYT) — Bilgi Felsefesi
-- ----------------------------------------------------------
do $felsefe_ayt$
declare
  u_bilgi uuid;
  t_kavram uuid; t_imkan uuid; t_akim uuid; t_bilim uuid;
begin
  if exists (select 1 from units where subject_id = 'felsefe_ayt') then
    raise notice 'Felsefe (AYT) içeriği zaten yüklü — atlandı.';
    return;
  end if;

  insert into units (subject_id, title, sort_order) values ('felsefe_ayt', 'Bilgi Felsefesi', 1) returning id into u_bilgi;

  insert into topics (unit_id, title, sort_order) values (u_bilgi, 'Bilgi Felsefesinin Temel Kavramları', 1) returning id into t_kavram;
  insert into topics (unit_id, title, sort_order) values (u_bilgi, 'Doğru Bilginin İmkânı', 2) returning id into t_imkan;
  insert into topics (unit_id, title, sort_order) values (u_bilgi, 'Rasyonalizm ve Empirizm', 3) returning id into t_akim;
  insert into topics (unit_id, title, sort_order) values (u_bilgi, 'Bilim Felsefesine Giriş', 4) returning id into t_bilim;

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_kavram, 'Bilginin ne olduğunu, kaynağını, sınırlarını ve değerini inceleyen felsefe disiplinine ne ad verilir?',
    jsonb_build_array('Ahlak Felsefesi', 'Bilgi Felsefesi (Epistemoloji)', 'Varlık Felsefesi', 'Din Felsefesi', 'Siyaset Felsefesi'), 1,
    'Bilginin kaynağı, doğası ve sınırlarını inceleyen felsefe dalına bilgi felsefesi (epistemoloji) denir.'),
  (t_kavram, 'Bilgi felsefesinde "bilen özne" ile "bilinen nesne" arasındaki ilişkiden ortaya çıkan şeye ne ad verilir?',
    jsonb_build_array('Sanı', 'Bilgi', 'İnanç', 'Önyargı', 'Sezgi'), 1,
    'Bilgi, bilen özne ile bilinen nesne arasındaki ilişkiden doğan üründür.'),
  (t_kavram, 'Herhangi bir kanıta dayanmayan, doğruluğu kesin olarak bilinmeyen fakat inanılan yargıya ne ad verilir?',
    jsonb_build_array('Bilgi', 'Sanı (Doksa)', 'Kanıt', 'İspat', 'Bilim'), 1,
    'Doğruluğu kanıtlanmamış, kişisel kanaate dayanan yargıya sanı (doksa) denir; bilgiden ayrılır.'),
  (t_kavram, 'Bir yargının "bilgi" sayılabilmesi için taşıması gereken temel özelliklerden biri aşağıdakilerden hangisidir?',
    jsonb_build_array('Öznel olması', 'Kanıtlanabilir/doğrulanabilir olması', 'Duygusal olması', 'Değişken olması', 'Kişiye özel olması'), 1,
    'Bir yargının bilgi sayılabilmesi için nesnel ve kanıtlanabilir/doğrulanabilir olması gerekir.'),
  (t_kavram, 'Bilgi felsefesinin temel sorularından biri aşağıdakilerden hangisidir?',
    jsonb_build_array('Var olan nedir?', 'Doğru bilgiye ulaşmak mümkün müdür?', 'İyi ve kötü nedir?', 'Güzellik nedir?', 'Devletin kaynağı nedir?'), 1,
    '"Doğru bilgiye ulaşmak mümkün müdür, bilginin kaynağı nedir?" soruları doğrudan bilgi felsefesinin konusudur; varlık sorusu ontolojiye, iyi-kötü sorusu ahlak felsefesine aittir.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_imkan, 'İnsan aklının hiçbir konuda kesin ve güvenilir bilgiye ulaşamayacağını, her konuda şüpheyle yaklaşılması gerektiğini savunan görüşe ne ad verilir?',
    jsonb_build_array('Dogmatizm', 'Septisizm (Kuşkuculuk)', 'Rasyonalizm', 'Empirizm', 'Kritisizm'), 1,
    'Septisizm (kuşkuculuk), kesin ve genel geçer bilgiye ulaşılamayacağını, her konuda şüphe edilmesi gerektiğini savunur.'),
  (t_imkan, 'İnsan aklının kesin, genel geçer ve doğru bilgiye ulaşabileceğini savunan görüşe ne ad verilir?',
    jsonb_build_array('Septisizm', 'Dogmatizm', 'Rölativizm', 'Nihilizm', 'Agnostisizm'), 1,
    'Dogmatizm, aklın veya deneyimin kesin ve şüphe götürmez bilgiye ulaşabileceğini savunan görüştür.'),
  (t_imkan, 'Nesnelerin/olayların bilgisinin kişiden kişiye, toplumdan topluma değiştiğini, "herkes için geçerli mutlak doğru yoktur" diyen görüşe ne ad verilir?',
    jsonb_build_array('Dogmatizm', 'Rölativizm (Görecelik)', 'Rasyonalizm', 'Kritisizm', 'Pozitivizm'), 1,
    'Rölativizm (görecelik), doğrunun kişiden kişiye veya topluma göre değiştiğini, mutlak/evrensel bir doğrunun olmadığını savunur.'),
  (t_imkan, 'Tanrının veya mutlak gerçekliğin bilinip bilinemeyeceğinin bilinemeyeceğini savunan görüşe ne ad verilir?',
    jsonb_build_array('Ateizm', 'Agnostisizm', 'Deizm', 'Teizm', 'Panteizm'), 1,
    'Agnostisizm, mutlak/aşkın gerçekliğin (örn. Tanrı''nın varlığının) bilinip bilinemeyeceği konusunda kesin bir yargıya varılamayacağını savunur.'),
  (t_imkan, 'Bilgiyi hem akla hem deneyime dayandırıp, aklın sınırlarını eleştirel biçimde belirlemeye çalışan; Kant''ın da temsil ettiği görüşe ne ad verilir?',
    jsonb_build_array('Dogmatizm', 'Septisizm', 'Kritisizm (Eleştiricilik)', 'Rölativizm', 'Nihilizm'), 2,
    'Kritisizm (eleştiricilik), Kant''la özdeşleşen, aklın sınırlarını eleştirel biçimde belirleyerek hem dogmatizmi hem septisizmi aşmaya çalışan görüştür.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_akim, 'Doğru bilginin kaynağının akıl olduğunu, duyuların yanıltıcı olabileceğini savunan görüşe ne ad verilir?',
    jsonb_build_array('Empirizm', 'Rasyonalizm (Akılcılık)', 'Septisizm', 'Pragmatizm', 'Entüisyonizm'), 1,
    'Rasyonalizm, bilginin temel kaynağının akıl olduğunu, doğuştan gelen fikirlerin var olduğunu savunur.'),
  (t_akim, 'Doğru bilginin kaynağının deney ve gözlem (duyu verileri) olduğunu savunan görüşe ne ad verilir?',
    jsonb_build_array('Rasyonalizm', 'Empirizm (Deneycilik)', 'Kritisizm', 'Dogmatizm', 'İdealizm'), 1,
    'Empirizm, bilginin kaynağının duyu deneyimi/gözlem olduğunu, zihnin doğuştan boş bir levha (tabula rasa) olduğunu savunur.'),
  (t_akim, '"Zihin doğuştan boş bir levha (tabula rasa) gibidir, tüm bilgiler deneyimle kazanılır" görüşü hangi akıma aittir?',
    jsonb_build_array('Rasyonalizm', 'Empirizm', 'Kritisizm', 'Rölativizm', 'Septisizm'), 1,
    '"Tabula rasa" kavramı empirist filozof John Locke''a aittir; zihnin doğuştan boş olduğunu, bilginin deneyimle oluştuğunu ifade eder.'),
  (t_akim, '"Doğuştan gelen fikirler (idea innata) vardır" görüşünü savunan felsefe akımı hangisidir?',
    jsonb_build_array('Empirizm', 'Rasyonalizm', 'Pragmatizm', 'Pozitivizm', 'Septisizm'), 1,
    'Rasyonalist filozoflar (örn. Descartes), bazı fikirlerin deneyimden bağımsız, doğuştan zihinde var olduğunu savunmuştur.'),
  (t_akim, 'Matematiksel bilgiyi kesin bilginin en iyi örneği sayan ve akıl yürütmeye dayanan yöntemi savunan görüş hangisidir?',
    jsonb_build_array('Empirizm', 'Rasyonalizm', 'Pragmatizm', 'Septisizm', 'Rölativizm'), 1,
    'Rasyonalistler, matematik gibi akıl yürütmeyle elde edilen kesin bilgiyi model alır; bilginin temelinde deney değil akıl vardır.');

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_bilim, 'Bilimsel bilgiyi diğer bilgi türlerinden ayıran en temel özellik nedir?',
    jsonb_build_array('Öznel olması', 'Sistemli, kanıta dayalı ve doğrulanabilir olması', 'Değişmez olması', 'Sezgiye dayanması', 'Kesinlikle yanılmaz olması'), 1,
    'Bilimsel bilgi; sistemli, gözlem/deneye dayalı, kanıtlanabilir ve eleştiriye açık olma özellikleriyle diğer bilgi türlerinden ayrılır.'),
  (t_bilim, 'Bir bilimsel açıklamanın gözlem ve deneyle test edilebilir, çürütülebilir olması gerektiğini savunan bilim felsefecisi kimdir?',
    jsonb_build_array('Thomas Kuhn', 'Karl Popper', 'Auguste Comte', 'Francis Bacon', 'Rene Descartes'), 1,
    'Karl Popper, bilimselliğin ölçütü olarak "yanlışlanabilirlik" (falsifiabilite) ilkesini önermiştir.'),
  (t_bilim, 'Bilimsel bilginin gözlem ve deneyle elde edilen verilerden genel yasalara ulaşma sürecine ne ad verilir?',
    jsonb_build_array('Tümdengelim', 'Tümevarım', 'Analoji', 'Diyalektik', 'Sezgi'), 1,
    'Tekil gözlemlerden genel yasalara ulaşma yöntemine tümevarım (endüksiyon) denir; deneysel bilimlerde sıkça kullanılır.'),
  (t_bilim, 'Belli bir dönemde bilim insanlarının paylaştığı ortak kavram, yöntem ve kabullerin bütününe Thomas Kuhn''un verdiği ad nedir?',
    jsonb_build_array('Paradigma', 'Dogma', 'Aksiyom', 'Postulat', 'Teorem'), 0,
    'Thomas Kuhn, bir bilim topluluğunun ortak kabul ettiği kavram ve yöntemler bütününü "paradigma" olarak adlandırmıştır.'),
  (t_bilim, 'Genel bir önermeden tikel bir sonuca ulaşma biçimindeki akıl yürütmeye ne ad verilir?',
    jsonb_build_array('Tümevarım', 'Tümdengelim', 'Analoji', 'Sezgi', 'Diyalektik'), 1,
    'Genelden özele/tikele giden akıl yürütme biçimine tümdengelim denir; matematikte ve mantıkta sıkça kullanılır.');

  insert into flashcards (topic_id, prompt, answer, accepted_answers, explanation) values
  (t_kavram, 'Bilginin kaynağını, sınırlarını inceleyen felsefe dalı nedir?', 'Bilgi Felsefesi (Epistemoloji)', array['bilgi felsefesi','epistemoloji'], 'Bilginin kaynağı/sınırlarını inceleyen dala bilgi felsefesi denir.'),
  (t_kavram, 'Kanıtlanmamış, kişisel kanaate dayanan yargıya ne denir?', 'Sanı (Doksa)', array['sanı','doksa','sani'], 'Doğruluğu kanıtlanmamış yargıya sanı denir.'),
  (t_imkan, 'Kesin bilgiye ulaşılamayacağını savunan görüşe ne denir?', 'Septisizm', array['septisizm','kuşkuculuk','kuskuculuk'], 'Septisizm kesin bilgiye ulaşılamayacağını savunur.'),
  (t_imkan, 'Aklın kesin bilgiye ulaşabileceğini savunan görüşe ne denir?', 'Dogmatizm', array['dogmatizm'], 'Dogmatizm kesin bilgiye ulaşılabileceğini savunur.'),
  (t_imkan, 'Doğrunun kişiden kişiye değiştiğini savunan görüşe ne denir?', 'Rölativizm', array['rölativizm','görecelik','relativizm'], 'Rölativizm doğrunun göreceli olduğunu savunur.'),
  (t_akim, 'Bilginin kaynağının akıl olduğunu savunan görüşe ne denir?', 'Rasyonalizm', array['rasyonalizm','akılcılık','akilcilik'], 'Rasyonalizm bilginin kaynağının akıl olduğunu savunur.'),
  (t_akim, 'Bilginin kaynağının deney/gözlem olduğunu savunan görüşe ne denir?', 'Empirizm', array['empirizm','deneycilik'], 'Empirizm bilginin kaynağının deneyim olduğunu savunur.'),
  (t_akim, 'Zihnin doğuştan boş bir levha olduğunu ifade eden kavram nedir?', 'Tabula Rasa', array['tabula rasa'], 'Tabula rasa, zihnin doğuştan boş olduğu görüşüdür.'),
  (t_bilim, 'Bilimselliğin ölçütü olarak "yanlışlanabilirlik"i öneren filozof kimdir?', 'Karl Popper', array['karl popper','popper'], 'Karl Popper yanlışlanabilirlik ilkesini önermiştir.'),
  (t_bilim, 'Bilim topluluğunun ortak kabullerine Thomas Kuhn''un verdiği ad nedir?', 'Paradigma', array['paradigma'], 'Kuhn bu kavrama paradigma demiştir.');

  raise notice 'Felsefe (AYT) seed tamam: 4 konu / 20 soru / 10 kart.';
end $felsefe_ayt$;
