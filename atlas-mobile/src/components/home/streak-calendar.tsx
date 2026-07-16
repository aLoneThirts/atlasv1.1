import { StyleSheet, Text, View } from 'react-native';

import { AtlasColors, AtlasFonts, type Surface } from '@/constants/atlas-theme';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Europe/Istanbul (UTC+3, sabit) — bugünden `offsetDays` gün önceki tarih, YYYY-MM-DD */
function istanbulDateStr(offsetDays: number): string {
  const tr = new Date(Date.now() + 3 * HOUR - offsetDays * DAY);
  return tr.toISOString().slice(0, 10);
}

/**
 * Ev ekranı seri takvimi — son 5 hafta (35 gün), dolu kare = o gün en az 1
 * xp_events satırı var (bkz. queries.ts fetchStudyDays). Yeni tablo gerekmez.
 */
export function StreakCalendar({ studyDays, surface }: { studyDays: string[]; surface: Surface }) {
  const studySet = new Set(studyDays);
  const days = Array.from({ length: 35 }, (_, i) => istanbulDateStr(34 - i)); // eskiden yeniye, bugün sonda
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <View style={styles.wrap}>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.row}>
          {week.map((day) => (
            <View
              key={day}
              style={[
                styles.cell,
                { borderColor: surface.cardBorder },
                studySet.has(day) ? styles.cellActive : { backgroundColor: surface.card },
              ]}
            />
          ))}
        </View>
      ))}
      <Text style={[styles.legend, { color: surface.textSecondary }]}>
        Son 5 hafta — dolu kareler çalıştığın günler
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: 'row', gap: 4 },
  cell: { flex: 1, aspectRatio: 1, borderRadius: 4, borderWidth: 1.5 },
  cellActive: { backgroundColor: AtlasColors.green, borderColor: AtlasColors.greenDark },
  legend: { fontSize: 10.5, fontFamily: AtlasFonts.bodySemi, marginTop: 4, textAlign: 'center' },
});
