import path from 'node:path';

// R1(`../station-coverage`) 의 키 로더·가림 함수를 그대로 쓴다. 캐시 디렉터리만 이 스파이크 것으로 분리한다.
export { type Keys, ROOT, redact, requireKeys } from '../station-coverage/env.ts';

export const HERE = import.meta.dirname;
export const CACHE_DIR = path.join(HERE, '.cache');
