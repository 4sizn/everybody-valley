/** 시딩 스크립트 로거 — biome `noConsole` 규칙을 따르기 위해 stdout/stderr 에 직접 쓴다(`scripts/research` 관례). */
export const log = (message: string): void => {
  process.stdout.write(`${message}\n`);
};
export const warn = (message: string): void => {
  process.stderr.write(`[warn] ${message}\n`);
};
