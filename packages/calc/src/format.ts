/** Display helpers shared by the planner's step text and the UI. */

/** At most 2 decimals with trailing zeros trimmed, matching SS14's 0.01u fixed point: 1.5, 10, 3.33. */
export function formatAmount(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(2).replace(/\.?0+$/, "");
}

/** Kelvin to °C, rounded to whole degrees for tooltips: 370 K → 97. */
export function kelvinToCelsius(kelvin: number): number {
  return Math.round(kelvin - 273.15);
}
