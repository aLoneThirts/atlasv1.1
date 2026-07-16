import { Modal, StyleSheet, Text, View } from 'react-native';

import { Btn3D } from '@/components/ui/btn-3d';
import { Confetti } from '@/components/ui/animated/confetti';
import { MascotPop } from '@/components/ui/animated/mascot-pop';
import { AtlasColors, AtlasFonts, AtlasRadius } from '@/constants/atlas-theme';
import type { Badge } from '@/lib/types';

/** Yeni rozet kazanılınca Ev ekranında gösterilen kutlama popup'ı. */
export function BadgeUnlockPopup({ badge, onClose }: { badge: Badge | null; onClose: () => void }) {
  if (!badge) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Confetti fire />
        <MascotPop trigger={badge.id} style={styles.card}>
          <Text style={styles.emoji}>{badge.emoji}</Text>
          <Text style={styles.kicker}>Yeni Rozet!</Text>
          <Text style={styles.title}>{badge.title}</Text>
          <Text style={styles.desc}>{badge.description}</Text>
          <Btn3D variant="green" onPress={onClose}>
            Harika!
          </Btn3D>
        </MascotPop>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  card: {
    backgroundColor: AtlasColors.white,
    borderRadius: AtlasRadius.sheet,
    paddingVertical: 28,
    paddingHorizontal: 26,
    alignItems: 'center',
    gap: 6,
    width: '100%',
    maxWidth: 340,
  },
  emoji: { fontSize: 56, marginBottom: 4 },
  kicker: {
    color: AtlasColors.orange,
    fontFamily: AtlasFonts.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: { color: AtlasColors.inkStrong, fontFamily: AtlasFonts.heading, fontSize: 22, textAlign: 'center' },
  desc: {
    color: AtlasColors.ink,
    fontFamily: AtlasFonts.bodySemi,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
});
