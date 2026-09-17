import { SHADE_HOURS } from '@modu-valley/core';

/**
 * 그늘 시각 트랙 — 정시 9개 눈금 + ‹ › (modu-valley `ShadeHourTrack` 과 같은 규칙).
 *
 * 연속 슬라이더가 아니다. 자료가 10~18시 정시 9개뿐이라 그 사이 값은 뜻이 없고,
 * 눈금 인덱스가 `shadeByHour` 와 같은 축이다. 값은 시(10~18)로 주고받는다.
 */
const HOURS = SHADE_HOURS.map((hour) => Number(hour.slice(0, 2)));
const FIRST = HOURS[0] ?? 10;
const LAST = HOURS[HOURS.length - 1] ?? 18;

export function ShadeHourTrack({
  value,
  onChange,
}: {
  value: number;
  onChange: (hour: number) => void;
}) {
  const clamp = (hour: number) => Math.min(LAST, Math.max(FIRST, hour));
  return (
    <div className="ev-shade-track" role="toolbar" aria-label="그늘 시각">
      <button
        type="button"
        className="ev-shade-arrow"
        aria-label="한 시간 전"
        disabled={value <= FIRST}
        onClick={() => onChange(clamp(value - 1))}
      >
        ‹
      </button>
      <div className="ev-shade-ticks">
        {HOURS.map((hour) => (
          <button
            key={hour}
            type="button"
            className={hour === value ? 'ev-shade-tick ev-shade-tick--on' : 'ev-shade-tick'}
            aria-label={`${hour}시`}
            aria-pressed={hour === value}
            onClick={() => onChange(hour)}
          >
            <span className="ev-shade-dot" aria-hidden="true" />
            {hour}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="ev-shade-arrow"
        aria-label="한 시간 후"
        disabled={value >= LAST}
        onClick={() => onChange(clamp(value + 1))}
      >
        ›
      </button>
      <span className="ev-shade-time">{`${String(value).padStart(2, '0')}:00`}</span>
    </div>
  );
}
