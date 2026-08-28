type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  recoveryTimeoutMs: number;
  callTimeoutMs: number;
  name: string;
}

class CircuitBreakerOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker "${name}" is OPEN`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreaker {
  private state: State = 'CLOSED';
  private failures: number[] = [];
  private successCount = 0;
  private nextAttemptAt: number = 0;
  private readonly opts: CircuitBreakerOptions;

  constructor(opts: Partial<CircuitBreakerOptions> = {}) {
    this.opts = {
      failureThreshold: 5,
      successThreshold: 1,
      recoveryTimeoutMs: 30000,
      callTimeoutMs: 5000,
      name: 'unnamed',
      ...opts,
    };
  }

  getState() { return this.state; }

  async call<T>(fn: () => T | Promise<T>, timeoutMs?: number): Promise<T> {
    this.pruneFailures();

    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptAt) {
        throw new CircuitBreakerOpenError(this.opts.name);
      }
      this.state = 'HALF_OPEN';
    }

    const effectiveTimeout = timeoutMs ?? this.opts.callTimeoutMs;

    try {
      const result = await this.runWithTimeout(fn, effectiveTimeout);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private runWithTimeout<T>(fn: () => T | Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
      let settled = false;
      const finish = (err?: unknown, val?: T) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) reject(err); else resolve(val as T);
      };
      try {
        const result = fn();
        if (result && typeof (result as any).then === 'function') {
          (result as Promise<T>).then((v) => finish(undefined, v), (e) => finish(e));
        } else {
          finish(undefined, result as T);
        }
      } catch (err) {
        finish(err);
      }
    });
  }

  private onSuccess() {
    this.failures = [];
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.opts.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }

  private onFailure() {
    this.failures.push(Date.now());
    this.pruneFailures();

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.successCount = 0;
      this.nextAttemptAt = Date.now() + this.opts.recoveryTimeoutMs;
      return;
    }

    if (this.failures.length >= this.opts.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptAt = Date.now() + this.opts.recoveryTimeoutMs;
    }
  }

  private pruneFailures() {
    const windowMs = 30000;
    const cutoff = Date.now() - windowMs;
    this.failures = this.failures.filter((t) => t > cutoff);
  }

  reset() {
    this.state = 'CLOSED';
    this.failures = [];
    this.successCount = 0;
    this.nextAttemptAt = 0;
  }
}

export const bcryptBreaker = new CircuitBreaker({
  name: 'bcrypt',
  failureThreshold: 5,
  successThreshold: 1,
  recoveryTimeoutMs: 30000,
  callTimeoutMs: 10000,
});
