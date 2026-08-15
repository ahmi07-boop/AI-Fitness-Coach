const DEFAULT_TIME_ZONE = process.env.APP_TIMEZONE || 'UTC';

function getDateKey(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function normalizeDay(value = new Date()) {
  const raw = getDateKey(value);
  if (!raw) return null;
  return new Date(`${raw}T12:00:00.000Z`);
}

function dayKey(value) {
  return getDateKey(value);
}

module.exports = { DEFAULT_TIME_ZONE, getDateKey, normalizeDay, dayKey };


function getCurrentWeekRange(reference = new Date()) {
  const key = getDateKey(reference);
  const base = new Date(`${key}T12:00:00.000Z`);
  const mondayOffset = (base.getUTCDay() + 6) % 7;
  base.setUTCDate(base.getUTCDate() - mondayOffset);
  const start = new Date(base);
  const end = new Date(base);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

module.exports.getCurrentWeekRange = getCurrentWeekRange;
