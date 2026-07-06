import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';

import { AtlasColors, AtlasFonts, AtlasLayout, AtlasSpacing, ledgeShadowWeb } from '@/constants/atlas-theme';

/** Sabit alt çubuğun yaklaşık yüksekliği — TabSlot'a paddingBottom olarak eklenir */
const TAB_BAR_HEIGHT = 84;

/** Atlas alt sekmeleri (web) — Ev, Harita, Koç, Yanlışlar, Puan */
export default function AppTabs() {
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
            <TabButton>⚠️ Yanlışlar</TabButton>
          </TabTrigger>
          <TabTrigger name="puan" href="/puan" asChild>
            <TabButton>🧮 Puan</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View style={styles.tabButtonView}>
        {isFocused && <View style={styles.activeNub} />}
        <ThemedText
          type="small"
          style={[styles.tabLabel, isFocused ? styles.tabLabelActive : styles.tabLabelInactive]}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <View style={styles.innerContainer}>
        <ThemedText style={styles.brandText}>⚔️ Atlas</ThemedText>
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: AtlasSpacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    backgroundColor: AtlasColors.white,
    paddingVertical: AtlasSpacing.two,
    paddingHorizontal: AtlasSpacing.five,
    borderRadius: AtlasSpacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: AtlasSpacing.two,
    maxWidth: AtlasLayout.maxContentWidth,
    ...ledgeShadowWeb(AtlasColors.line, 3),
  },
  brandText: {
    marginRight: 'auto',
    fontFamily: AtlasFonts.heading,
    fontSize: 14,
    color: AtlasColors.inkStrong,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    position: 'relative',
    paddingVertical: AtlasSpacing.one,
    paddingHorizontal: AtlasSpacing.three,
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
