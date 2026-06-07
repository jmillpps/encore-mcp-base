const unsafeDisplayNamePattern = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/;
const maximumDisplayNameLength = 128;

export function isDisplayName(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= maximumDisplayNameLength && !unsafeDisplayNamePattern.test(value);
}
