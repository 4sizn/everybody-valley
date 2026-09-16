/**
 * 키 마스킹. 로그·오류 메시지·fetch_log 에 남는 모든 문자열이 이 함수를 거친다.
 *
 * 두 겹으로 가린다 — (1) 알고 있는 비밀 값을 그대로 치환, (2) 값이 어디서 왔든 `key=`·`authKey=`·
 * `serviceKey=` 류 쿼리 파라미터와 한강홍수통제소의 경로 세그먼트 키(`api.hrfco.go.kr/<key>/`)를 패턴으로.
 */
export const MASK = '<KEY>';

const QUERY_KEY_PARAMS = /([?&](?:key|authKey|serviceKey|ServiceKey|apiKey|api_key)=)[^&\s"'#]+/g;
const HRFCO_PATH_KEY = /(api\.hrfco\.go\.kr\/)[A-Za-z0-9-]{16,}(\/)/g;

export type Redactor = (text: string) => string;

export function createRedactor(secrets: readonly string[]): Redactor {
  const values = [...new Set(secrets.filter((s) => s.length >= 4))].sort(
    (a, b) => b.length - a.length,
  );
  return (text) => {
    let out = text;
    for (const v of values) out = out.split(v).join(MASK);
    out = out.replace(QUERY_KEY_PARAMS, `$1${MASK}`);
    out = out.replace(HRFCO_PATH_KEY, `$1${MASK}$2`);
    return out;
  };
}

/** 마스킹이 필요 없는 문맥(테스트 등). */
export const identityRedactor: Redactor = (text) => text;
