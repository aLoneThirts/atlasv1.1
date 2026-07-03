import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { AtlasColors } from '@/constants/atlas-theme';

/** Atlas alt sekme çubuğu — brief §6: Ev, Harita, Koç, Yanlışlar */
export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={AtlasColors.white}
      indicatorColor={AtlasColors.greenLight}
      labelStyle={{ selected: { color: AtlasColors.greenDark } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Ev</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="harita">
        <NativeTabs.Trigger.Label>Harita</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="koc">
        <NativeTabs.Trigger.Label>Koç</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="yanlislar">
        <NativeTabs.Trigger.Label>Yanlışlar</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
