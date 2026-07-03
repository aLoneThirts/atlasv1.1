import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AtlasColors, AtlasRadius } from '@/constants/atlas-theme';
import {
  fetchCoachHistory,
  fetchOpenMistakeCount,
  fetchProfile,
  fetchXpToday,
  sendCoachMessage,
} from '@/lib/queries';
import type { CoachMessage, Profile } from '@/lib/types';

/**
 * EKRAN 11 — Koç — prototip: index.html #scr-coach
 * Gemini'ye coach-chat Edge Function üzerinden gidilir (anahtar istemcide yok).
 * Koç premium özelliğidir (§4.9) — ücretsiz kullanıcı kilit ekranı görür.
 */
export default function CoachScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [xpToday, setXpToday] = useState(0);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const localId = useRef(-1);

  const load = useCallback(async () => {
    try {
      const p = await fetchProfile();
      setProfile(p);
      if (p.is_premium) {
        const [history, open, xp] = await Promise.all([
          fetchCoachHistory(),
          fetchOpenMistakeCount(),
          fetchXpToday(),
        ]);
        setMessages(history);
        setOpenCount(open);
        setXpToday(xp);
      }
    } catch {
      /* çevrimdışı: mevcut içerik ekranda kalır */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const append = (role: 'user' | 'coach', content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: localId.current--, role, content, created_at: new Date().toISOString() },
    ]);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const send = async () => {
    const text = input.trim();
    if (!text || typing) return;
    setInput('');
    append('user', text);
    setTyping(true);
    try {
      const reply = await sendCoachMessage(text);
      append('coach', reply);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      append(
        'coach',
        code === 'rate_limited'
          ? 'Bugünlük mesaj hakkın doldu (30/gün) — yarın devam edelim! 🌙'
          : code === 'premium_required'
            ? 'Koç premium ile açılır ⚔️'
            : 'Şu an bağlanamıyorum, birazdan tekrar dener misin? 🙏',
      );
    } finally {
      setTyping(false);
    }
  };

  if (profile && !profile.is_premium) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.lockBox}>
          <Image
            source={require('@/assets/images/atlas/mascot-wave.png')}
            style={styles.lockMascot}
            contentFit="contain"
          />
          <Text style={styles.lockTitle}>🔒 Atlas Koçu Premium&apos;da</Text>
          <Text style={styles.lockSub}>
            Kişisel çalışma planı, deneme analizi ve 7/24 soru desteği için{'\n'}premium&apos;a geç.
            Tarih Kalesi her zaman ücretsiz!
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}>
          <View style={styles.header}>
            <Text style={styles.hTitle}>🤖 Atlas Koçu</Text>
            <Text style={styles.hSub}>verilerini bilir, boş konuşmaz</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <InfoChip text={`🔥 ${profile?.streak_count ?? 0} gün seri`} />
            <InfoChip text={`⚠️ ${openCount} açık yanlış`} />
            <InfoChip text={`⭐ bugün ${xpToday} XP`} />
            {profile?.target_university && (
              <InfoChip text={`🎯 ${profile.target_university} ${profile.target_department ?? ''}`} />
            )}
          </ScrollView>

          <ScrollView
            ref={scrollRef}
            style={styles.chat}
            contentContainerStyle={styles.chatContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
            {messages.length === 0 && (
              <Text style={styles.emptyChat}>
                Selam! 👋 Plan mı lazım, moral mi, konu önerisi mi?{'\n'}Yaz, birlikte fethedelim. ⚔️
              </Text>
            )}
            {messages.map((m) => (
              <View key={m.id} style={[styles.msgRow, m.role === 'user' && styles.msgRowMe]}>
                {m.role === 'coach' && (
                  <Image
                    source={require('@/assets/images/atlas/mascot-wave.png')}
                    style={styles.avatar}
                    contentFit="contain"
                  />
                )}
                <View style={[styles.bubble, m.role === 'user' ? styles.bubbleMe : styles.bubbleCoach]}>
                  <Text style={[styles.msgText, m.role === 'user' && styles.msgTextMe]}>
                    {m.content}
                  </Text>
                </View>
              </View>
            ))}
            {typing && (
              <View style={styles.msgRow}>
                <Image
                  source={require('@/assets/images/atlas/mascot-wave.png')}
                  style={styles.avatar}
                  contentFit="contain"
                />
                <View style={[styles.bubble, styles.bubbleCoach]}>
                  <Text style={styles.msgText}>yazıyor...</Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Koça yaz..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={send}
              returnKeyType="send"
              editable={!typing}
            />
            <Pressable style={[styles.send, typing && styles.sendOff]} onPress={send}>
              <Text style={styles.sendText}>➤</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function InfoChip({ text }: { text: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AtlasColors.coachBg },
  safe: { flex: 1 },
  header: { paddingHorizontal: 18, paddingTop: 10 },
  hTitle: { color: AtlasColors.white, fontSize: 20, fontWeight: '900' },
  hSub: { color: 'rgba(255,255,255,0.55)', fontSize: 11.5, marginTop: 2 },
  chipRow: { flexGrow: 0, paddingLeft: 18, marginTop: 12 },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: AtlasRadius.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700' },
  chat: { flex: 1, marginTop: 10 },
  chatContent: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  emptyChat: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 40,
  },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '88%' },
  msgRowMe: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  avatar: { width: 28, height: 28 },
  bubble: {
    borderRadius: AtlasRadius.bubble,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexShrink: 1,
  },
  bubbleCoach: { backgroundColor: 'rgba(255,255,255,0.10)', borderBottomLeftRadius: 6 },
  bubbleMe: { backgroundColor: AtlasColors.green, borderBottomRightRadius: 6 },
  msgText: { color: AtlasColors.white, fontSize: 13.5, lineHeight: 19.5, fontWeight: '500' },
  msgTextMe: { fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: AtlasRadius.pill,
    paddingHorizontal: 15,
    paddingVertical: 11,
    color: AtlasColors.white,
    fontSize: 14,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: AtlasColors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.5 },
  sendText: { color: AtlasColors.white, fontSize: 16, fontWeight: '900' },
  lockBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 10 },
  lockMascot: { width: 130, height: 130 },
  lockTitle: { color: AtlasColors.white, fontSize: 20, fontWeight: '900' },
  lockSub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
});
