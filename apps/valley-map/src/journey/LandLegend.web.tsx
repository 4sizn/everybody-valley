import { LAND_OWNERSHIP_COLORS } from '@modu-valley/map-style';
import { Button } from '@moduvalley/ui';

export type LandStatus = 'loading' | 'ready' | 'partial' | 'empty' | 'error';

const OWNERSHIP_LABELS = [
  ['individual', '개인'],
  ['organization', '법인'],
  ['public', '국공유지'],
  ['unknown', '미확인'],
] as const;

export function LandLegend({ status, onRetry }: { status: LandStatus; onRetry: () => void }) {
  const loaded = status === 'ready' || status === 'partial';
  return (
    <section className="ev-land-legend" aria-label="토지 소유구분">
      <p className={status === 'ready' ? 'mv-sr' : 'ev-land-status'} role="status">
        {status === 'loading'
          ? '토지 정보 불러오는 중…'
          : status === 'error'
            ? '토지 정보를 못 불러왔어요'
            : status === 'empty'
              ? '조회된 경계 없음 · 사유지가 없다는 뜻은 아니에요'
              : status === 'partial'
                ? '일부 지역만 표시 중'
                : '토지 경계 표시됨'}
      </p>
      {loaded && (
        <>
          <ul>
            {OWNERSHIP_LABELS.map(([ownership, label]) => (
              <li key={ownership}>
                <span
                  className="ev-land-swatch"
                  aria-hidden="true"
                  style={{
                    backgroundColor: LAND_OWNERSHIP_COLORS[ownership].fill,
                    borderColor: LAND_OWNERSHIP_COLORS[ownership].stroke,
                  }}
                />
                {label}
              </li>
            ))}
          </ul>
          <p className="ev-land-note">소유구분은 출입 허가와 달라요</p>
        </>
      )}
      {status === 'error' && (
        <Button variant="ghost" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </section>
  );
}
