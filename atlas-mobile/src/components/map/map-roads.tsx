import { Fragment } from 'react';
import Svg, { Line } from 'react-native-svg';

import { MAP_REF_HEIGHT, MAP_REF_WIDTH, castleXY, roadStart } from './map-layout';
import type { CastleViewModel } from '@/lib/map-progress';

/**
 * Ana kaleden her derse giden altın kesik-çizgili yollar.
 * SVG viewBox referans (393x852) koordinat uzayında kalır, width/height gerçek
 * piksele ölçeklenir — vektör olduğu için pikselleşme/hizalama sorunu olmaz.
 */
export function MapRoads({ castles, scale }: { castles: CastleViewModel[]; scale: number }) {
  const total = castles.length;
  return (
    <Svg
      width={MAP_REF_WIDTH * scale}
      height={MAP_REF_HEIGHT * scale}
      viewBox={`0 0 ${MAP_REF_WIDTH} ${MAP_REF_HEIGHT}`}
      style={{ position: 'absolute', left: 0, top: 0 }}>
      {castles.map((c, i) => {
        const { x: x1, y: y1 } = roadStart(i, total);
        const { x: x2, y: y2 } = castleXY(i, total);
        const bright = c.state === 'done';
        return (
          <Fragment key={c.subject.id}>
            <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(0,0,0,0.3)" strokeWidth={12} strokeLinecap="round" />
            <Line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#D4A853"
              strokeWidth={8}
              strokeDasharray="18 10"
              strokeLinecap="round"
              opacity={bright ? 1 : 0.5}
            />
          </Fragment>
        );
      })}
    </Svg>
  );
}
