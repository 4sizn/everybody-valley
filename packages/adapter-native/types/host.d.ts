/**
 * 네이티브 어댑터만 쓰는 추가 호스트 전역.
 *
 * 공용 전역(`console`, 타이머, `performance`)은 `types/host.d.ts` 에 있다.
 * 여기에는 이 패키지에서만 필요한 것을 최소 폭으로 선언한다 — 이 어댑터는
 * `lib: ["DOM"]` 을 켜지 않기 때문에(켜면 브라우저 API 가 네이티브 코드에
 * 슬그머니 섞여도 컴파일이 통과한다) fetch 타입이 없다.
 *
 * 실제로 쓰는 것은 "스타일 JSON 하나를 GET 해서 파싱한다"뿐이므로,
 * Response 전체가 아니라 그 세 멤버만 요구한다.
 */

interface HostFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

declare function fetch(url: string): Promise<HostFetchResponse>;
