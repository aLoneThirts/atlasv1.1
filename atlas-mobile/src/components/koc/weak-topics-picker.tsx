import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AtlasFonts } from '@/constants/atlas-theme';
import { fetchSubjects, fetchSubjectTree } from '@/lib/queries';
import type { Subject, UnitNode } from '@/lib/types';

/**
 * Deneme sonrası "hangi konularda zorlandın?" seçici — ders → bölüm → konu
 * 3 seviyeli, varsayılan kapalı akordeon. Tarih tek başına 111 konu/54 bölüm
 * olduğu için düz liste kullanılamıyor (bkz. plan). Seçim `selected` Set'inde
 * (topic id) tutulur, `mock_exams.nets`'teki serbest metin ders adlarından
 * TAMAMEN bağımsızdır — gerçek subjects/units/topics ağacını kullanır.
 */
export function WeakTopicsPicker({
  selected,
  onToggle,
}: {
  selected: Set<string>;
  onToggle: (topicId: string) => void;
}) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
  const [subjectTrees, setSubjectTrees] = useState<Record<string, UnitNode[]>>({});
  const [loadingSubjectId, setLoadingSubjectId] = useState<string | null>(null);
  const [expandedUnitIds, setExpandedUnitIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSubjects()
      .then(setSubjects)
      .catch(() => {});
  }, []);

  const toggleSubject = async (subject: Subject) => {
    if (expandedSubjectId === subject.id) {
      setExpandedSubjectId(null);
      return;
    }
    setExpandedSubjectId(subject.id);
    if (!subjectTrees[subject.id]) {
      setLoadingSubjectId(subject.id);
      try {
        const tree = await fetchSubjectTree(subject.id);
        setSubjectTrees((prev) => ({ ...prev, [subject.id]: tree }));
      } catch {
        /* sessizce geç — bölüm listesi boş görünür */
      } finally {
        setLoadingSubjectId(null);
      }
    }
  };

  const toggleUnit = (unitId: string) => {
    setExpandedUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const selectedCountFor = (subjectId: string): number => {
    const tree = subjectTrees[subjectId];
    if (!tree) return 0;
    let count = 0;
    for (const unit of tree) for (const topic of unit.topics) if (selected.has(topic.id)) count++;
    return count;
  };

  return (
    <View style={styles.wrap}>
      {subjects.map((subject) => {
        const expanded = expandedSubjectId === subject.id;
        const count = selectedCountFor(subject.id);
        return (
          <View key={subject.id} style={styles.subjectBox}>
            <Pressable style={styles.subjectHead} onPress={() => toggleSubject(subject)}>
              <Text style={styles.subjectEmoji}>{subject.emoji}</Text>
              <Text style={styles.subjectName}>{subject.name}</Text>
              {count > 0 && <Text style={styles.subjectCount}>{count} seçili</Text>}
              <Text style={styles.caret}>{expanded ? '▲' : '▼'}</Text>
            </Pressable>

            {expanded && (
              <View style={styles.unitList}>
                {loadingSubjectId === subject.id && <Text style={styles.loadingText}>Yükleniyor…</Text>}
                {(subjectTrees[subject.id] ?? []).map((unit) => {
                  const unitExpanded = expandedUnitIds.has(unit.id);
                  return (
                    <View key={unit.id} style={styles.unitBox}>
                      <Pressable style={styles.unitHead} onPress={() => toggleUnit(unit.id)}>
                        <Text style={styles.unitTitle} numberOfLines={1}>
                          {unit.title}
                        </Text>
                        <Text style={styles.caretSmall}>{unitExpanded ? '▲' : '▼'}</Text>
                      </Pressable>
                      {unitExpanded &&
                        unit.topics.map((topic) => {
                          const checked = selected.has(topic.id);
                          return (
                            <Pressable
                              key={topic.id}
                              style={styles.topicRow}
                              onPress={() => onToggle(topic.id)}>
                              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                                {checked && <Text style={styles.checkMark}>✓</Text>}
                              </View>
                              <Text style={styles.topicTitle} numberOfLines={2}>
                                {topic.title}
                              </Text>
                            </Pressable>
                          );
                        })}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  subjectBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  subjectHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12 },
  subjectEmoji: { fontSize: 15 },
  subjectName: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: AtlasFonts.bodyBold },
  subjectCount: { color: '#ffd95e', fontSize: 10.5, fontFamily: AtlasFonts.bodyBold },
  caret: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
  caretSmall: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
  unitList: { paddingHorizontal: 10, paddingBottom: 8, gap: 5 },
  loadingText: { color: 'rgba(255,255,255,0.5)', fontSize: 11.5, fontFamily: AtlasFonts.bodySemi, padding: 6 },
  unitBox: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  unitHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 10 },
  unitTitle: { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 11.5, fontFamily: AtlasFonts.bodyBold },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#ffc800', borderColor: '#ffc800' },
  checkMark: { color: '#3a2c00', fontSize: 11, fontFamily: AtlasFonts.heading },
  topicTitle: { flex: 1, color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: AtlasFonts.body },
});
