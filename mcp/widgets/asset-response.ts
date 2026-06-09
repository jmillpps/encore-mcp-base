import { ServiceError } from "../../shared/errors.ts";
import { widgetAssetByPath } from "./index.ts";

const cacheControl = "public, max-age=31536000, immutable";

export function writeWidgetAsset(res: { writeHead: (status: number, headers: Record<string, string>) => void; end: (body: string) => void }, path: string): void {
  const asset = widgetAssetByPath(path);
  if (!asset) throw new ServiceError("not_found", "widget asset not found", 404);
  res.writeHead(200, {
    "cache-control": cacheControl,
    "content-type": asset.contentType,
    "cross-origin-resource-policy": "cross-origin",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
  });
  res.end(asset.body);
}
