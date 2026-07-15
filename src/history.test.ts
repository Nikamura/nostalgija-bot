import { describe, expect, it } from "vitest";
import {
  anniversaryWindow,
  availableBonusYears,
  previousYearWindow,
} from "./history.js";

describe("previousYearWindow", () => {
  it("uses the configured timezone and preserves DST day boundaries", () => {
    const window = previousYearWindow(
      new Date("2026-03-29T12:00:00Z"),
      "Europe/Vilnius",
    );

    expect(window.label).toBe("2025-03-29");
    expect(window.start.toISOString()).toBe("2025-03-29T00:00:00.000Z");
    expect(window.end.toISOString()).toBe("2025-03-30T00:00:00.000Z");
  });

  it("handles leap day by selecting February 28", () => {
    const window = previousYearWindow(
      new Date("2024-02-29T12:00:00Z"),
      "Europe/Vilnius",
    );
    expect(window.label).toBe("2023-02-28");
  });
});

describe("anniversaryWindow", () => {
  it("supports older anniversaries", () => {
    expect(
      anniversaryWindow(
        new Date("2026-07-15T12:00:00Z"),
        "Europe/Vilnius",
        5,
      ).label,
    ).toBe("2021-07-15");
  });

  it("rejects invalid anniversary years", () => {
    expect(() =>
      anniversaryWindow(new Date(), "Europe/Vilnius", 0),
    ).toThrow("yearsAgo must be a positive safe integer");
  });

  it("groups messages through 2am into the preceding chat day", () => {
    const window = anniversaryWindow(
      new Date("2026-07-15T12:00:00Z"),
      "Europe/Vilnius",
      1,
      2,
    );
    expect(window.start.toISOString()).toBe("2025-07-14T23:00:00.000Z");
    expect(window.end.toISOString()).toBe("2025-07-15T23:00:00.000Z");
  });

  it("uses the preceding chat date when the job runs before 2am", () => {
    const window = anniversaryWindow(
      new Date("2026-07-15T22:00:00Z"),
      "Europe/Vilnius",
      1,
      2,
    );
    expect(window.label).toBe("2025-07-15");
    expect(window.start.toISOString()).toBe("2025-07-14T23:00:00.000Z");
  });
});

describe("availableBonusYears", () => {
  it("checks every anniversary back to the oldest available message", () => {
    expect(
      availableBonusYears(
        new Date("2026-07-15T12:00:00Z"),
        "Europe/Vilnius",
        new Date("2021-01-10T12:00:00Z"),
      ),
    ).toEqual([2, 3, 4, 5]);
  });

  it("does not include an anniversary day before the chat began", () => {
    expect(
      availableBonusYears(
        new Date("2026-07-15T12:00:00Z"),
        "Europe/Vilnius",
        new Date("2021-08-10T12:00:00Z"),
      ),
    ).toEqual([2, 3, 4]);
  });
});
