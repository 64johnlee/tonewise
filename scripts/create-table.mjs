import { DynamoDBClient, CreateTableCommand } from "@aws-sdk/client-dynamodb";
const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const TableName = process.env.DYNAMODB_TABLE || "tonewise";
try {
  await client.send(new CreateTableCommand({
    TableName,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
      { AttributeName: "GSI1PK", AttributeType: "S" },
      { AttributeName: "GSI1SK", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: "GSI1",
      KeySchema: [
        { AttributeName: "GSI1PK", KeyType: "HASH" },
        { AttributeName: "GSI1SK", KeyType: "RANGE" },
      ],
      Projection: { ProjectionType: "ALL" },
    }],
  }));
  console.log("Created table " + TableName + " (PAY_PER_REQUEST) with GSI1");
} catch (e) {
  if (e.name === "ResourceInUseException") console.log("Table " + TableName + " already exists");
  else throw e;
}
