import type { SubjectSummary } from './types';

export type CastleState = 'locked' | 'active' | 'done';

export type CastleViewModel = {
  subject: SubjectSummary;
  frac: number;
  state: CastleState;
};

/** Harita kale görünüm modelleri — kilit/aktif/fethedildi + ilerleme oranı. */
export function computeCastleViewModels(subjects: SubjectSummary[], isPremium: boolean): CastleViewModel[] {
  return subjects.map((subject) => {
    const frac = subject.totalTopics > 0 ? subject.doneTopics / subject.totalTopics : 0;
    const playable = subject.is_free || isPremium;
    const state: CastleState = !playable ? 'locked' : frac >= 1 && subject.totalTopics > 0 ? 'done' : 'active';
    return { subject, frac, state };
  });
}

/** Ana Kale'nin genel ilerlemesi — TYT derslerinin ortalama fethedilme oranı. */
export function computeOverallFraction(castles: CastleViewModel[]): number {
  if (castles.length === 0) return 0;
  const sum = castles.reduce((acc, c) => acc + c.frac, 0);
  return sum / castles.length;
}
