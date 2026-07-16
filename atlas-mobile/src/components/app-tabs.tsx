import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { AtlasColors } from '@/constants/atlas-theme';
import { useTabBadges } from '@/hooks/use-tab-badges';

/** Atlas alt sekme çubuğu — Ev, Harita, Koç, Yanlışlar, Puan, Deneme */
export default function AppTabs() {
  const { mistakeCount } = useTabBadges();

  return (
    <NativeTabs
      backgroundColor={AtlasColors.white}
      indicatorColor={AtlasColors.greenLight}
      labelStyle={{ selected: { color: AtlasColors.greenDark } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>🏠 Ev</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="harita">
        <NativeTabs.Trigger.Label>🗺️ Harita</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="koc">
        <NativeTabs.Trigger.Label>🤖 Koç</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="yanlislar">
        <NativeTabs.Trigger.Label>⚠️ Yanlışlar</NativeTabs.Trigger.Label>
        {mistakeCount > 0 && <NativeTabs.Trigger.Badge>{String(mistakeCount)}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="puan">
        <NativeTabs.Trigger.Label>🧮 Puan</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="deneme">
        <NativeTabs.Trigger.Label>📈 Deneme</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
