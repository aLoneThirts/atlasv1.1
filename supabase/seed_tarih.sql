-- ============================================================
-- ATLAS — Başlangıç içerik seed'i (BACKEND.md §6.5)
-- Kurulum: schema.sql + finish_quiz.sql'den SONRA SQL Editor'de çalıştır.
--
-- Kapsam:
--   • Tarih: 2 bölüm, 6 konu, 30 soru (5'i prototip TOPIC_QS'ten,
--     kalanı YKS Kuruluş/Yükselme müfredatından başlangıç seti),
--     12 bilgi kartı (prototip CARDS_BY_TOPIC birebir).
--   • Coğrafya + Felsefe: haftalık sınav / yanlış havuzu testleri için
--     minimal konular (prototip WEEKLY_QS + MISTAKES soruları dahil).
--
-- İdempotent: Tarih bölümleri zaten varsa hiçbir şey yazmaz.
-- İçerik tabloları RLS gereği istemciden yazılamaz; bu dosya
-- Dashboard SQL Editor (service_role) ile çalıştırılır.
-- ============================================================

do $seed$
declare
  u_kurulus uuid; u_yukselme uuid; u_fiziki uuid; u_giris uuid;
  t_osman uuid; t_orhan uuid; t_rumeli uuid;
  t_fetret uuid; t_istanbul uuid; t_kanuni uuid;
  t_iklim uuid; t_akarsu uuid; t_ilkcag uuid;
begin
  if exists (select 1 from units where subject_id = 'tarih') then
    raise notice 'Tarih içeriği zaten yüklü — seed atlandı.';
    return;
  end if;

  -- ----------------------------------------------------------
  -- TARİH — bölümler ve konular (prototip TOPICS dizisiyle aynı)
  -- ----------------------------------------------------------
  insert into units (subject_id, title, sort_order) values ('tarih', 'Kuruluş Dönemi', 1) returning id into u_kurulus;
  insert into units (subject_id, title, sort_order) values ('tarih', 'Yükselme Dönemi', 2) returning id into u_yukselme;

  insert into topics (unit_id, title, sort_order) values (u_kurulus, 'Osman Bey Dönemi', 1) returning id into t_osman;
  insert into topics (unit_id, title, sort_order) values (u_kurulus, 'Orhan Bey Dönemi', 2) returning id into t_orhan;
  insert into topics (unit_id, title, sort_order) values (u_kurulus, 'Rumeli''ye Geçiş', 3) returning id into t_rumeli;
  insert into topics (unit_id, title, sort_order) values (u_yukselme, 'Ankara Savaşı ve Fetret Devri', 1) returning id into t_fetret;
  insert into topics (unit_id, title, sort_order) values (u_yukselme, 'İstanbul''un Fethi', 2) returning id into t_istanbul;
  insert into topics (unit_id, title, sort_order) values (u_yukselme, 'Kanuni ve Zirve Dönemi', 3) returning id into t_kanuni;

  -- ----------------------------------------------------------
  -- SORULAR — Osman Bey Dönemi
  -- ----------------------------------------------------------
  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_osman, 'Osmanlı Devleti hangi yıl kurulmuştur?',
    jsonb_build_array('1071', '1299', '1326', '1353', '1453'), 1,
    'Osman Bey, 1299''da Söğüt ve Domaniç çevresinde bağımsızlığını ilan etti; bu tarih devletin kuruluşu kabul edilir.'),
  (t_osman, 'Osmanlılar hangi Türk boyundan gelmektedir?',
    jsonb_build_array('Kınık', 'Kayı', 'Avşar', 'Bayat', 'Çepni'), 1,
    'Osmanlılar, Oğuzların Bozok koluna bağlı Kayı boyundandır.'),
  (t_osman, 'Osmanlı Devleti''nin kuruluş dönemindeki ilk merkezi neresidir?',
    jsonb_build_array('Bursa', 'İznik', 'Söğüt', 'Konya', 'Edirne'), 2,
    'Kuruluşta merkez Söğüt''tü; 1326''da Bursa''nın fethiyle başkent Bursa oldu.'),
  (t_osman, 'Osmanlı ile Bizans arasında yapılan ilk savaş aşağıdakilerden hangisidir?',
    jsonb_build_array('Maltepe (Palekanon) Savaşı', 'Koyunhisar (Bafeon) Savaşı', 'Sırpsındığı Savaşı', 'Çirmen Savaşı', 'I. Kosova Savaşı'), 1,
    '1302 Koyunhisar (Bafeon) Savaşı, Osman Bey ile Bizans arasındaki ilk savaştır; Osmanlı''nın adını duyurmasını sağladı.'),
  (t_osman, 'Osman Bey''in kayınpederi olan ve kuruluşta Ahi çevrelerinin desteğini sağlayan kişi kimdir?',
    jsonb_build_array('Şeyh Edebali', 'Ahi Evran', 'Hacı Bektaş-ı Veli', 'Dursun Fakih', 'Şeyh Bedreddin'), 0,
    'Şeyh Edebali''nin desteği, kuruluş sürecinde Ahi teşkilatının ve halkın desteğini Osmanlı''ya kazandırdı.');

  -- ----------------------------------------------------------
  -- SORULAR — Orhan Bey Dönemi
  -- ----------------------------------------------------------
  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_orhan, 'Orhan Bey döneminde kurulan ilk düzenli ordu birlikleri aşağıdakilerden hangisidir?',
    jsonb_build_array('Kapıkulu Ocakları', 'Yaya ve Müsellem', 'Akıncılar', 'Yeniçeri Ocağı', 'Tımarlı Sipahiler'), 1,
    'Yaya (piyade) ve Müsellem (atlı) birlikleri, Orhan Bey döneminde kurulan ilk düzenli ordudur.'),
  (t_orhan, 'İlk Osmanlı medresesi hangi şehirde açılmıştır?',
    jsonb_build_array('Bursa', 'İznik', 'Söğüt', 'Edirne', 'İstanbul'), 1,
    '1331''de İznik''te açılan medrese, Osmanlı''nın ilk yükseköğretim kurumudur; başına Davud-ı Kayserî getirildi.'),
  (t_orhan, '1326''da fethedilerek başkent yapılan şehir aşağıdakilerden hangisidir?',
    jsonb_build_array('İznik', 'İzmit', 'Bursa', 'Edirne', 'Ankara'), 2,
    'Bursa''nın fethiyle devlet, beylikten devlete geçişini hızlandırdı ve Bursa başkent yapıldı.'),
  (t_orhan, 'Maltepe (Palekanon) Savaşı hangi devlete karşı yapılmıştır?',
    jsonb_build_array('Sırbistan', 'Bulgaristan', 'Bizans', 'Macaristan', 'Karamanoğulları'), 2,
    '1329 Maltepe (Palekanon) Savaşı''nda Bizans yenilgiye uğratıldı; İznik ve İzmit''in fethinin yolu açıldı.'),
  (t_orhan, 'Osmanlı Devleti''ne katılan ve donanmanın temelini oluşturan ilk beylik hangisidir?',
    jsonb_build_array('Germiyanoğulları', 'Karesioğulları', 'Aydınoğulları', 'Menteşeoğulları', 'Candaroğulları'), 1,
    'Karesioğulları''nın alınmasıyla (1345) Osmanlı ilk donanmasına kavuştu ve Rumeli''ye geçiş kolaylaştı.');

  -- ----------------------------------------------------------
  -- SORULAR — Rumeli'ye Geçiş
  -- ----------------------------------------------------------
  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_rumeli, 'Rumeli''ye geçişte üs olarak kullanılan ilk toprak parçası hangisidir?',
    jsonb_build_array('Gelibolu', 'Edirne', 'Çimpe Kalesi', 'Selanik', 'Varna'), 2,
    '1353''te alınan Çimpe Kalesi, Osmanlı''nın Rumeli''deki ilk toprağı ve fetihlerde üs oldu.'),
  (t_rumeli, 'Çimpe Kalesi hangi yıl alınmıştır?',
    jsonb_build_array('1299', '1326', '1353', '1362', '1402'), 2,
    'Çimpe Kalesi 1353''te, Orhan Bey döneminde alındı; Balkan fetihlerinin başlangıç noktası oldu.'),
  (t_rumeli, 'Rumeli fetihlerini yöneten, Orhan Bey''in oğlu olan komutan kimdir?',
    jsonb_build_array('Süleyman Paşa', 'Murad Hüdavendigar', 'Savcı Bey', 'Yıldırım Bayezid', 'Çandarlı Halil'), 0,
    'Süleyman Paşa, Çimpe''nin alınması ve Rumeli''deki ilk fetihlerin komutanıdır.'),
  (t_rumeli, 'Fethedilen Rumeli topraklarına Anadolu''dan Türk nüfus yerleştirme politikasına ne ad verilir?',
    jsonb_build_array('Devşirme', 'İskân', 'Müsadere', 'Pençik', 'Cülus'), 1,
    'İskân politikası, Rumeli''de kalıcılığı ve bölgenin Türkleşmesini sağlayan temel uygulamadır.'),
  (t_rumeli, 'Osmanlıların Rumeli''ye geçişiyle aşağıdakilerden hangisi gerçekleşmiştir?',
    jsonb_build_array('Balkan fetihlerinin başlaması', 'Anadolu Türk siyasi birliğinin sağlanması', 'Bizans''ın yıkılması', 'Haçlı Seferlerinin sona ermesi', 'Karesi Beyliği''nin kurulması'), 0,
    'Çimpe''nin üs yapılmasıyla Osmanlı, Balkanlar''da kalıcı fetih dönemini başlattı.');

  -- ----------------------------------------------------------
  -- SORULAR — Ankara Savaşı ve Fetret Devri (prototip TOPIC_QS birebir)
  -- ----------------------------------------------------------
  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_fetret, 'Ankara Savaşı (1402) hangi iki hükümdar arasında yapılmıştır?',
    jsonb_build_array('II. Murad – Hunyadi Yanoş', 'Yıldırım Bayezid – Timur', 'I. Murad – Sırp Kralı Lazar', 'Çelebi Mehmed – Musa Çelebi', 'Orhan Bey – Kantakuzen'), 1,
    '1402 Ankara Savaşı''nda Yıldırım Bayezid, Timur''a yenildi. Bu yenilgiyle Anadolu''da siyasi birlik bozuldu ve Fetret Devri başladı.'),
  (t_fetret, 'Ankara Savaşı''nın ardından şehzadeler arasında yaşanan 11 yıllık taht mücadelesi dönemine ne ad verilir?',
    jsonb_build_array('Lale Devri', 'Nizam-ı Cedid Dönemi', 'Fetret Devri', 'Duraklama Dönemi', 'Islahat Dönemi'), 2,
    '1402–1413 arasında Yıldırım''ın oğulları taht için mücadele etti. Bu otorite boşluğu dönemine "Fetret Devri" denir.'),
  (t_fetret, 'Fetret Devri''ne son vererek Osmanlı''da siyasi birliği yeniden sağlayan padişah kimdir?',
    jsonb_build_array('Çelebi Mehmed', 'II. Murad', 'Yıldırım Bayezid', 'II. Mehmed', 'Musa Çelebi'), 0,
    'Çelebi Mehmed 1413''te kardeşlerine üstünlük sağlayarak birliği kurdu. Bu yüzden "devletin ikinci kurucusu" kabul edilir.'),
  (t_fetret, 'Fetret Devri''nde Osmanlı''nın Balkanlar''da büyük toprak kaybı yaşamamasının temel nedeni aşağıdakilerden hangisidir?',
    jsonb_build_array('Timur''un Balkanlara yönelmesi', 'Uygulanan iskân ve hoşgörü politikası', 'Haçlı ordularının dağılması', 'Bizans''ın Osmanlı''yı desteklemesi', 'Denizlerdeki Osmanlı üstünlüğü'), 1,
    'Adaletli yönetim, iskân ve hoşgörü politikası sayesinde Balkan halkları Osmanlı yönetiminden memnundu ve ayaklanmadı.'),
  (t_fetret, 'Devletin sosyal düzenini sarsan Şeyh Bedreddin İsyanı hangi padişah döneminde bastırılmıştır?',
    jsonb_build_array('Çelebi Mehmed', 'II. Murad', 'Yıldırım Bayezid', 'Fatih Sultan Mehmed', 'II. Bayezid'), 0,
    'Şeyh Bedreddin İsyanı (1416–1420), Fetret sonrası toparlanma sürecinde Çelebi Mehmed döneminde bastırıldı.');

  -- ----------------------------------------------------------
  -- SORULAR — İstanbul'un Fethi
  -- ----------------------------------------------------------
  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_istanbul, 'İstanbul''u fethederek Orta Çağ''ı kapatan Osmanlı padişahı kimdir?',
    jsonb_build_array('Yıldırım Bayezid', 'II. Murad', 'Kanuni Sultan Süleyman', 'II. Mehmed (Fatih)', 'Yavuz Sultan Selim'), 3,
    'II. Mehmed 1453''te İstanbul''u fethetti; bu olay Orta Çağ''ın sonu kabul edilir.'),
  (t_istanbul, 'İstanbul hangi yıl fethedilmiştir?',
    jsonb_build_array('1444', '1448', '1453', '1461', '1473'), 2,
    'Kuşatma 6 Nisan 1453''te başladı; şehir 29 Mayıs 1453''te fethedildi.'),
  (t_istanbul, 'İstanbul''un fethinin dünya tarihi bakımından en önemli sonucu aşağıdakilerden hangisidir?',
    jsonb_build_array('Orta Çağ''ın kapanıp Yeni Çağ''ın başlaması', 'Reform hareketlerinin başlaması', 'Sanayi İnkılabı''nın başlaması', 'Coğrafi Keşiflerin sona ermesi', 'Haçlı Seferlerinin başlaması'), 0,
    'Surların büyük toplarla yıkılabildiğinin görülmesi ve Bizans''ın yıkılması, Orta Çağ''ı kapatıp Yeni Çağ''ı başlatan gelişme sayılır.'),
  (t_istanbul, 'Fatih''in kuşatma sırasında gemileri karadan yürütmesinin amacı aşağıdakilerden hangisidir?',
    jsonb_build_array('Karadeniz''e açılmak', 'Donanmayı Haliç''e sokmak', 'Boğazı ticarete kapatmak', 'Ceneviz kolonilerini ele geçirmek', 'Surları denizden aşmak'), 1,
    'Zincirle kapatılan Haliç''e gemilerin karadan indirilmesi, şehri deniz tarafından da kuşatmayı sağladı.'),
  (t_istanbul, 'İstanbul''un fethini kolaylaştıran etkenlerden biri aşağıdakilerden hangisidir?',
    jsonb_build_array('Bizans''ın taht kavgaları içinde olması ve dışarıdan yardım alamaması', 'Anadolu''da Türk siyasi birliğinin bozulması', 'Yeniçeri Ocağı''nın kaldırılması', 'Timur tehlikesinin sürmesi', 'Haçlı ordusunun şehri savunması'), 0,
    'Bizans içte zayıflamış, Avrupa''dan beklediği yardımı alamamıştı; Osmanlı ise kuşatmayı şahi toplarıyla destekledi.');

  -- ----------------------------------------------------------
  -- SORULAR — Kanuni ve Zirve Dönemi
  -- ----------------------------------------------------------
  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_kanuni, 'Kanuni Sultan Süleyman hangi yıllar arasında tahtta kalmıştır?',
    jsonb_build_array('1512–1520', '1520–1566', '1451–1481', '1566–1574', '1481–1512'), 1,
    'Kanuni, 46 yıllık saltanatıyla (1520–1566) en uzun süre tahtta kalan Osmanlı padişahıdır.'),
  (t_kanuni, '1526 Mohaç Meydan Savaşı hangi devlete karşı kazanılmıştır?',
    jsonb_build_array('Avusturya', 'Macaristan', 'Lehistan', 'Venedik', 'Safevi Devleti'), 1,
    'Yaklaşık iki saat süren Mohaç Savaşı''yla Macaristan''ın büyük bölümü Osmanlı egemenliğine girdi.'),
  (t_kanuni, '1538 Preveze Deniz Zaferi''nde Osmanlı donanmasına komuta eden denizci kimdir?',
    jsonb_build_array('Turgut Reis', 'Barbaros Hayreddin Paşa', 'Piri Reis', 'Kılıç Ali Paşa', 'Piyale Paşa'), 1,
    'Barbaros Hayreddin Paşa''nın Preveze zaferiyle Akdeniz''de üstünlük Osmanlı''ya geçti.'),
  (t_kanuni, 'Avusturya arşidükünün protokolde Osmanlı sadrazamına denk sayıldığı 1533 tarihli antlaşma hangisidir?',
    jsonb_build_array('Zitvatorok Antlaşması', 'İstanbul (İbrahim Paşa) Antlaşması', 'Karlofça Antlaşması', 'Vasvar Antlaşması', 'Amasya Antlaşması'), 1,
    '1533 İstanbul Antlaşması, Osmanlı''nın Avusturya karşısındaki siyasi üstünlüğünü belgeledi.'),
  (t_kanuni, 'Kanuni döneminde kapitülasyonlar ilk kez kapsamlı biçimde hangi devlete verilmiştir?',
    jsonb_build_array('İngiltere', 'Fransa', 'Hollanda', 'Venedik', 'Ceneviz'), 1,
    '1535''te Fransa''ya verilen kapitülasyonlarla Avrupa Hristiyan birliğinin parçalanması amaçlandı.');

  -- ----------------------------------------------------------
  -- BİLGİ KARTLARI (prototip CARDS_BY_TOPIC birebir)
  -- ----------------------------------------------------------
  insert into flashcards (topic_id, prompt, answer, accepted_answers, explanation) values
  (t_osman, 'Osmanlı Devleti hangi yıl kuruldu?', '1299',
    array['1299'], 'Osman Bey, 1299''da Söğüt ve Domaniç çevresinde bağımsızlığını ilan etti.'),
  (t_osman, 'Osmanlı Devleti''nin kurulduğu ilk merkez neresidir?', 'Söğüt',
    array['söğüt','sogut','söğut','sögüt'], 'Kuruluşta merkez Söğüt''tü; 1326''da Bursa başkent oldu.'),
  (t_osman, 'Osmanlılar hangi Türk boyundan gelmektedir?', 'Kayı Boyu',
    array['kayı','kayi'], 'Osmanlılar, Oğuzların Bozok koluna bağlı Kayı boyundandır.'),

  (t_orhan, 'İlk Osmanlı medresesi hangi şehirde açıldı?', 'İznik',
    array['iznik'], '1331''de İznik''te açılan medrese, Osmanlı''nın ilk yükseköğretim kurumudur.'),
  (t_orhan, 'Orhan Bey''in kurduğu ilk düzenli ordu birliklerinin adı nedir?', 'Yaya ve Müsellem',
    array['yaya ve müsellem','yaya','müsellem','musellem','yaya müsellem'], 'Yaya (piyade) ve Müsellem (atlı) birlikleri ilk düzenli ordudur.'),
  (t_orhan, '1326''da fethedilip başkent yapılan şehir hangisidir?', 'Bursa',
    array['bursa'], 'Bursa''nın fethiyle devlet, beylikten devlete geçişini hızlandırdı.'),

  (t_rumeli, 'Rumeli''de alınan ilk toprak parçası hangisidir?', 'Çimpe Kalesi',
    array['çimpe','cimpe','çimpe kalesi','cimpe kalesi'], '1353''te alınan Çimpe Kalesi, Balkan fetihlerinin üssü oldu.'),
  (t_rumeli, 'Çimpe Kalesi hangi yıl alındı?', '1353',
    array['1353'], 'Orhan Bey döneminde, oğlu Süleyman Paşa komutasında alındı.'),
  (t_rumeli, 'Fethedilen Balkan topraklarına Anadolu''dan Türk nüfus yerleştirme politikasının adı nedir?', 'İskân Politikası',
    array['iskan','iskân','iskan politikası','iskân politikası'], 'İskân politikası, Rumeli''de kalıcılığı sağlayan temel uygulamadır.'),

  (t_fetret, 'Fetret Devri hangi savaşın ardından başlamıştır?', 'Ankara Savaşı',
    array['ankara','ankara savaşı','ankara savasi'], '1402 Ankara Savaşı''nda Yıldırım Bayezid, Timur''a yenildi.'),
  (t_fetret, 'Ankara Savaşı hangi yıl yapılmıştır?', '1402',
    array['1402'], '1402''deki yenilgiyle Anadolu''da 11 yıllık otorite boşluğu doğdu.'),
  (t_fetret, 'Fetret Devri''ni sona erdiren padişah kimdir?', 'Çelebi Mehmed',
    array['çelebi','celebi','çelebi mehmed','celebi mehmed','mehmed çelebi','1. mehmed','i. mehmed','1.mehmed'], 'Çelebi Mehmed 1413''te birliği sağladı; "ikinci kurucu" sayılır.');

  -- ----------------------------------------------------------
  -- COĞRAFYA — haftalık sınav / yanlış havuzu test içeriği
  -- (prototip WEEKLY_QS + MISTAKES soruları dahil)
  -- ----------------------------------------------------------
  insert into units (subject_id, title, sort_order) values ('cografya', 'Türkiye''nin Fiziki Coğrafyası', 1) returning id into u_fiziki;

  insert into topics (unit_id, title, sort_order) values (u_fiziki, 'İklim Tipleri', 1) returning id into t_iklim;
  insert into topics (unit_id, title, sort_order) values (u_fiziki, 'Türkiye''nin Akarsuları', 2) returning id into t_akarsu;

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_iklim, 'Karadeniz ikliminin doğal bitki örtüsü aşağıdakilerden hangisidir?',
    jsonb_build_array('Bozkır', 'Maki', 'Orman', 'Çayır', 'Garig'), 2,
    'Her mevsim yağışlı Karadeniz ikliminin doğal bitki örtüsü ormandır.'),
  (t_iklim, 'Yazları sıcak ve kurak, kışları ılık ve yağışlı geçen iklim tipi hangisidir?',
    jsonb_build_array('Karadeniz iklimi', 'Akdeniz iklimi', 'Karasal iklim', 'Tundra iklimi', 'Muson iklimi'), 1,
    'Akdeniz ikliminde yazlar sıcak ve kurak, kışlar ılık ve yağışlıdır; bitki örtüsü makidir.'),
  (t_iklim, 'Karasal iklimin doğal bitki örtüsü aşağıdakilerden hangisidir?',
    jsonb_build_array('Orman', 'Maki', 'Bozkır', 'Garig', 'Tundra'), 2,
    'Yağışın az olduğu karasal iklimde ilkbahar yağışlarıyla yeşerip yazın kuruyan bozkır görülür.'),
  (t_akarsu, 'Türkiye sınırları içinden doğup yine Türkiye''den denize dökülen en uzun akarsu hangisidir?',
    jsonb_build_array('Fırat', 'Sakarya', 'Kızılırmak', 'Yeşilırmak', 'Seyhan'), 2,
    'Kızılırmak (1.355 km), tamamı Türkiye sınırları içinde kalan en uzun akarsudur.'),
  (t_akarsu, 'Türkiye akarsularının hidroelektrik potansiyelinin yüksek olması aşağıdakilerden hangisiyle ilgilidir?',
    jsonb_build_array('Boylarının uzun olması', 'Yatak eğimlerinin fazla olması', 'Rejimlerinin düzenli olması', 'Denize dökülmeleri', 'Kar sularıyla beslenmeleri'), 1,
    'Ortalama yükseltisi fazla olan Türkiye''de akarsuların yatak eğimi, dolayısıyla akış hızı ve enerji potansiyeli yüksektir.'),
  (t_akarsu, 'Kaynağını Türkiye''den alıp toplam uzunluğu en fazla olan akarsu hangisidir?',
    jsonb_build_array('Kızılırmak', 'Fırat', 'Dicle', 'Sakarya', 'Yeşilırmak'), 1,
    'Toplam uzunlukta en uzunu Fırat''tır; tamamı Türkiye''de kalan en uzun akarsu ise Kızılırmak''tır.');

  -- ----------------------------------------------------------
  -- FELSEFE — haftalık sınav / yanlış havuzu test içeriği
  -- ----------------------------------------------------------
  insert into units (subject_id, title, sort_order) values ('felsefe', 'Felsefeye Giriş', 1) returning id into u_giris;

  insert into topics (unit_id, title, sort_order) values (u_giris, 'İlkçağ Felsefesi', 1) returning id into t_ilkcag;

  insert into questions (topic_id, prompt, options, correct_index, explanation) values
  (t_ilkcag, '"Sorgulanmamış bir hayat yaşanmaya değmez" sözü hangi filozofa aittir?',
    jsonb_build_array('Platon', 'Sokrates', 'Aristoteles', 'Herakleitos', 'Epiküros'), 1,
    'Bu söz, savunmasında dile getiren Sokrates''e aittir; felsefesinin merkezinde sorgulama vardır.'),
  (t_ilkcag, '"Değişmeyen tek şey değişimin kendisidir" görüşünü savunan filozof kimdir?',
    jsonb_build_array('Parmenides', 'Herakleitos', 'Thales', 'Demokritos', 'Pisagor'), 1,
    'Herakleitos, evrenin sürekli bir oluş (değişim) içinde olduğunu savunur; "Aynı ırmakta iki kez yıkanılmaz."'),
  (t_ilkcag, 'İlk filozof kabul edilen ve arkhe''yi "su" olarak açıklayan düşünür kimdir?',
    jsonb_build_array('Anaksimandros', 'Thales', 'Anaksimenes', 'Empedokles', 'Sokrates'), 1,
    'Miletli Thales, evrenin ana maddesini (arkhe) su olarak açıklayan ilk filozoftur.');

  raise notice 'Seed tamam: Tarih 6 konu / 30 soru / 12 kart, Coğrafya 2 konu / 6 soru, Felsefe 1 konu / 3 soru.';
end $seed$;
