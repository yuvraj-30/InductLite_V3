const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedParts(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const values: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of formatter.formatToParts(date)) {
    if (
      part.type === "year" ||
      part.type === "month" ||
      part.type === "day" ||
      part.type === "hour" ||
      part.type === "minute" ||
      part.type === "second"
    ) {
      values[part.type] = Number(part.value);
    }
  }

  const hour = values.hour ?? 0;

  return {
    year: values.year ?? date.getUTCFullYear(),
    month: values.month ?? date.getUTCMonth() + 1,
    day: values.day ?? date.getUTCDate(),
    hour: hour === 24 ? 0 : hour,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

function getOffsetMs(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - date.getTime();
}

function zonedTimeToUtc(
  dateOnly: string,
  timeZone: string,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
): Date {
  const [yearStr, monthStr, dayStr] = dateOnly.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const baseUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);

  const firstGuess = new Date(baseUtc - getOffsetMs(new Date(baseUtc), timeZone));
  const refined = new Date(baseUtc - getOffsetMs(firstGuess, timeZone));
  return refined;
}

function addOneDay(dateOnly: string): string {
  const [yearStr, monthStr, dayStr] = dateOnly.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const yyyy = String(next.getUTCFullYear()).padStart(4, "0");
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getUtcDayRangeForTimeZone(
  dateOnly: string,
  timeZone: string,
): { from: Date; to: Date } {
  if (!DATE_ONLY_RE.test(dateOnly)) {
    throw new Error(`Invalid date format: ${dateOnly}`);
  }

  const from = zonedTimeToUtc(dateOnly, timeZone, 0, 0, 0, 0);
  const nextDay = addOneDay(dateOnly);
  const nextFrom = zonedTimeToUtc(nextDay, timeZone, 0, 0, 0, 0);

  return {
    from,
    to: new Date(nextFrom.getTime() - 1),
  };
}
