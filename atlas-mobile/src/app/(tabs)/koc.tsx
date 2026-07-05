import { Image } from 'expo-image';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Btn3D } from '@/components/ui/btn-3d';
import { Pill } from '@/components/ui/pill';
import { TypingDots } from '@/components/ui/animated/typing-dots';
import { AtlasColors, AtlasFonts, AtlasRadius } from '@/constants/atlas-theme';
import {
  fetchCoachHistory,
  fetchOpenMistakes,
  fetchProfile,
  fetchXpToday,
  saveMockExam,
  sendCoachMessage,
} from '@/lib/queries';
import type { MockExamNets, Profile } from '@/lib/types';

const COACH_AVATAR = require('@/assets/images/atlas/mascot-wave.png');

const GREETING = 'Selam! Ben Atlas Koçun 👋 Nasıl gidiyor, sana nasıl yardımcı olabilirim?';

/** Deneme (mock exam) giriş alanları — jenerik TYT netleri, prototip 5'li düzeni. */
const DENEME_FIELDS = [
  { key: 'turkce', label: 'Türkçe', subject: 'Türkçe' },
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
  | { kind: 'system'; id: string; content: string };

let counter = 0;
function uid(): string {
  counter += 1;
  return `local-${Date.now()}-${counter}`;
}

/**
 * EKRAN 11 — Koç (AI sohbet)
 * Canlı coach-chat Edge Function'ına bağlı gerçek sohbet ekranı.
 * Prototip (../index.html #scr-coach) yalnız görsel referans; canlı cevaplar
 * sendCoachMessage() üzerinden DeepSeek'ten gelir.
 */
export default function CoachScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [xpToday, setXpToday] = useState(0);
  const [weakest, setWeakest] = useState<{ name: string; count: number } | null>(null);
  const [daysToExam, setDaysToExam] = useState<number | null>(null);

  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const [denemeOpen, setDenemeOpen] = useState(false);
  const [denemeVals, setDenemeVals] = useState<Record<DenemeKey, string>>({
    turkce: '',
    tarih: '',
    cografya: '',
    felsefe: '',
    fen: '',
  });
  const [denemeWarn, setDenemeWarn] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const p = await fetchProfile();
      setProfile(p);

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
      const [history, xp, mistakes] = await Promise.all([
        fetchCoachHistory(),
        fetchXpToday(),
        fetchOpenMistakes(),
      ]);
      setXpToday(xp);

      // En zayıf ders: son 30 gün açık yanlışları subjectName'e göre say
      if (mistakes.length > 0) {
        const counts = new Map<string, number>();
        for (const m of mistakes) counts.set(m.subjectName, (counts.get(m.subjectName) ?? 0) + 1);
        let best: { name: string; count: number } | null = null;
        for (const [name, count] of counts) {
          if (!best || count > best.count) best = { name, count };
        }
        setWeakest(best);
      } else {
        setWeakest(null);
      }

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
    } catch {
      // Profil çekilemezse gate zaten null profile ile premium-değil gibi davranır;
      // burada sessizce loading'i kapatıp upsell/boş durum gösteririz.
    } finally {
      setLoading(false);
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
    ask(text);
  }, [input, sending, ask]);

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

    setDenemeWarn(false);
    setDenemeOpen(false);
    setDenemeVals({ turkce: '', tarih: '', cografya: '', felsefe: '', fen: '' });

    try {
      await saveMockExam(nets);
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
  }, [denemeVals, ask]);

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header + Koç Biliyor çipleri (sabit) */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headRow}>
          <View style={styles.headAva}>
            <Image source={COACH_AVATAR} style={styles.headAvaImg} contentFit="cover" />
          </View>
          <View style={styles.headText}>
            <Text style={styles.headName}>Atlas Koçu</Text>
            <Text style={styles.headOnline}>● Çevrimiçi • Verilerini görüyor</Text>
          </View>
        </View>

        <Text style={styles.knowLabel}>KOÇ BİLİYOR 👁️</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
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
        </ScrollView>
      </View>

      {/* Sohbet balonları */}
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
          const isCoach = item.kind === 'typing' || item.role === 'coach';
          return (
            <View
              key={item.id}
              style={[styles.msgRow, isCoach ? styles.msgRowCoach : styles.msgRowUser]}>
              {isCoach && (
                <View style={styles.msgAva}>
                  <Image source={COACH_AVATAR} style={styles.msgAvaImg} contentFit="cover" />
                </View>
              )}
              {item.kind === 'typing' ? (
                <View style={[styles.bubble, styles.bubbleCoach, styles.typingBubble]}>
                  <TypingDots />
                </View>
              ) : (
                <View style={[styles.bubble, isCoach ? styles.bubbleCoach : styles.bubbleUser]}>
                  <Text style={styles.bubbleText}>{item.content}</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Deneme sonucu gir (katlanır) */}
      <View style={styles.denemeBox}>
        <Pressable style={styles.denemeHead} onPress={() => setDenemeOpen((o) => !o)}>
          <Text style={styles.denemeHeadText}>📝 Deneme Sonucu Gir</Text>
          <Text style={styles.denemeCaret}>{denemeOpen ? '▲' : '▼'}</Text>
        </Pressable>
        {denemeOpen && (
          <View style={styles.denemeBody}>
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
                    onChangeText={(t) =>
                      setDenemeVals((prev) => ({ ...prev, [f.key]: t }))
                    }
                  />
                </View>
              ))}
            </View>
            {denemeWarn && <Text style={styles.denemeWarn}>Önce netlerini gir 📝</Text>}
            <Btn3D variant="yellow" size="small" onPress={onSaveDeneme} disabled={sending}>
              Kaydet &amp; Koça Gönder
            </Btn3D>
          </View>
        )}
      </View>

      {/* Hızlı öneri çipleri */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.suggScroll}
        contentContainerStyle={styles.suggRow}
        keyboardShouldPersistTaps="handled">
        <Pressable
          style={styles.sugg}
          disabled={sending}
          onPress={() => onQuick('Bana bu hafta için bir çalışma planı çıkarır mısın?')}>
          <Text style={styles.suggText}>📋 Plan çıkar</Text>
        </Pressable>
        <Pressable
          style={styles.sugg}
          disabled={sending}
          onPress={() => onQuick('Moralim biraz bozuk, bana motivasyon verir misin?')}>
          <Text style={styles.suggText}>😔 Moral lazım</Text>
        </Pressable>
        {weakest && (
          <Pressable
            style={styles.sugg}
            disabled={sending}
            onPress={() => onQuick(`${weakest.name} netlerimi nasıl yükseltirim?`)}>
            <Text style={styles.suggText}>⚔️ {weakest.name} taktiği</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Mesaj girişi (sabit alt) */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Koçuna bir şey sor..."
          placeholderTextColor="rgba(255,255,255,0.35)"
          onSubmitEditing={onSend}
          returnKeyType="send"
          editable={!sending}
        />
        <Pressable
          style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={sending}>
          <Text style={styles.sendIcon}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AtlasColors.coachBg },
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 },
  headAva: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: AtlasColors.violet,
    overflow: 'hidden',
  },
  headAvaImg: { width: '100%', height: '100%' },
  headText: { flex: 1 },
  headName: { color: AtlasColors.white, fontSize: 16, fontFamily: AtlasFonts.heading },
  headOnline: { color: '#6ee26e', fontSize: 11, fontFamily: AtlasFonts.bodySemi, marginTop: 1 },
  knowLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9.5,
    letterSpacing: 1.2,
    fontFamily: AtlasFonts.heading,
    marginBottom: 7,
  },
  chipRow: { flexDirection: 'row', gap: 7, paddingRight: 8 },

  /* Chat */
  chat: { flex: 1 },
  chatContent: { padding: 16, gap: 13 },
  msgRow: { flexDirection: 'row', gap: 8, maxWidth: '100%' },
  msgRowCoach: { justifyContent: 'flex-start' },
  msgRowUser: { justifyContent: 'flex-end' },
  msgAva: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AtlasColors.violet,
    overflow: 'hidden',
    alignSelf: 'flex-end',
  },
  msgAvaImg: { width: '100%', height: '100%' },
  bubble: { maxWidth: '78%', paddingVertical: 11, paddingHorizontal: 14 },
  bubbleCoach: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderTopLeftRadius: AtlasRadius.bubble,
    borderTopRightRadius: AtlasRadius.bubble,
    borderBottomRightRadius: AtlasRadius.bubble,
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: AtlasColors.violet,
    borderTopLeftRadius: AtlasRadius.bubble,
    borderTopRightRadius: AtlasRadius.bubble,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: AtlasRadius.bubble,
  },
  bubbleText: { color: AtlasColors.white, fontSize: 13.5, lineHeight: 20, fontFamily: AtlasFonts.body },
  typingBubble: { paddingVertical: 8, paddingHorizontal: 10 },
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

  /* Deneme */
  denemeBox: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(255,200,0,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,200,0,0.3)',
    borderRadius: AtlasRadius.bubble,
    overflow: 'hidden',
  },
  denemeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  denemeHeadText: { flex: 1, color: '#ffd95e', fontSize: 13.5, fontFamily: AtlasFonts.headingBold },
  denemeCaret: { color: '#ffd95e', fontSize: 11 },
  denemeBody: { paddingHorizontal: 15, paddingBottom: 15, gap: 10 },
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
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.13)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 15,
    color: AtlasColors.white,
    fontSize: 13.5,
    fontFamily: AtlasFonts.body,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: AtlasColors.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendIcon: { color: AtlasColors.white, fontSize: 18 },
});
