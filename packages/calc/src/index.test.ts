import { describe, expect, it } from "vitest";
import { CALC_ENGINE_VERSION } from "./index";

describe("calc package", () => {
  it("exposes a semver version", () => {
    expect(CALC_ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
