/**
 * 제보 비밀번호 해시(F5a 결정 (a)) — bcrypt. `bcryptjs` 는 알고리즘을 순수 JS 로 구현해 네이티브
 * 빌드가 필요 없다(pnpm `allowBuilds` 승인 없이도 설치된다). 평문은 해시 뒤 어디에도 남기지 않는다
 * — 호출자는 반환된 해시만 저장한다.
 */
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export function hashReportPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyReportPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
