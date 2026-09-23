class CircuitBreakerOpenError extends Error {
    constructor(name) {
        super(`Circuit breaker "${name}" is OPEN`);
        this.name = 'CircuitBreakerOpenError';
    }
}
export class CircuitBreaker {
    state = 'CLOSED';
    failures = [];
    successCount = 0;
    nextAttemptAt = 0;
    opts;
    constructor(opts = {}) {
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
    async call(fn, timeoutMs) {
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
        }
        catch (err) {
            this.onFailure();
            throw err;
        }
    }
    runWithTimeout(fn, ms) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
            let settled = false;
            const finish = (err, val) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                if (err)
                    reject(err);
                else
                    resolve(val);
            };
            try {
                const result = fn();
                if (result && typeof result.then === 'function') {
                    result.then((v) => finish(undefined, v), (e) => finish(e));
                }
                else {
                    finish(undefined, result);
                }
            }
            catch (err) {
                finish(err);
            }
        });
    }
    onSuccess() {
        this.failures = [];
        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= this.opts.successThreshold) {
                this.state = 'CLOSED';
                this.successCount = 0;
            }
        }
    }
    onFailure() {
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
    pruneFailures() {
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
