import type { DynamoDbAttributeValue, DynamoDbItem } from "../../auth/storage/dynamodb/attribute-value.ts";
import { readString } from "../../auth/storage/dynamodb/attribute-value.ts";
import type { DeleteItemInput, DynamoDbClient, GetItemInput, PutItemInput, TransactWriteItemsInput, UpdateItemInput } from "../../auth/storage/dynamodb/client.ts";
import { DynamoDbConditionalCheckFailed } from "../../auth/storage/dynamodb/client.ts";

export class FakeDynamoDbClient implements DynamoDbClient {
  private items = new Map<string, DynamoDbItem>();

  snapshotText(): string {
    return JSON.stringify([...this.items.values()]);
  }

  async getItem(input: GetItemInput): Promise<DynamoDbItem | undefined> {
    return clone(this.items.get(keyId(input.Key)));
  }

  async putItem(input: PutItemInput): Promise<void> {
    const id = keyId(input.Item);
    const existing = this.items.get(id);
    if (!conditionPasses(existing, input)) throw new DynamoDbConditionalCheckFailed();
    this.items.set(id, clone(input.Item) ?? {});
  }

  async updateItem(input: UpdateItemInput): Promise<void> {
    const id = keyId(input.Key);
    const existing = this.items.get(id);
    if (!conditionPasses(existing, input)) throw new DynamoDbConditionalCheckFailed();
    this.items.set(id, applyUpdate(existing ?? input.Key, input));
  }

  async deleteItem(input: DeleteItemInput): Promise<DynamoDbItem | undefined> {
    const id = keyId(input.Key);
    const existing = this.items.get(id);
    if (!conditionPasses(existing, input)) throw new DynamoDbConditionalCheckFailed();
    this.items.delete(id);
    return clone(existing);
  }

  async transactWriteItems(input: TransactWriteItemsInput): Promise<void> {
    const copy = new Map([...this.items.entries()].map(([key, value]) => [key, clone(value) ?? {}]));
    const transactional = new FakeDynamoDbClient();
    transactional.items = copy;
    for (const action of input.TransactItems) {
      if (action.Put) await transactional.putItem(action.Put);
      if (action.Update) await transactional.updateItem(action.Update);
      if (action.Delete) await transactional.deleteItem(action.Delete);
    }
    this.items = copy;
  }
}

function conditionPasses(item: DynamoDbItem | undefined, input: { ConditionExpression?: string; ExpressionAttributeNames?: Record<string, string>; ExpressionAttributeValues?: Record<string, DynamoDbAttributeValue> }): boolean {
  if (!input.ConditionExpression) return true;
  return input.ConditionExpression.split(" OR ").some((part) => part.split(" AND ").every((term) => evalTerm(item, term.trim(), input)));
}

function evalTerm(
  item: DynamoDbItem | undefined,
  term: string,
  input: { ExpressionAttributeNames?: Record<string, string>; ExpressionAttributeValues?: Record<string, DynamoDbAttributeValue> },
): boolean {
  const notExists = term.match(/^attribute_not_exists\(([^)]+)\)$/);
  if (notExists) return item?.[resolveName(notExists[1] ?? "", input)] === undefined;
  const exists = term.match(/^attribute_exists\(([^)]+)\)$/);
  if (exists) return item?.[resolveName(exists[1] ?? "", input)] !== undefined;
  const comparison = term.match(/^(\S+) (<=|<|=|>) (\S+)$/);
  if (!comparison) throw new Error(`unsupported condition term ${term}`);
  const left = item?.[resolveName(comparison[1] ?? "", input)];
  const right = input.ExpressionAttributeValues?.[comparison[3] ?? ""];
  if (!left || !right) return false;
  return compare(left, comparison[2] ?? "", right);
}

function compare(left: DynamoDbAttributeValue, operator: string, right: DynamoDbAttributeValue): boolean {
  const leftValue = attributeScalar(left);
  const rightValue = attributeScalar(right);
  if (operator === "=") return leftValue === rightValue;
  if (typeof leftValue !== "number" || typeof rightValue !== "number") return false;
  if (operator === ">") return leftValue > rightValue;
  if (operator === "<") return leftValue < rightValue;
  if (operator === "<=") return leftValue <= rightValue;
  return false;
}

function applyUpdate(existing: DynamoDbItem, input: UpdateItemInput): DynamoDbItem {
  if (!input.UpdateExpression.startsWith("SET ")) throw new Error(`unsupported update ${input.UpdateExpression}`);
  const item = clone(existing) ?? {};
  for (const assignment of input.UpdateExpression.slice(4).split(",")) {
    const [rawName, rawValue] = assignment.split("=").map((part) => part.trim());
    const name = resolveName(rawName ?? "", input);
    const value = input.ExpressionAttributeValues?.[rawValue ?? ""];
    if (!value) throw new Error(`missing update value ${rawValue}`);
    item[name] = cloneValue(value);
  }
  return item;
}

function resolveName(name: string, input: { ExpressionAttributeNames?: Record<string, string> }): string {
  return name.startsWith("#") ? input.ExpressionAttributeNames?.[name] ?? name : name;
}

function keyId(item: DynamoDbItem): string {
  return `${readString(item, "pk")}\u0000${readString(item, "sk")}`;
}

function attributeScalar(value: DynamoDbAttributeValue): string | number | boolean {
  if ("S" in value) return value.S;
  if ("N" in value) return Number(value.N);
  if ("BOOL" in value) return value.BOOL;
  return value.SS.join("\u0000");
}

function clone<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value)) as T;
}

function cloneValue(value: DynamoDbAttributeValue): DynamoDbAttributeValue {
  return clone(value) as DynamoDbAttributeValue;
}
