const DAY_IN_MS = 86_400_000;
const PLATFORM_TIME_ZONE = 'America/Cuiaba';

export function getPlatformCivilDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PLATFORM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateOnlyToUtcTimestamp(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return Number.NaN;
  return Date.UTC(year, month - 1, day);
}

export function getTrialDaysRemaining(
  trialEndDate: string,
  configuredDays: number,
  now = new Date()
) {
  const end = dateOnlyToUtcTimestamp(trialEndDate);
  const today = dateOnlyToUtcTimestamp(getPlatformCivilDate(now));
  if (!Number.isFinite(end) || !Number.isFinite(today)) return 0;

  const remaining = Math.floor((end - today) / DAY_IN_MS);
  const maximum = Math.max(0, Number(configuredDays) || 0);
  return Math.max(0, Math.min(maximum, remaining));
}
