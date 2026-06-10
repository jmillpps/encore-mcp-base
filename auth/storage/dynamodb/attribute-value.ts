export type DynamoDbAttributeValue =
  | { S: string }
  | { N: string }
  | { BOOL: boolean }
  | { SS: string[] };

export type DynamoDbItem = Record<string, DynamoDbAttributeValue>;

export function stringAttr(value: string): DynamoDbAttributeValue {
  return { S: value };
}

export function numberAttr(value: number): DynamoDbAttributeValue {
  return { N: String(value) };
}

export function booleanAttr(value: boolean): DynamoDbAttributeValue {
  return { BOOL: value };
}

export function stringSetAttr(values: string[]): DynamoDbAttributeValue {
  return { SS: values };
}

export function readString(item: DynamoDbItem, key: string): string {
  const value = item[key];
  if (!value || !("S" in value)) throw new Error(`DynamoDB item missing string ${key}`);
  return value.S;
}

export function readOptionalString(item: DynamoDbItem, key: string): string | undefined {
  const value = item[key];
  if (value === undefined) return undefined;
  if (!("S" in value)) throw new Error(`DynamoDB item has invalid string ${key}`);
  return value.S;
}

export function readNumber(item: DynamoDbItem, key: string): number {
  const value = item[key];
  if (!value || !("N" in value)) throw new Error(`DynamoDB item missing number ${key}`);
  const parsed = Number(value.N);
  if (!Number.isSafeInteger(parsed)) throw new Error(`DynamoDB item has invalid number ${key}`);
  return parsed;
}

export function readOptionalNumber(item: DynamoDbItem, key: string): number | undefined {
  const value = item[key];
  if (value === undefined) return undefined;
  if (!("N" in value)) throw new Error(`DynamoDB item has invalid number ${key}`);
  const parsed = Number(value.N);
  if (!Number.isSafeInteger(parsed)) throw new Error(`DynamoDB item has invalid number ${key}`);
  return parsed;
}

export function readStringSet(item: DynamoDbItem, key: string): string[] {
  const value = item[key];
  if (value === undefined) return [];
  if (!("SS" in value)) throw new Error(`DynamoDB item has invalid string set ${key}`);
  return [...value.SS];
}
