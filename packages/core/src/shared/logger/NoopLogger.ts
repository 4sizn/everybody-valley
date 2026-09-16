import { Logger } from './Logger';

/** 테스트·측정용. 아무것도 남기지 않는다. */
export class NoopLogger extends Logger {
  readonly scope: string;

  constructor(scope = 'noop') {
    super();
    this.scope = scope;
  }

  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}

  child(scope: string): Logger {
    return new NoopLogger(`${this.scope}:${scope}`);
  }
}
