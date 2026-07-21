import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AtlasFonts } from '@/constants/atlas-theme';

/**
 * Hafif, bağımsız bir Markdown render'ı — Koç sohbetindeki DeepSeek cevapları
 * genellikle **kalın** metin ve GFM tablo (haftalık plan gibi) içeriyor;
 * bunlar önceden düz metin olarak (yıldızlar/pipe'lar dahil) gösteriliyordu,
 * gerçek bir AI chat arayüzü gibi görünmesini engelliyordu. Proje genelinde
 * "yeni bağımlılık ekleme, elle çiz" geleneği izlendi (bkz. net-trend-chart.tsx) —
 * React 19 / RN 0.86 gibi çok yeni bir yığında üçüncü parti markdown
 * paketlerinin uyumluluğu belirsiz olduğundan burada da aynı yol seçildi.
 * Desteklenenler: başlık (#/##/###), **kalın**, madde/numaralı liste, GFM
 * tablo. Desteklenmeyenler (italik, kod bloğu, link) — koç cevaplarında
 * pratikte hiç görülmedi, eklenmedi.
 */

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'table'; header: string[]; rows: string[][] };

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-');
}

function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2].trim() });
      i++;
      continue;
    }

    if (line.trim().startsWith('|') && lines[i + 1] && isTableSeparator(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ kind: 'table', header, rows });
      continue;
    }

    if (/^[-*]\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    if (/^\d+\.\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{1,4}\s+/.test(lines[i]) &&
      !(lines[i].trim().startsWith('|') && lines[i + 1] && isTableSeparator(lines[i + 1])) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ kind: 'p', text: paraLines.join(' ') });
  }

  return blocks;
}

/** `**kalın**` parçalarını ayrı <Text> span'lerine böler. */
function Inline({ text, boldColor }: { text: string; boldColor: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p.length > 0);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\*\*([^*]+)\*\*$/.exec(part);
        if (m) {
          return (
            <Text key={i} style={[styles.bold, { color: boldColor }]}>
              {m[1]}
            </Text>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

export function MarkdownText({
  content,
  textColor,
  mutedColor,
  headingColor,
  fontSize = 14.5,
  lineHeight = 21.5,
}: {
  content: string;
  textColor: string;
  mutedColor: string;
  headingColor: string;
  fontSize?: number;
  lineHeight?: number;
}) {
  const blocks = parseMarkdown(content);

  return (
    <View style={styles.wrap}>
      {blocks.map((b, i) => {
        if (b.kind === 'heading') {
          return (
            <Text
              key={i}
              style={[
                styles.heading,
                { color: headingColor, fontSize: fontSize + (4 - Math.min(b.level, 3)) * 1.5 },
              ]}>
              {b.text}
            </Text>
          );
        }
        if (b.kind === 'p') {
          return (
            <Text key={i} style={{ color: textColor, fontSize, lineHeight, fontFamily: AtlasFonts.body }}>
              <Inline text={b.text} boldColor={headingColor} />
            </Text>
          );
        }
        if (b.kind === 'ul' || b.kind === 'ol') {
          return (
            <View key={i} style={styles.list}>
              {b.items.map((item, ii) => (
                <View key={ii} style={styles.listRow}>
                  <Text style={{ color: mutedColor, fontSize, lineHeight }}>
                    {b.kind === 'ol' ? `${ii + 1}.` : '•'}
                  </Text>
                  <Text style={{ color: textColor, fontSize, lineHeight, flex: 1, fontFamily: AtlasFonts.body }}>
                    <Inline text={item} boldColor={headingColor} />
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        // table
        return (
          <ScrollView key={i} horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                {b.header.map((cell, ci) => (
                  <View key={ci} style={styles.tableCellWrap}>
                    <Text style={[styles.tableHeaderText, { color: headingColor }]}>
                      <Inline text={cell} boldColor={headingColor} />
                    </Text>
                  </View>
                ))}
              </View>
              {b.rows.map((row, ri) => (
                <View key={ri} style={[styles.tableRow, ri % 2 === 1 && styles.tableRowAlt]}>
                  {row.map((cell, ci) => (
                    <View key={ci} style={styles.tableCellWrap}>
                      <Text style={[styles.tableCellText, { color: textColor }]}>
                        <Inline text={cell} boldColor={headingColor} />
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  heading: { fontFamily: AtlasFonts.heading },
  bold: { fontFamily: AtlasFonts.bodyBold },
  list: { gap: 4 },
  listRow: { flexDirection: 'row', gap: 8 },
  tableScroll: { marginVertical: 2 },
  table: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)' },
  tableRow: { flexDirection: 'row' },
  tableRowAlt: { backgroundColor: 'rgba(255,255,255,0.04)' },
  tableCellWrap: {
    minWidth: 96,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tableHeaderText: { fontSize: 12, fontFamily: AtlasFonts.bodyBold },
  tableCellText: { fontSize: 12.5, fontFamily: AtlasFonts.body },
});
