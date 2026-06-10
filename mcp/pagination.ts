import { McpProtocolError } from "./protocol-error.ts";
import { optionalMethodParams } from "./request-params.ts";

const cursorVersion = 1;
const maxCursorLength = 256;

export function paginatedList<T>(params: unknown, method: string, resultKey: string, items: readonly T[], pageSize: number): Record<string, unknown> {
  const record = optionalMethodParams(params, method, ["_meta", "cursor"]);
  const offset = cursorOffset(record?.cursor, method, items.length);
  const nextOffset = offset + pageSize;
  const page = items.slice(offset, nextOffset);
  return {
    [resultKey]: page,
    ...(nextOffset < items.length ? { nextCursor: encodeCursor(method, nextOffset) } : {}),
  };
}

function cursorOffset(cursor: unknown, method: string, itemCount: number): number {
  if (cursor === undefined) return 0;
  if (typeof cursor !== "string") throw new McpProtocolError(-32602, `${method} cursor must be a string`);
  const parsed = decodeCursor(cursor, method);
  if (parsed.offset >= itemCount) throw new McpProtocolError(-32602, "invalid cursor");
  return parsed.offset;
}

function encodeCursor(method: string, offset: number): string {
  return Buffer.from(JSON.stringify({ v: cursorVersion, m: method, o: offset }), "utf8").toString("base64url");
}

function decodeCursor(cursor: string, method: string): { offset: number } {
  if (cursor.length === 0 || cursor.length > maxCursorLength || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw invalidCursor();
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalidCursor();
    const record = value as Record<string, unknown>;
    if (record.v !== cursorVersion || record.m !== method || !Number.isSafeInteger(record.o) || Number(record.o) <= 0) throw invalidCursor();
    return { offset: Number(record.o) };
  } catch {
    throw invalidCursor();
  }
}

function invalidCursor(): McpProtocolError {
  return new McpProtocolError(-32602, "invalid cursor");
}
