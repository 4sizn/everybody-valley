// 연구 스크립트 로거 — biome `noConsole` 규칙을 따르기 위해 stdout/stderr 에 직접 쓴다.
export const log = (msg: string): void => {
  process.stdout.write(`${msg}\n`);
};
export const warn = (msg: string): void => {
  process.stderr.write(`[warn] ${msg}\n`);
};
