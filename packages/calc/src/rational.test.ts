import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formatAmount, kelvinToCelsius } from "./format";
import { Q } from "./rational";

describe("Q", () => {
  it("normalizes and does exact arithmetic", () => {
    expect(Q.of(2n, 4n).toString()).toBe("1/2");
    expect(Q.of(1n, -3n).toString()).toBe("-1/3");
    const third = Q.of(1n, 3n);
    expect(third.add(third).add(third).toString()).toBe("1");
    expect(Q.of(10n).div(Q.of(3n)).mul(Q.of(3n)).toString()).toBe("10");
    expect(Q.of(5n).sub(Q.of(7n)).toString()).toBe("-2");
  });

  it("rounds inputs to SS14's 0.01u", () => {
    expect(Q.fromAmount(0.22).toString()).toBe("11/50");
    expect(Q.fromAmount(1 / 3).toString()).toBe("33/100");
    expect(() => Q.fromAmount(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it("ceil", () => {
    expect(Q.of(12n, 5n).ceil().toString()).toBe("3");
    expect(Q.of(3n).ceil().toString()).toBe("3");
    expect(Q.of(-7n, 2n).ceil().toString()).toBe("-3");
  });

  it("matches float arithmetic within rounding", () => {
    const amount = fc.integer({ min: 1, max: 100_000 }).map((x) => x / 100);
    fc.assert(
      fc.property(amount, amount, (a, b) => {
        expect(Q.fromAmount(a).div(Q.fromAmount(b)).toNumber()).toBeCloseTo(a / b, 9);
        expect(Q.fromAmount(a).add(Q.fromAmount(b)).cmp(Q.fromAmount(a))).toBe(1);
      }),
    );
  });
});

describe("formatAmount", () => {
  it.each([
    [10, "10"],
    [1.5, "1.5"],
    [10 / 3, "3.33"],
    [20 / 3, "6.67"],
    [0.004, "0"],
    [100, "100"],
    [0.1 + 0.2, "0.3"],
  ])("%s → %s", (value, text) => {
    expect(formatAmount(value)).toBe(text);
  });

  it("kelvinToCelsius", () => {
    expect(kelvinToCelsius(370)).toBe(97);
  });
});
