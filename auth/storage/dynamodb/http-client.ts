import type { DynamoDbItem } from "./attribute-value.ts";
import type { DeleteItemInput, DynamoDbClient, GetItemInput, PutItemInput, TransactWriteItemsInput, UpdateItemInput } from "./client.ts";
import { DynamoDbConditionalCheckFailed } from "./client.ts";
import { AwsCredentialProvider } from "./credentials.ts";
import { signDynamoDbRequest } from "./signing.ts";

export class DynamoDbHttpClient implements DynamoDbClient {
  private readonly credentials = new AwsCredentialProvider();
  private readonly config: { region: string; endpoint?: string };

  constructor(config: { region: string; endpoint?: string }) {
    this.config = config;
  }

  async getItem(input: GetItemInput): Promise<DynamoDbItem | undefined> {
    const output = await this.request<{ Item?: DynamoDbItem }>("DynamoDB_20120810.GetItem", input);
    return output.Item;
  }

  async putItem(input: PutItemInput): Promise<void> {
    await this.request("DynamoDB_20120810.PutItem", input);
  }

  async updateItem(input: UpdateItemInput): Promise<void> {
    await this.request("DynamoDB_20120810.UpdateItem", input);
  }

  async deleteItem(input: DeleteItemInput): Promise<DynamoDbItem | undefined> {
    const output = await this.request<{ Attributes?: DynamoDbItem }>("DynamoDB_20120810.DeleteItem", input);
    return output.Attributes;
  }

  async transactWriteItems(input: TransactWriteItemsInput): Promise<void> {
    await this.request("DynamoDB_20120810.TransactWriteItems", input);
  }

  private async request<T>(target: string, body: unknown): Promise<T> {
    const signed = signDynamoDbRequest({
      region: this.config.region,
      target,
      body: JSON.stringify(body),
      credentials: await this.credentials.credentials(),
      endpoint: this.config.endpoint,
    });
    const response = await fetch(signed.url, { method: "POST", headers: signed.headers, body: signed.body });
    const text = await response.text();
    if (response.ok) return (text ? JSON.parse(text) : {}) as T;
    if (text.includes("ConditionalCheckFailedException") || text.includes("ConditionalCheckFailed")) {
      throw new DynamoDbConditionalCheckFailed();
    }
    throw new Error(`DynamoDB ${target} failed with ${response.status}: ${safeErrorText(text)}`);
  }
}

function safeErrorText(value: string): string {
  return value.replace(/"[^"]*(token|secret|authorization|password)[^"]*"\s*:\s*"[^"]*"/gi, '"redacted":"redacted"');
}
