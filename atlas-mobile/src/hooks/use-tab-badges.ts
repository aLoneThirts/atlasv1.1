import { useEffect, useState } from 'react';

import { fetchOpenMistakeCount } from '@/lib/queries';

/**
 * Alt sekme çubuğu için — Yanlışlar sekmesindeki kırmızı nokta/rozet sayısı.
 * `(tabs)/_layout.tsx` her zaman monte olduğundan (odak/focus döngüsü yaşamaz),
 * basit bir aralıklı yenileme kullanılır; yeni backend gerekmez.
 */
export function useTabBadges() {
  const [mistakeCount, setMistakeCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      fetchOpenMistakeCount()
        .then(setMistakeCount)
        .catch(() => {});
    };
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, []);

  return { mistakeCount };
}
