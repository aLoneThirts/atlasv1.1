import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
  type TextInputKeyPressEventData,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WeakTopicsPicker } from '@/components/koc/weak-topics-picker';
import { Btn3D } from '@/components/ui/btn-3d';
import { Interactive } from '@/components/ui/interactive';
import { MarkdownText } from '@/components/ui/markdown-text';
import { Pill } from '@/components/ui/pill';
import { TypingDots } from '@/components/ui/animated/typing-dots';
import { AtlasColors, AtlasFonts, AtlasRadius } from '@/constants/atlas-theme';
import {
  fetchCoachHistory,
  fetchOpenMistakes,
  fetchProfile,
  fetchWeeklySummary,
  fetchXpToday,
  saveMockExam,
  sendCoachMessage,
} from '@/lib/queries';
import type { MockExamNets, Profile, WeeklySummary } from '@/lib/types';

const COACH_AVATAR = require('@/assets/images/atlas/mascot-wave.png');

const GREETING = 'Selam! Ben Atlas Koçun 👋 Nasıl gidiyor, sana nasıl yardımcı olabilirim?';

const MIN_INPUT_H = 22;
const MAX_INPUT_H = 120;

/** Deneme (mock exam) giriş alanları — jenerik TYT netleri. */
const DENEME_FIELDS = [
  { key: 'turkce', label: 'Türkçe', subject: 'Türkçe' },
  { key: 'matematik', label: 'Matematik', subject: 'Matematik' },
  { key: 'tarih', label: 'Tarih', subject: 'Tarih' },
  { key: 'cografya', label: 'Coğrafya', subject: 'Coğrafya' },
  { key: 'felsefe', label: 'Felsefe', subject: 'Felsefe' },
  { key: 'fen', label: 'Fen', subject: 'Fen' },
] as const;

type DenemeKey = (typeof DENEME_FIELDS)[number]['key'];

/** Yerel sohbet öğesi — kalıcı değil, ekranda render için union. */
type ChatItem =
  | { kind: 'msg'; id: string; role: 'user' | 'coach'; content: string }
  | { kind: 'typing'; id: string }
  | { kind: 'system'; id: string; content: string }
  | { kind: 'practice-cta'; id: string; topicIds: string[] };

let counter = 0;
function uid(): string {
  counter += 1;
  return `local-${Date.now()}-${counter}`;
}

/**
 * EKRAN 11 — Koç (AI sohbet)
 * Canlı coach-chat Edge Function'ına bağlı gerçek sohbet ekranı. ChatGPT
 * kalıbı: konuşma başlamadan önce ortalanmış bir karşılama + öneri kartları
 * ekranı, konuşma başlayınca standart mesaj listesi + tek satır büyüyebilen
 * giriş kutusu. Prototip (../index.html #scr-coach) yalnız görsel referans;
 * canlı cevaplar sendCoachMessage() üzerinden DeepSeek'ten gelir.
 */
export default function CoachScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { openDeneme } = useLocalSearchParams<{ openDeneme?: string }>();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [xpToday, setXpToday] = useState(0);
  const [weakest, setWeakest] = useState<{ name: string; count: number } | null>(null);
  const [daysToExam, setDaysToExam] = useState<number | null>(null);
  const [weekly, setWeekly] = useState<WeeklySummary | null>(null);

  const [items, setItems] = useState<ChatItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [inputH, setInputH] = useState(MIN_INPUT_H);
  const [sending, setSending] = useState(false);

  const [denemeOpen, setDenemeOpen] = useState(openDeneme === '1');

  // Sekmeler monte kalır — Deneme sekmesinden "+ Yeni Deneme" ile gelindiğinde
  // useState initializer tekrar çalışmaz, param'ı ayrıca izlemek gerekir.
  useEffect(() => {
    if (openDeneme === '1') setDenemeOpen(true);
  }, [openDeneme]);
  const [denemeVals, setDenemeVals] = useState<Record<DenemeKey, string>>({
    turkce: '',
    matematik: '',
    tarih: '',
    cografya: '',
    felsefe: '',
    fen: '',
  });
  const [denemeWarn, setDenemeWarn] = useState(false);
  const [weakTopics, setWeakTopics] = useState<Set<string>>(new Set());

  const scrollRef = useRef<ScrollView>(null);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    setLoadError(null);
    let p: Profile;
    try {
      p = await fetchProfile();
      setProfile(p);
    } catch (e) {
      // Profil çekilemezse gate zaten null profile ile premium-değil gibi davranır.
      console.error('[koc] fetchProfile başarısız:', e);
      setLoading(false);
      return;
    }

    // Sınava kalan gün — render-dışı (impure Date.now() render'da yasak)
    if (p.exam_date) {
      const exam = new Date(p.exam_date).getTime();
      if (!Number.isNaN(exam)) {
        const diff = Math.ceil((exam - Date.now()) / (24 * 60 * 60 * 1000));
        setDaysToExam(diff >= 0 ? diff : null);
      }
    }

    if (!p.is_premium) {
      setLoading(false);
      return;
    }

    // Premium onaylandı — sohbet ekranını burada göstermeye başla. Aşağıdaki
    // bağlam/geçmiş çekimi ayrı bir try/catch'te: biri başarısız olursa ekran
    // sonsuza dek boş kalmasın (önceki sürümde TEK try/catch vardı — Promise.all
    // içindeki herhangi bir sorgu patlarsa `items` hiç dolmuyor, hata sessizce
    // yutulup kullanıcı boş bir ekranla baş başa kalıyordu, bkz. proje geçmişi).
    setLoading(false);
    try {
      const [history, xp, mistakes, weeklySummary] = await Promise.all([
        fetchCoachHistory(),
        fetchXpToday(),
        fetchOpenMistakes(),
        fetchWeeklySummary(),
      ]);
      setXpToday(xp);

      // En zayıf ders: son 30 gün açık yanlışları subjectName'e göre say
      let best: { name: string; count: number } | null = null;
      if (mistakes.length > 0) {
        const counts = new Map<string, number>();
        for (const m of mistakes) counts.set(m.subjectName, (counts.get(m.subjectName) ?? 0) + 1);
        for (const [name, count] of counts) {
          if (!best || count > best.count) best = { name, count };
        }
      }
      setWeakest(best);
      setWeekly({ ...weeklySummary, weakestSubjectName: best?.name ?? null });

      const historyItems: ChatItem[] = history.map((m) => ({
        kind: 'msg',
        id: `srv-${m.id}`,
        role: m.role,
        content: m.content,
      }));
      // Boş geçmiş: kalıcı olmayan dostça bir açılış balonu
      setItems(
        historyItems.length > 0
          ? historyItems
          : [{ kind: 'msg', id: 'greeting', role: 'coach', content: GREETING }],
      );
    } catch (e) {
      console.error('[koc] sohbet geçmişi/bağlam yüklenemedi:', e);
      // En azından karşılama ekranı görünsün — boş bir void yerine.
      setItems((prev) => (prev.length > 0 ? prev : [{ kind: 'msg', id: 'greeting', role: 'coach', content: GREETING }]));
      setLoadError('Bazı veriler yüklenemedi — internetini kontrol edip aşağı çekerek tekrar dene.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (loadedRef.current) return;
      loadedRef.current = true;
      load();
    }, [load]),
  );

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  /** Ortak gönderim yolu — ekranda displayText, backend'e promptText gider. */
  const ask = useCallback(
    async (promptText: string, displayText?: string) => {
      if (sending) return;
      const shown = displayText ?? promptText;
      const typingId = uid();
      setItems((prev) => [
        ...prev,
        { kind: 'msg', id: uid(), role: 'user', content: shown },
        { kind: 'typing', id: typingId },
      ]);
      setSending(true);
      try {
        const reply = await sendCoachMessage(promptText);
        setItems((prev) => [
          ...prev.filter((i) => i.id !== typingId),
          { kind: 'msg', id: uid(), role: 'coach', content: reply },
        ]);
      } catch (e) {
        const code = e instanceof Error ? e.message : '';
        const msg =
          code === 'rate_limited'
            ? 'Bugünlük mesaj hakkın doldu (30/gün) — yarın devam edelim 😊'
            : code === 'coach_unavailable'
              ? 'Koç şu an cevap veremiyor, birazdan tekrar dener misin?'
              : 'Bir şeyler ters gitti, tekrar dener misin?';
        setItems((prev) => [
          ...prev.filter((i) => i.id !== typingId),
          { kind: 'system', id: uid(), content: msg },
        ]);
      } finally {
        setSending(false);
      }
    },
    [sending],
  );

  const onSend = useCallback(() => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setInputH(MIN_INPUT_H);
    ask(text);
  }, [input, sending, ask]);

  // Web'de Enter gönderir, Shift+Enter yeni satır açar (ChatGPT kalıbı) —
  // native'de multiline TextInput onSubmitEditing tetiklemez, gönderim yalnız
  // sağdaki butonla yapılır.
  const onInputKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (Platform.OS !== 'web') return;
      const ne = e.nativeEvent as unknown as { key?: string; shiftKey?: boolean; preventDefault?: () => void };
      if (ne.key === 'Enter' && !ne.shiftKey) {
        ne.preventDefault?.();
        onSend();
      }
    },
    [onSend],
  );

  const onInputContentSizeChange = useCallback((e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
    setInputH(Math.max(MIN_INPUT_H, Math.min(MAX_INPUT_H, e.nativeEvent.contentSize.height)));
  }, []);

  const onQuick = useCallback(
    (text: string) => {
      if (sending) return;
      ask(text);
    },
    [sending, ask],
  );

  const onSaveDeneme = useCallback(async () => {
    const entries = DENEME_FIELDS.map((f) => {
      const raw = denemeVals[f.key].replace(',', '.').trim();
      const val = raw === '' ? NaN : Number(raw);
      return { subject: f.subject, val };
    }).filter((e) => Number.isFinite(e.val));

    if (entries.length === 0 || !entries.some((e) => e.val > 0)) {
      setDenemeWarn(true);
      return;
    }

    const nets: MockExamNets = {};
    let total = 0;
    for (const e of entries) {
      nets[e.subject] = e.val;
      total += e.val;
    }
    const totalStr = Number.isInteger(total) ? String(total) : total.toFixed(1);

    const weakTopicIds = Array.from(weakTopics);

    setDenemeWarn(false);
    setDenemeOpen(false);
    setDenemeVals({ turkce: '', matematik: '', tarih: '', cografya: '', felsefe: '', fen: '' });
    setWeakTopics(new Set());

    try {
      await saveMockExam(nets, weakTopicIds);
    } catch {
      setItems((prev) => [
        ...prev,
        { kind: 'system', id: uid(), content: 'Deneme kaydedilemedi, tekrar dener misin?' },
      ]);
      return;
    }

    await ask(
      `Deneme sonucumu girdim, toplam ${totalStr} net.`,
      `📝 Deneme sonucumu girdim — toplam ${totalStr} net`,
    );

    if (weakTopicIds.length > 0) {
      setItems((prev) => [
        ...prev,
        { kind: 'practice-cta', id: uid(), topicIds: weakTopicIds },
      ]);
    }
  }, [denemeVals, weakTopics, ask]);

  const onToggleWeakTopic = useCallback((topicId: string) => {
    setWeakTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  }, []);

  /* ----------------------------- Yükleniyor ----------------------------- */
  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={AtlasColors.purple} size="large" />
      </View>
    );
  }

  /* --------------------------- Premium kapısı --------------------------- */
  if (!profile?.is_premium) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <View style={styles.lockCard}>
          <Image source={COACH_AVATAR} style={styles.lockMascot} contentFit="contain" />
          <Text style={styles.lockTitle}>Atlas Koçu Premium&apos;da 🔒</Text>
          <Text style={styles.lockText}>
            Yapay zekâ koçun; serini, netlerini ve zayıf derslerini görüp sana özel plan çıkarır,
            moral verir ve deneme sonuçlarını yorumlar.
          </Text>
          <Btn3D variant="purple" onPress={() => router.push('/premium')}>
            Premium&apos;a Geç
          </Btn3D>
        </View>
      </View>
    );
  }

  /* ------------------------------- Sohbet ------------------------------- */
  const goal = profile.daily_xp_goal ?? 200;
  const hasTarget = !!profile.target_university && !!profile.target_department;
  // Konuşma henüz başlamadı: yalnız yerel karşılama balonu var, gerçek mesaj yok.
  const isEmptyChat = items.length === 1 && items[0].id === 'greeting';

  const suggestions = [
    { emoji: '📋', text: 'Bana bu hafta için bir çalışma planı çıkarır mısın?', label: 'Bu hafta için plan çıkar' },
    { emoji: '😔', text: 'Moralim biraz bozuk, bana motivasyon verir misin?', label: 'Moral lazım' },
    ...(weakest
      ? [{ emoji: '⚔️', text: `${weakest.name} netlerimi nasıl yükseltirim?`, label: `${weakest.name} taktiği` }]
      : []),
  ];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* ChatGPT tarzı: arkaplan tam genişlik, içerik geniş ekranlarda ortalanmış
          tek bir sütunda — telefon genişliğinde zaten tam genişlik kaplar. */}
      <View style={styles.pageColumn}>
        {/* Header — kompakt, Koç Biliyor bağlam çipleri altta ince bir şerit */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View style={styles.headRow}>
            <View style={styles.headAva}>
              <Image source={COACH_AVATAR} style={styles.headAvaImg} contentFit="cover" />
            </View>
            <View style={styles.headText}>
              <Text style={styles.headName}>Atlas Koçu</Text>
              <Text style={styles.headOnline}>● Verilerini görerek konuşuyor</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Pill color="rgba(255,150,0,0.15)" textColor="#ffc36e">
              🔥 {profile.streak_count} gün seri
            </Pill>
            <Pill color="rgba(88,204,2,0.14)" textColor="#9fe86e">
              📊 {xpToday}/{goal} XP
            </Pill>
            {hasTarget && (
              <Pill color="rgba(28,176,246,0.14)" textColor="#7fd4ff">
                🎯 {profile.target_university} {profile.target_department}
              </Pill>
            )}
            {daysToExam !== null && (
              <Pill color="rgba(206,130,255,0.15)" textColor="#ddb0ff">
                📅 {daysToExam} gün kaldı
              </Pill>
            )}
            {weakest && (
              <Pill color="rgba(255,75,75,0.15)" textColor="#ff9c9c">
                ⚠️ {weakest.name} zayıf ({weakest.count} yanlış)
              </Pill>
            )}
            {weekly && (
              <Pill color="rgba(28,176,246,0.14)" textColor="#7fd4ff">
                📈 Bu hafta {weekly.xpThisWeek} XP • {weekly.quizzesThisWeek} quiz • {weekly.mistakesResolvedThisWeek}{' '}
                yanlış temizlendi
              </Pill>
            )}
          </ScrollView>
        </View>

        {loadError && (
          <Interactive style={styles.errorBanner} onPress={load}>
            <Text style={styles.errorBannerText}>⚠️ {loadError} (tekrar denemek için dokun)</Text>
          </Interactive>
        )}

        {isEmptyChat ? (
          /* Karşılama ekranı — ChatGPT'nin "bugün sana nasıl yardımcı olabilirim"
             boş durumu: ortalanmış maskot + başlık + öneri kartları. */
          <ScrollView contentContainerStyle={styles.heroScroll} keyboardShouldPersistTaps="handled">
            <Image source={COACH_AVATAR} style={styles.heroMascot} contentFit="contain" />
            <Text style={styles.heroTitle}>Selam, ben Atlas Koçun 👋</Text>
            <Text style={styles.heroSub}>Nasıl gidiyor? Sana nasıl yardımcı olabilirim?</Text>

            <View style={styles.heroCards}>
              {suggestions.map((s) => (
                <Interactive key={s.label} style={styles.heroCard} onPress={() => onQuick(s.text)}>
                  <Text style={styles.heroCardEmoji}>{s.emoji}</Text>
                  <Text style={styles.heroCardText}>{s.label}</Text>
                  <Text style={styles.heroCardChevron}>›</Text>
                </Interactive>
              ))}
              <Interactive style={styles.heroCard} onPress={() => setDenemeOpen(true)}>
                <Text style={styles.heroCardEmoji}>📝</Text>
                <Text style={styles.heroCardText}>Deneme sonucu gir</Text>
                <Text style={styles.heroCardChevron}>›</Text>
              </Interactive>
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.chat}
            contentContainerStyle={styles.chatContent}
            onContentSizeChange={scrollToEnd}
            keyboardShouldPersistTaps="handled">
            {items.map((item) => {
              if (item.kind === 'system') {
                return (
                  <View key={item.id} style={styles.systemWrap}>
                    <Text style={styles.systemText}>{item.content}</Text>
                  </View>
                );
              }
              if (item.kind === 'practice-cta') {
                return (
                  <View key={item.id} style={styles.practiceCtaWrap}>
                    <Text style={styles.practiceCtaText}>
                      🎯 Bu denemede zorlandığın {item.topicIds.length} konudan pratik quiz yapabilirsin.
                    </Text>
                    <Btn3D
                      variant="yellow"
                      size="small"
                      onPress={() =>
                        router.push({
                          pathname: '/deneme/quiz-hedef',
                          params: { topicIds: item.topicIds.join(',') },
                        } as never)
                      }>
                      Pratik Yap
                    </Btn3D>
                  </View>
                );
              }
              // ChatGPT kalıbı: asistan mesajı balonsuz (avatar + düz metin, geniş
              // sütun), kullanıcı mesajı sağa yaslı dolgulu balon.
              const isCoach = item.kind === 'typing' || item.role === 'coach';
              if (isCoach) {
                return (
                  <View key={item.id} style={styles.coachRow}>
                    <View style={styles.msgAva}>
                      <Image source={COACH_AVATAR} style={styles.msgAvaImg} contentFit="cover" />
                    </View>
                    <View style={styles.coachTextWrap}>
                      {item.kind === 'typing' ? (
                        <TypingDots />
                      ) : (
                        <MarkdownText
                          content={item.content}
                          textColor="rgba(255,255,255,0.92)"
                          mutedColor="rgba(255,255,255,0.5)"
                          headingColor={AtlasColors.white}
                        />
                      )}
                    </View>
                  </View>
                );
              }
              return (
                <View key={item.id} style={styles.userRow}>
                  <View style={styles.userBubble}>
                    <Text style={styles.userBubbleText}>{item.content}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Deneme sonucu gir — "+" ile açılan panel, sohbetin üstüne yerleşir */}
        {denemeOpen && (
          <View style={styles.denemeBox}>
            <View style={styles.denemeHead}>
              <Text style={styles.denemeHeadText}>📝 Deneme Sonucu Gir</Text>
              <Interactive onPress={() => setDenemeOpen(false)} hitSlop={8}>
                <Text style={styles.denemeClose}>✕</Text>
              </Interactive>
            </View>
            <ScrollView style={styles.denemeBodyScroll} contentContainerStyle={styles.denemeBody} keyboardShouldPersistTaps="handled">
              <View style={styles.denemeGrid}>
                {DENEME_FIELDS.map((f) => (
                  <View key={f.key} style={styles.denemeField}>
                    <Text style={styles.denemeLabel}>{f.label} (net)</Text>
                    <TextInput
                      style={styles.denemeInput}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={denemeVals[f.key]}
                      onChangeText={(t) => setDenemeVals((prev) => ({ ...prev, [f.key]: t }))}
                    />
                  </View>
                ))}
              </View>

              <Text style={styles.weakTopicsLabel}>Zayıf Olduğun Konular (opsiyonel)</Text>
              <WeakTopicsPicker selected={weakTopics} onToggle={onToggleWeakTopic} />

              {denemeWarn && <Text style={styles.denemeWarn}>Önce netlerini gir 📝</Text>}
              <Btn3D variant="yellow" size="small" onPress={onSaveDeneme} disabled={sending}>
                Kaydet &amp; Koça Gönder
              </Btn3D>
            </ScrollView>
          </View>
        )}

        {/* Öneri çipleri — yalnız konuşma başladıktan sonra, giriş kutusunun hemen üstünde */}
        {!isEmptyChat && !denemeOpen && suggestions.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.suggScroll}
            contentContainerStyle={styles.suggRow}
            keyboardShouldPersistTaps="handled">
            {suggestions.map((s) => (
              <Interactive key={s.label} style={styles.sugg} disabled={sending} onPress={() => onQuick(s.text)}>
                <Text style={styles.suggText}>
                  {s.emoji} {s.label}
                </Text>
              </Interactive>
            ))}
          </ScrollView>
        )}

        {/* Mesaj girişi (sabit alt) — ChatGPT tarzı: "+" (deneme paneli) solda,
            ortada büyüyebilen tek satır input, sağda gönder butonu. */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
          <Interactive
            style={[styles.plusBtn, denemeOpen && styles.plusBtnActive]}
            onPress={() => setDenemeOpen((o) => !o)}
            hitSlop={8}>
            <Text style={styles.plusIcon}>{denemeOpen ? '✕' : '+'}</Text>
          </Interactive>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, { height: inputH }]}
              value={input}
              onChangeText={setInput}
              placeholder="Koçuna bir şey sor..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              multiline
              blurOnSubmit={false}
              onKeyPress={onInputKeyPress}
              onContentSizeChange={onInputContentSizeChange}
              editable={!sending}
            />
          </View>
          <Interactive
            style={[styles.sendBtn, (sending || !input.trim()) && styles.sendBtnDisabled]}
            onPress={onSend}
            disabled={sending || !input.trim()}>
            <Text style={styles.sendIcon}>➤</Text>
          </Interactive>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AtlasColors.coachBg },
  // Tam genişlik — dar (telefon) ve geniş (masaüstü web) ekranlarda aynı,
  // artık ortalanmış dar bir sütuna sıkıştırılmıyor (kullanıcı isteği).
  // minHeight: 0 KRİTİK: bu olmadan RN Web'de flex:1 alt-öğe (chat ScrollView)
  // kardeşleri arasında küçülüp kendi içinde kaymak yerine tüm sayfayı büyütüyor
  // — önceki mesajlar görünüm dışına itiliyordu, bug buradan geliyordu.
  pageColumn: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },

  /* Premium gate */
  lockCard: { alignItems: 'center', gap: 12, maxWidth: 360 },
  lockMascot: { width: 130, height: 130 },
  lockTitle: { color: AtlasColors.white, fontSize: 22, fontFamily: AtlasFonts.heading, textAlign: 'center' },
  lockText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: AtlasFonts.bodySemi,
    marginBottom: 6,
  },

  /* Header */
  header: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
  headAva: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AtlasColors.violet,
    overflow: 'hidden',
  },
  headAvaImg: { width: '100%', height: '100%' },
  headText: { flex: 1 },
  headName: { color: AtlasColors.white, fontSize: 15, fontFamily: AtlasFonts.heading },
  headOnline: { color: '#6ee26e', fontSize: 10.5, fontFamily: AtlasFonts.bodySemi, marginTop: 1 },
  chipRow: { flexDirection: 'row', gap: 7, paddingRight: 8 },

  errorBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: 'rgba(255,75,75,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,75,75,0.35)',
    borderRadius: AtlasRadius.button,
    padding: 10,
  },
  errorBannerText: { color: '#ff9c9c', fontSize: 12, fontFamily: AtlasFonts.bodySemi, textAlign: 'center' },

  /* Karşılama (boş sohbet) ekranı */
  heroScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  heroMascot: { width: 96, height: 96, marginBottom: 4 },
  heroTitle: { color: AtlasColors.white, fontFamily: AtlasFonts.heading, fontSize: 21, textAlign: 'center' },
  heroSub: { color: 'rgba(255,255,255,0.6)', fontFamily: AtlasFonts.bodySemi, fontSize: 13, textAlign: 'center', marginBottom: 14 },
  heroCards: { width: '100%', maxWidth: 420, gap: 8 },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: AtlasRadius.button,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  heroCardEmoji: { fontSize: 17 },
  heroCardText: { flex: 1, color: AtlasColors.white, fontFamily: AtlasFonts.bodySemi, fontSize: 13.5 },
  heroCardChevron: { color: 'rgba(255,255,255,0.35)', fontFamily: AtlasFonts.heading, fontSize: 16 },

  /* Chat */
  chat: { flex: 1, minHeight: 0 },
  chatContent: { padding: 16, gap: 18, flexGrow: 1 },

  // Asistan: balonsuz, avatar + geniş düz metin (ChatGPT paragraf kalıbı)
  coachRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  coachTextWrap: { flex: 1, paddingTop: 4 },
  msgAva: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: AtlasColors.violet,
    overflow: 'hidden',
  },
  msgAvaImg: { width: '100%', height: '100%' },

  // Kullanıcı: sağa yaslı dolgulu balon
  userRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  userBubble: {
    maxWidth: '80%',
    backgroundColor: AtlasColors.violet,
    borderRadius: AtlasRadius.bubble,
    borderBottomRightRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  userBubbleText: { color: AtlasColors.white, fontSize: 14, lineHeight: 20, fontFamily: AtlasFonts.body },

  systemWrap: { alignItems: 'center', paddingVertical: 2 },
  systemText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontFamily: AtlasFonts.bodySemi,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: AtlasRadius.pill,
  },

  /* Deneme paneli ("+" ile açılır) */
  denemeBox: {
    marginHorizontal: 16,
    marginBottom: 10,
    maxHeight: 340,
    backgroundColor: '#1B1530',
    borderWidth: 1.5,
    borderColor: 'rgba(255,200,0,0.3)',
    borderRadius: AtlasRadius.bubble,
    overflow: 'hidden',
  },
  denemeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  denemeHeadText: { color: '#ffd95e', fontSize: 13.5, fontFamily: AtlasFonts.headingBold },
  denemeClose: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontFamily: AtlasFonts.heading },
  denemeBodyScroll: { maxHeight: 290 },
  denemeBody: { paddingHorizontal: 15, paddingVertical: 15, gap: 10 },
  denemeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  denemeField: { flexBasis: '47%', flexGrow: 1 },
  denemeLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontFamily: AtlasFonts.bodyBold,
    marginBottom: 4,
  },
  denemeInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 11,
    color: AtlasColors.white,
    fontSize: 14,
    fontFamily: AtlasFonts.bodyBold,
  },
  denemeWarn: { color: '#ffc36e', fontSize: 12, fontFamily: AtlasFonts.bodyBold },
  weakTopicsLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontFamily: AtlasFonts.bodyBold,
    marginTop: 2,
  },

  /* Pratik quiz CTA (deneme sonrası) */
  practiceCtaWrap: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,200,0,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,200,0,0.3)',
    borderRadius: AtlasRadius.bubble,
    padding: 14,
  },
  practiceCtaText: { color: '#ffd95e', fontSize: 12.5, fontFamily: AtlasFonts.bodySemi, textAlign: 'center' },

  /* Suggestions */
  suggScroll: { flexGrow: 0, flexShrink: 0 },
  suggRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  sugg: {
    backgroundColor: 'rgba(76,59,206,0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(124,108,255,0.45)',
    borderRadius: AtlasRadius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  suggText: { color: '#c9c2ff', fontSize: 12, fontFamily: AtlasFonts.bodyBold },

  /* Input */
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  plusBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBtnActive: { backgroundColor: 'rgba(255,200,0,0.18)', borderColor: 'rgba(255,200,0,0.4)' },
  plusIcon: { color: AtlasColors.white, fontSize: 18, fontFamily: AtlasFonts.heading, marginTop: -1 },
  inputWrap: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.13)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 11,
    justifyContent: 'center',
  },
  input: {
    color: AtlasColors.white,
    fontSize: 13.5,
    fontFamily: AtlasFonts.body,
    paddingTop: 0,
    paddingBottom: 0,
    maxHeight: MAX_INPUT_H,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AtlasColors.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { color: AtlasColors.white, fontSize: 16 },
});
