// Discord timestamp format codes: t=short time, f=short date/time, F=long date/time, R=relative
// https://discord.com/developers/docs/reference#message-formatting-timestamp-styles
export const formats = ["t", "f", "F", "R"];

export function getOffsetMinutes(ianaTimezone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ianaTimezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)!.value, 10);
  const localMs = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((localMs - date.getTime()) / 60000);
}
