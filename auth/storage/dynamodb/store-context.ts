import type { ServiceConfig } from "../../../shared/config.ts";
import type { DynamoDbClient } from "./client.ts";

export interface DynamoDbStoreContext {
  tableName: string;
  client: DynamoDbClient;
}

export function dynamoDbStoreContext(config: ServiceConfig, client: DynamoDbClient): DynamoDbStoreContext {
  return { tableName: config.oauthDynamoDb.tableName, client };
}
