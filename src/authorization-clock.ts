/** Shared clock tolerance without loading runtime schema validators into calculation/UI modules. */
export const MAX_CLOCK_SKEW_MS = 5_000;
const validTime = (value: unknown): value is number => typeof value === 'number'
  && Number.isSafeInteger(value) && value >= 0;
export const isWithinGrantClock = (occurredAtMs: unknown, validatedAtMs: unknown): boolean =>
  validTime(occurredAtMs) && validTime(validatedAtMs)
  && occurredAtMs + MAX_CLOCK_SKEW_MS >= validatedAtMs;
