import type { ServiceConfig } from "../../../shared/config.ts";
import { sha256Base64Url } from "../../../shared/crypto.ts";
import { nowSeconds } from "../../../shared/time.ts";
import type { MetadataCacheEntry, MetadataCacheNamespace, MetadataCacheStore } from "../metadata-cache-store.ts";
import { readNumber } from "./attribute-value.ts";
import type { DynamoDbClient } from "./client.ts";
import { parseStoredRecord, storedRecordItem } from "./item-codec.ts";
import { metadataCacheKey } from "./keys.ts";
import { dynamoDbStoreContext } from "./store-context.ts";
import type { DynamoDbStoreContext } from "./store-context.ts";

interface StoredMetadataCacheRecord {
  body: unknown;
}

export class DynamoDbMetadataCacheStore implements MetadataCacheStore {
  private readonly ctx: DynamoDbStoreContext;

  constructor(config: ServiceConfig, client: DynamoDbClient) {
    this.ctx = dynamoDbStoreContext(config, client);
  }

  async read(namespace: MetadataCacheNamespace, key: string): Promise<MetadataCacheEntry | undefined> {
    const item = await this.ctx.client.getItem({ TableName: this.ctx.tableName, Key: cacheKey(namespace, key), ConsistentRead: true });
    if (!item) return undefined;
    const expiresAt = readNumber(item, "expiresAt");
    if (expiresAt <= nowSeconds()) return undefined;
    const record = parseStoredRecord<StoredMetadataCacheRecord>(item, recordType(namespace));
    if (!record) return undefined;
    return { body: record.body, expiresAt };
  }

  async write(namespace: MetadataCacheNamespace, key: string, body: unknown, cacheSeconds: number): Promise<void> {
    const itemKey = cacheKey(namespace, key);
    if (cacheSeconds <= 0) {
      await this.ctx.client.deleteItem({ TableName: this.ctx.tableName, Key: itemKey });
      return;
    }
    const expiresAt = nowSeconds() + cacheSeconds;
    await this.ctx.client.putItem({
      TableName: this.ctx.tableName,
      Item: storedRecordItem({ key: itemKey, type: recordType(namespace), record: { body }, expiresAt }),
    });
  }
}

function cacheKey(namespace: MetadataCacheNamespace, key: string) {
  return metadataCacheKey(namespace, sha256Base64Url(key));
}

function recordType(namespace: MetadataCacheNamespace): string {
  return `metadata_cache:${namespace}`;
}
