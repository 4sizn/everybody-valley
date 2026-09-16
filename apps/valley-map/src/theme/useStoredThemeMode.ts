/**
 * 앱 시작 시 저장된 테마 선택을 **세션 없이** 한 번 읽는다 (C9).
 *
 * `ThemeProvider` 는 `SessionProvider` 바깥에 있다 — 지도 세션은 지도 표면이 마운트된 뒤에야
 * 생기고, 테마는 그보다 먼저 정해져야 첫 페인트가 맞다. 그래서 세션의 `LoadSessionUseCase`
 * 가 읽는 것과 **같은 키**(`STORAGE_KEYS.themeMode`)를 같은 `StoragePort` 로 여기서 먼저
 * 읽는다. 이후의 변화는 세션이 진실이고(`SessionProvider` 가 다리를 놓는다), 이 훅은 시작
 * 값만 준다.
 *
 * 반환 `undefined` 는 아직 읽는 중, `null` 은 저장값 없음(앱 기본으로). 읽기 실패도 `null`
 * 이다 — 데모처럼 삼키지 않고 경고를 남긴다. 정적 렌더(Node)에서는 effect 가 돌지 않아
 * `undefined` 로 남고 호출부가 env 기본을 쓴다 — `+html.tsx` 의 초기 `data-theme` 과 같은 값.
 */
import {
  CancellationTokenSource,
  ConsoleLogger,
  isThemeMode,
  type Logger,
  STORAGE_KEYS,
  type ThemeMode,
} from '@modu-valley/core';
import { useEffect, useState } from 'react';
import { createStorage } from '@/platform/mapPlatform';

const logger: Logger = new ConsoleLogger('valley').child('theme');

export function useStoredThemeMode(): ThemeMode | null | undefined {
  const [stored, setStored] = useState<ThemeMode | null | undefined>(undefined);

  useEffect(() => {
    const lifetime = new CancellationTokenSource();
    void createStorage()
      .read(STORAGE_KEYS.themeMode, lifetime.token)
      .then((read) => {
        if (lifetime.token.cancelled) return;
        if (!read.ok) {
          logger.warn('저장된 테마 선택을 읽지 못해 앱 기본을 쓴다', { code: read.error.code });
          setStored(null);
          return;
        }
        setStored(isThemeMode(read.value) ? read.value : null);
      });
    return () => {
      lifetime.cancel('theme-provider-unmount');
      lifetime.dispose();
    };
  }, []);

  return stored;
}
