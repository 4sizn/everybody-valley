/**
 * 키·값 저장 포트.
 *
 * web 의 `localStorage` 는 동기, 네이티브의 AsyncStorage 는 비동기다.
 * 둘 중 넓은 쪽(비동기)에 맞춰 놓아야 어댑터를 갈아끼울 때 호출부가
 * 바뀌지 않는다. 데모는 `try{}catch{}` 로 실패를 삼키지만, 여기서는
 * 실패가 `Result` 로 드러나 로그에 남는다.
 */
import type { CancellationToken } from '../../shared/async/cancellation';
import type { Result, VoidResult } from '../../shared/result';

export abstract class StoragePort {
  abstract read(key: string, token: CancellationToken): Promise<Result<string | null>>;
  abstract write(key: string, value: string, token: CancellationToken): Promise<VoidResult>;
  abstract remove(key: string, token: CancellationToken): Promise<VoidResult>;
}

/** 저장 키를 한 곳에 모아 오타로 값이 사라지는 일을 막는다. */
export const STORAGE_KEYS = {
  /** 데모의 `localStorage.getItem('spotts-clone-layout')` 과 같은 목적. */
  spotLayout: 'modu-valley/spot-layout',
  /** 계곡 화면 그늘 보기 on/off (F4 결정 (g)). 값은 `'true' | 'false'`. 시각은 저장하지 않는다. */
  shadeVisible: 'modu-valley/shade-visible',
  /** 테마 선택 `'light' | 'dark' | 'system'`(C9). 없으면 앱 기본(D1 라이트, 개발용 강제 env). */
  themeMode: 'modu-valley/theme-mode',
  /**
   * 관리자 API 토큰(OPS1, 임시 — 계정 플로우가 생기면 제거). 좌상단 10탭으로 연 입력 화면이
   * 여기 쓴다. 값이 있으면 관리자 모드가 켜진 것으로 본다 — 실제 권한은 서버가 이 값을
   * `Authorization: Bearer` 로 매 요청 확인한다(제스처는 입구일 뿐 권한을 주지 않는다).
   */
  adminToken: 'modu-valley/admin-token',
} as const;
