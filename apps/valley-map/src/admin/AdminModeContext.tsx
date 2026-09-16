/**
 * 관리자 모드 상태(OPS1, 임시 — 계정 플로우가 생기면 이 파일째로 제거).
 *
 * **이 컨텍스트는 화면 표시용일 뿐 권한을 주지 않는다.** 토큰이 있으면 관리자 UI(숨김·
 * 복구 버튼, 운영 패널)를 보여줄 뿐이고, 실제 권한은 매 서버 요청이 그 토큰을
 * `Authorization: Bearer` 로 확인한다 — 틀린 토큰을 들고 있어도 이 컨텍스트는 그걸 모른다
 * (서버가 401 을 돌려줄 뿐이다). 그래서 `enter()` 는 서버에 한 번 물어 토큰이 실제로
 * 통하는지 확인한 뒤에만 저장한다(`AdminTokenModal` 이 그 호출을 한다 — 여기는 상태만).
 *
 * 저장은 `StoragePort`(`STORAGE_KEYS.adminToken`, 기기)뿐이다 — 로그에 남기지 않는다.
 * `MapSession`/`AppState` 를 거치지 않는 이유는 CLAUDE.md 결정 그대로다: 이건 임시
 * 기능이고, core 의 상태 기계(SessionStore)를 건드리지 않고 표현 계층에서 끝낸다.
 */
import {
  CancellationTokenSource,
  ConsoleLogger,
  type Logger,
  STORAGE_KEYS,
} from '@modu-valley/core';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { createStorage } from '@/platform/mapPlatform';

const logger: Logger = new ConsoleLogger('valley').child('admin');

export type AdminModeValue = {
  /** `null` 이면 꺼짐. 값이 있으면 관리자 UI 를 보여준다(권한은 서버가 매 요청 확인). */
  readonly token: string | null;
  /** 기기 저장소를 아직 읽는 중 — 이 동안은 관리자 UI 를 그리지 않는다(깜빡임 방지). */
  readonly loading: boolean;
  /** 서버 검증까지 끝난 토큰을 저장하고 켠다(`AdminTokenModal` 이 검증한다). */
  readonly enter: (token: string) => Promise<void>;
  /** 토큰을 지우고 끈다 — "관리자 모드 해제 수단". */
  readonly exit: () => Promise<void>;
};

const AdminModeContext = createContext<AdminModeValue | null>(null);

export function AdminModeProvider({ children }: { readonly children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const lifetime = new CancellationTokenSource();
    void createStorage()
      .read(STORAGE_KEYS.adminToken, lifetime.token)
      .then((result) => {
        if (lifetime.token.cancelled) return;
        if (!result.ok) {
          logger.warn('저장된 관리자 토큰을 읽지 못했다', { code: result.error.code });
          setToken(null);
        } else {
          setToken(result.value && result.value.length > 0 ? result.value : null);
        }
        setLoading(false);
      });
    return () => {
      lifetime.cancel('admin-mode-unmount');
      lifetime.dispose();
    };
  }, []);

  const enter = useCallback(async (next: string) => {
    const lifetime = new CancellationTokenSource();
    const result = await createStorage().write(STORAGE_KEYS.adminToken, next, lifetime.token);
    lifetime.dispose();
    if (!result.ok) {
      logger.warn('관리자 토큰을 저장하지 못했다', { code: result.error.code });
      return;
    }
    setToken(next);
  }, []);

  const exit = useCallback(async () => {
    const lifetime = new CancellationTokenSource();
    const result = await createStorage().remove(STORAGE_KEYS.adminToken, lifetime.token);
    lifetime.dispose();
    if (!result.ok) logger.warn('관리자 토큰을 지우지 못했다', { code: result.error.code });
    setToken(null);
  }, []);

  return (
    <AdminModeContext.Provider value={{ token, loading, enter, exit }}>
      {children}
    </AdminModeContext.Provider>
  );
}

export function useAdminMode(): AdminModeValue {
  const value = useContext(AdminModeContext);
  if (value === null) throw new Error('useAdminMode 는 AdminModeProvider 안에서만 쓸 수 있다');
  return value;
}
