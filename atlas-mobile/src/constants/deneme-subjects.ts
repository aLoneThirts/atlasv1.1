import { AtlasColors, SubjectColors } from '@/constants/atlas-theme';

/**
 * Deneme net girişindeki 6 sabit alanın (koc.tsx DENEME_FIELDS) görsel kimliği.
 * Tarih/Coğrafya/Felsefe/Türkçe kale renkleriyle (SubjectColors) hizalı;
 * Matematik ve Fen'in kendi kalesi yok (Fen = Fizik+Kimya+Biyoloji birleşik neti)
 * bu yüzden ayrı sabit renk/emoji tanımlanıyor.
 */
export const DENEME_SUBJECT_META: Record<string, { color: string; emoji: string }> = {
  Türkçe: { color: SubjectColors.turkce.main, emoji: '📖' },
  Matematik: { color: AtlasColors.blue, emoji: '🔢' },
  Tarih: { color: SubjectColors.tarih.main, emoji: '⚔️' },
  Coğrafya: { color: SubjectColors.cografya.main, emoji: '🌍' },
  Felsefe: { color: SubjectColors.felsefe.main, emoji: '🧠' },
  Fen: { color: AtlasColors.orange, emoji: '🔬' },
};

export const DENEME_SUBJECT_ORDER = ['Türkçe', 'Matematik', 'Tarih', 'Coğrafya', 'Felsefe', 'Fen'] as const;

export function denemeSubjectMeta(subject: string): { color: string; emoji: string } {
  return DENEME_SUBJECT_META[subject] ?? { color: AtlasColors.gray, emoji: '📄' };
}
