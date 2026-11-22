const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" });
const HOUR = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kathmandu",
  hour: "2-digit",
  hourCycle: "h23",
});

/** YYYY-MM-DD in Nepal. */
export const nepalDay = (d: Date = new Date()) => DAY.format(d);
/** 0–23 in Nepal. */
export const nepalHour = (d: Date = new Date()) => Number(HOUR.format(d)) % 24;
