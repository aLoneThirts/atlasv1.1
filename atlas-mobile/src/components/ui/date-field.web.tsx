import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Interactive } from '@/components/ui/interactive';
import { AtlasColors, AtlasRadius } from '@/constants/atlas-theme';

function formatTr(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Web karşılığı — `@react-native-community/datetimepicker`'ın web desteği
 * yok (bkz. native `date-field.tsx`, `datetimepicker.js` fallback'i web'de
 * sessizce null render eder). Burada görünmez bir gerçek `<input type="date">`
 * DOM'da tutulur (değer/onChange için); tıklama görünür Pressable'a bağlı ve
 * `showPicker()` ile tarayıcının tarih seçicisini DOĞRUDAN açar — konumsal
 * bindirme (overlay) yerine bu yöntem, tıklamanın gerçek input'un üstüne denk
 * gelip gelmediğine bağlı kalmadığı için daha güvenilir.
 */
export function DateField({
  value,
  onChange,
  placeholder = 'Tarih seç',
  minimumDate,
  dark = false,
}: {
  value: string | null;
  onChange: (iso: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  dark?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    const withPicker = el as HTMLInputElement & { showPicker?: () => void };
    if (typeof withPicker.showPicker === 'function') {
      try {
        withPicker.showPicker();
        return;
      } catch {
        /* bazı taraycılarda kullanıcı etkileşimi dışında çağrılırsa reddedebilir — focus'a düş */
      }
    }
    el.focus();
  };

  return (
    <Interactive
      onPress={openPicker}
      style={[
        styles.input,
        dark
          ? { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.18)' }
          : { backgroundColor: AtlasColors.white, borderColor: AtlasColors.line },
      ]}>
      <Text
        style={[
          styles.text,
          { color: value ? (dark ? AtlasColors.white : AtlasColors.inkStrong) : dark ? 'rgba(255,255,255,0.45)' : AtlasColors.gray },
        ]}>
        {value ? formatTr(value) : placeholder}
      </Text>
      <View style={styles.hidden} pointerEvents="none">
        <input
          ref={inputRef}
          type="date"
          value={value ?? ''}
          min={minimumDate ? minimumDate.toISOString().slice(0, 10) : undefined}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.value) onChange(e.target.value);
          }}
        />
      </View>
    </Interactive>
  );
}

const styles = StyleSheet.create({
  input: {
    position: 'relative',
    borderWidth: 1.5,
    borderRadius: AtlasRadius.button,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  text: { fontSize: 15 },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1, overflow: 'hidden' },
});
