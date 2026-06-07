import { ServiceError } from "../shared/errors.ts";

let activeConnections = 0;

export function acquireSseConnection(maxConnections: number): () => void {
  if (activeConnections >= maxConnections) {
    throw new ServiceError("rate_limited", "sse connection limit exceeded", 429);
  }
  activeConnections += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeConnections -= 1;
  };
}
