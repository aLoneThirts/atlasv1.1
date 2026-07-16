import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, ScrollView, View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';

import { AtlasColors, AtlasFonts, AtlasLayout, AtlasSpacing, ledgeShadowWeb } from '@/constants/atlas-theme';
import { useTabBadges } from '@/hooks/use-tab-badges';

/** Sabit alt çubuğun yaklaşık yüksekliği — TabSlot'a paddingBottom olarak eklenir */
const TAB_BAR_HEIGHT = 84;

/** Atlas alt sekmeleri (web) — Ev, Harita, Koç, Yanlışlar, Puan, Deneme */
export default function AppTabs() {
  const { mistakeCount } = useTabBadges();

  return (
    <Tabs>
      {/* alttaki sabit sekme çubuğunun içeriğin üzerine binmemesi için pay bırak */}
      <TabSlot style={{ height: '100%', paddingBottom: TAB_BAR_HEIGHT }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>🏠 Ev</TabButton>
          </TabTrigger>
          <TabTrigger name="harita" href="/harita" asChild>
            <TabButton>🗺️ Harita</TabButton>
          </TabTrigger>
          <TabTrigger name="koc" href="/koc" asChild>
            <TabButton>🤖 Koç</TabButton>
          </TabTrigger>
          <TabTrigger name="yanlislar" href="/yanlislar" asChild>
            <TabButton badge={mistakeCount > 0}>⚠️ Yanlışlar</TabButton>
          </TabTrigger>
          <TabTrigger name="puan" href="/puan" asChild>
            <TabButton>🧮 Puan</TabButton>
          </TabTrigger>
          <TabTrigger name="deneme" href="/deneme" asChild>
            <TabButton>📈 Deneme</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({
  children,
  isFocused,
  badge,
  ...props
}: TabTriggerSlotProps & { badge?: boolean }) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View style={styles.tabButtonView}>
        {isFocused && <View style={styles.activeNub} />}
        {badge && <View style={styles.badgeDot} />}
        <ThemedText
          type="small"
          numberOfLines={1}
          style={[styles.tabLabel, isFocused ? styles.tabLabelActive : styles.tabLabelInactive]}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/**
 * Sekme sayısı arttıkça (6 sekme) dar telefonlarda hepsi aynı anda sığmayabilir —
 * önceden flexShrink ile "sıkıştırma" denendi ama bazı genişliklerde en sağdaki
 * sekme (Deneme) görünmez oluyordu. Bunun yerine satır yatay kaydırılabilir:
 * her sekme her zaman doğal boyutunda kalır, sığmadığında kaydırarak erişilir —
 * hiçbir sekme hiçbir ekran genişliğinde tamamen kaybolmaz.
 */
export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <View style={styles.innerContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.innerScrollContent}>
          {props.children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    maxWidth: '100%',
    padding: AtlasSpacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  innerContainer: {
    backgroundColor: AtlasColors.white,
    paddingVertical: AtlasSpacing.two,
    borderRadius: AtlasSpacing.five,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: AtlasLayout.maxContentWidth,
    overflow: 'hidden',
    ...ledgeShadowWeb(AtlasColors.line, 3),
  },
  innerScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    gap: AtlasSpacing.one,
    paddingHorizontal: AtlasSpacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    position: 'relative',
    paddingVertical: AtlasSpacing.one,
    paddingHorizontal: AtlasSpacing.two,
    borderRadius: AtlasSpacing.three,
    alignItems: 'center',
  },
  activeNub: {
    position: 'absolute',
    top: -AtlasSpacing.two,
    width: 40,
    height: 4,
    borderRadius: 4,
    backgroundColor: AtlasColors.greenDark,
  },
  badgeDot: {
    position: 'absolute',
    top: 2,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AtlasColors.red,
  },
  tabLabel: {
    fontFamily: AtlasFonts.bodySemi,
  },
  tabLabelActive: {
    color: AtlasColors.greenDark,
  },
  tabLabelInactive: {
    color: AtlasColors.gray,
    opacity: 0.8,
  },
});
