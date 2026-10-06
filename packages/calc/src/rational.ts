/**
 * Exact rational numbers on bigint. Every amount in the planner is a Q so that scaling and
 * summing never drift; values are only rounded when converted for display.
 */
export class Q {
  static readonly ZERO = new Q(0n, 1n);
  static readonly ONE = new Q(1n, 1n);

  private constructor(
    readonly n: bigint,
    readonly d: bigint,
  ) {}

  static of(n: bigint, d: bigint = 1n): Q {
    if (d === 0n) throw new RangeError("division by zero");
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n < 0n ? -n : n, d);
    return new Q(n / g, d / g);
  }

  /**
   * Converts a data or user amount. SS14 stores reagent amounts as fixed point with 2 decimals
   * (FixedPoint2), so inputs are rounded to the nearest 0.01.
   */
  static fromAmount(x: number): Q {
    if (!Number.isFinite(x)) throw new RangeError(`not a finite amount: ${x}`);
    return Q.of(BigInt(Math.round(x * 100)), 100n);
  }

  add(o: Q): Q {
    return Q.of(this.n * o.d + o.n * this.d, this.d * o.d);
  }

  sub(o: Q): Q {
    return Q.of(this.n * o.d - o.n * this.d, this.d * o.d);
  }

  mul(o: Q): Q {
    return Q.of(this.n * o.n, this.d * o.d);
  }

  div(o: Q): Q {
    return Q.of(this.n * o.d, this.d * o.n);
  }

  /** Smallest integer ≥ this. */
  ceil(): Q {
    const q = this.n / this.d;
    const up = this.n > 0n && this.n % this.d !== 0n ? q + 1n : q;
    return Q.of(up);
  }

  cmp(o: Q): -1 | 0 | 1 {
    const l = this.n * o.d;
    const r = o.n * this.d;
    return l < r ? -1 : l > r ? 1 : 0;
  }

  min(o: Q): Q {
    return this.cmp(o) <= 0 ? this : o;
  }

  max(o: Q): Q {
    return this.cmp(o) >= 0 ? this : o;
  }

  isZero(): boolean {
    return this.n === 0n;
  }

  isPositive(): boolean {
    return this.n > 0n;
  }

  isInteger(): boolean {
    return this.d === 1n;
  }

  toNumber(): number {
    return Number(this.n) / Number(this.d);
  }

  toString(): string {
    return this.d === 1n ? `${this.n}` : `${this.n}/${this.d}`;
  }
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
}
