import { ServiceError } from "../../shared/errors.ts";
import type { ToolResultCardWidgetOptions } from "./tool-result-card-types.ts";

export function validateToolResultCardOptions(options: ToolResultCardWidgetOptions): void {
  if (options.fields.length === 0) throw invalidToolResultCard();
  const fieldIds = new Set<string>();
  for (const field of options.fields) {
    if (!isHtmlId(field.id) || fieldIds.has(field.id) || !isDataPath(field.path) || !isText(field.label) || !isText(field.fallback)) throw invalidToolResultCard();
    if (field.format !== undefined && field.format !== "text" && field.format !== "verified") throw invalidToolResultCard();
    fieldIds.add(field.id);
  }
  if (options.header.titlePath !== undefined && !isDataPath(options.header.titlePath)) throw invalidToolResultCard();
  if (options.header.subtitlePath !== undefined && !isDataPath(options.header.subtitlePath)) throw invalidToolResultCard();
  if (options.header.avatarPath !== undefined && !isDataPath(options.header.avatarPath)) throw invalidToolResultCard();
  if (options.status && (!isDataPath(options.status.path) || !isText(options.status.fallback) || !isText(options.status.okValue) || !isText(options.status.okSummary) || !isText(options.status.waitingSummary))) throw invalidToolResultCard();
  for (const value of Object.values(options.theme)) {
    if (!isCssValue(value)) throw invalidToolResultCard();
  }
}

function isHtmlId(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value);
}

function isDataPath(value: string): boolean {
  return /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/.test(value);
}

function isText(value: string): boolean {
  return value.length > 0 && value.length <= 240;
}

function isCssValue(value: string): boolean {
  return value.length > 0 && value.length <= 240 && /^[#A-Za-z0-9(),.% /-]+$/.test(value) && !/url\s*\(/i.test(value);
}

function invalidToolResultCard(): ServiceError {
  return new ServiceError("server_error", "invalid tool result card widget", 500);
}
