import { booleanAttr, numberAttr, readString, stringAttr } from "./attribute-value.ts";
import type { DynamoDbItem } from "./attribute-value.ts";

export interface StoredRecordItemInput<T> {
  key: DynamoDbItem;
  type: string;
  record: T;
  expiresAt: number;
  extra?: DynamoDbItem;
}

export function storedRecordItem<T>(input: StoredRecordItemInput<T>): DynamoDbItem {
  return {
    ...input.key,
    recordType: stringAttr(input.type),
    record: stringAttr(JSON.stringify(input.record)),
    expiresAt: numberAttr(input.expiresAt),
    ttl: numberAttr(input.expiresAt),
    ...(input.extra ?? {}),
  };
}

export function parseStoredRecord<T>(item: DynamoDbItem | undefined, expectedType: string): T | undefined {
  if (!item) return undefined;
  const recordType = readString(item, "recordType");
  if (recordType !== expectedType) throw new Error(`DynamoDB item has unexpected type ${recordType}`);
  return JSON.parse(readString(item, "record")) as T;
}

export function metaItem(key: DynamoDbItem, type: string, expiresAt: number, extra: DynamoDbItem = {}): DynamoDbItem {
  return {
    ...key,
    recordType: stringAttr(type),
    expiresAt: numberAttr(expiresAt),
    ttl: numberAttr(expiresAt),
    ...extra,
  };
}

export function markerItem(key: DynamoDbItem, familyId: string, createdAt: number, expiresAt: number): DynamoDbItem {
  return metaItem(key, "refresh_rotation", expiresAt, {
    familyId: stringAttr(familyId),
    createdAt: numberAttr(createdAt),
    rotated: booleanAttr(true),
  });
}
