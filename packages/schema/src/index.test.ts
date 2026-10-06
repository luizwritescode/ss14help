import { describe, expect, it } from "vitest";
import { assertCompatibleSchemaVersion, isCompatibleSchemaVersion, SCHEMA_VERSION } from "./index";

describe("schema version compatibility", () => {
  const [major] = SCHEMA_VERSION.split(".");

  it("accepts any minor or patch of the same major", () => {
    expect(isCompatibleSchemaVersion(SCHEMA_VERSION)).toBe(true);
    expect(isCompatibleSchemaVersion(`${major}.99.7`)).toBe(true);
  });

  it("rejects a different major", () => {
    expect(isCompatibleSchemaVersion(`${Number(major) + 1}.0.0`)).toBe(false);
    expect(() => assertCompatibleSchemaVersion("999.0.0", "upstream")).toThrow(/data\/upstream/);
  });

  it("rejects malformed versions", () => {
    expect(() => isCompatibleSchemaVersion("v1")).toThrow(/semver/);
  });
});
