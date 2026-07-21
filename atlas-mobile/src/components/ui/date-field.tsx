import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Interactive } from '@/components/ui/interactive';
import { AtlasColors, AtlasRadius } from '@/constants/atlas-theme';

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatTr(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Tarih seçici — koyu (onboarding/giriş) ve açık (ayarlar) yüzeyler için
 * `dark` prop'uyla ayarlanan tek bir input satırı. Android'de dokununca
 * sistem dialog'u açılıp seçince otomatik kapanır; iOS'ta satırın altında
 * inline takvim açılır, "Tamam" ile kapanır.
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
  const [open, setOpen] = useState(false);

  const onPick = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'dismissed') return;
    if (selected) onChange(toIso(selected));
  };

  return (
    <View>
      <Interactive
        onPress={() => setOpen(true)}
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
      </Interactive>

      {open && (
        <>
          <DateTimePicker
            value={value ? new Date(value) : new Date()}
            mode="date"
            minimumDate={minimumDate}
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={onPick}
          />
          {Platform.OS === 'ios' && (
            <Interactive onPress={() => setOpen(false)} style={styles.doneBtn}>
              <Text style={[styles.doneText, { color: dark ? AtlasColors.white : AtlasColors.blue }]}>Tamam</Text>
            </Interactive>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1.5,
    borderRadius: AtlasRadius.button,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  text: { fontSize: 15 },
  doneBtn: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
  doneText: { fontSize: 14, fontWeight: '800' },
});
