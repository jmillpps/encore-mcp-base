const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const imageMimeTypePattern = /^image\/[A-Za-z0-9.+-]+(?:;[ \t]*[A-Za-z0-9!#$&^_.+-]+=[A-Za-z0-9!#$&^_.+-]+)*$/i;
const audioMimeTypePattern = /^audio\/[A-Za-z0-9.+-]+(?:;[ \t]*[A-Za-z0-9!#$&^_.+-]+=[A-Za-z0-9!#$&^_.+-]+)*$/i;
const dataUrlPattern = /^(data:)(image\/[A-Za-z0-9.+-]+(?:;[A-Za-z0-9!#$&^_.+-]+=[A-Za-z0-9!#$&^_.+-]+)*);base64,([A-Za-z0-9+/]*={0,2})$/i;
const iconSizePattern = /^(?:any|[1-9][0-9]*x[1-9][0-9]*)$/;
const allowedResourceUriProtocols = new Set(["https:", "http:", "ui:"]);

export function isBase64(value: unknown): value is string {
  return typeof value === "string" && value.length % 4 === 0 && base64Pattern.test(value);
}

export function isResourceUri(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return allowedResourceUriProtocols.has(url.protocol);
  } catch {
    return false;
  }
}

export function isIconSource(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const dataUrl = dataUrlPattern.exec(value);
  if (dataUrl) {
    const scheme = dataUrl[1];
    const mimeType = dataUrl[2];
    const data = dataUrl[3];
    return scheme?.toLowerCase() === "data:" && isImageMimeType(mimeType) && isBase64(data);
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isIconSizes(value: unknown): boolean {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string" && iconSizePattern.test(entry));
}

export function isOptionalIconMimeType(value: unknown): boolean {
  return value === undefined || isImageMimeType(value);
}

export function isBinaryContentMimeType(type: unknown, value: unknown): boolean {
  if (type === "image") return isImageMimeType(value);
  if (type === "audio") return isAudioMimeType(value);
  return false;
}

function isImageMimeType(value: unknown): value is string {
  return typeof value === "string" && imageMimeTypePattern.test(value);
}

function isAudioMimeType(value: unknown): value is string {
  return typeof value === "string" && audioMimeTypePattern.test(value);
}
