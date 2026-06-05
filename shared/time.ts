export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function secondsFromNow(seconds: number): number {
  return nowSeconds() + seconds;
}

export function isoNow(): string {
  return new Date().toISOString();
}
