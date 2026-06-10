import type { DynamoDbAttributeValue, DynamoDbItem } from "./attribute-value.ts";

export interface DynamoDbClient {
  getItem(input: GetItemInput): Promise<DynamoDbItem | undefined>;
  putItem(input: PutItemInput): Promise<void>;
  updateItem(input: UpdateItemInput): Promise<void>;
  deleteItem(input: DeleteItemInput): Promise<DynamoDbItem | undefined>;
  transactWriteItems(input: TransactWriteItemsInput): Promise<void>;
}

export interface GetItemInput {
  TableName: string;
  Key: DynamoDbItem;
  ConsistentRead?: boolean;
}

export interface PutItemInput {
  TableName: string;
  Item: DynamoDbItem;
  ConditionExpression?: string;
  ExpressionAttributeNames?: Record<string, string>;
  ExpressionAttributeValues?: Record<string, DynamoDbAttributeValue>;
}

export interface UpdateItemInput {
  TableName: string;
  Key: DynamoDbItem;
  UpdateExpression: string;
  ConditionExpression?: string;
  ExpressionAttributeNames?: Record<string, string>;
  ExpressionAttributeValues?: Record<string, DynamoDbAttributeValue>;
}

export interface DeleteItemInput {
  TableName: string;
  Key: DynamoDbItem;
  ConditionExpression?: string;
  ExpressionAttributeNames?: Record<string, string>;
  ExpressionAttributeValues?: Record<string, DynamoDbAttributeValue>;
  ReturnValues?: "ALL_OLD";
}

export interface TransactWriteItemsInput {
  TransactItems: Array<{
    Put?: PutItemInput;
    Update?: UpdateItemInput;
    Delete?: DeleteItemInput;
  }>;
}

export class DynamoDbConditionalCheckFailed extends Error {
  constructor() {
    super("DynamoDB conditional check failed");
  }
}
