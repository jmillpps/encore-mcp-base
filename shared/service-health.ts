import { serviceName, serviceVersion } from "./service-info.ts";
import { isoNow } from "./time.ts";

export interface ServiceHealthSnapshot {
  status: string;
  timestamp: string;
  service: {
    name: string;
    version: string;
  };
}

export interface PublicHealthSnapshot {
  status: string;
  service: string;
  time: string;
}

export function serviceHealthSnapshot(): ServiceHealthSnapshot {
  return {
    status: "ok",
    timestamp: isoNow(),
    service: { name: serviceName, version: serviceVersion },
  };
}

export function publicHealthSnapshot(snapshot = serviceHealthSnapshot()): PublicHealthSnapshot {
  return {
    status: snapshot.status,
    service: snapshot.service.name,
    time: snapshot.timestamp,
  };
}
