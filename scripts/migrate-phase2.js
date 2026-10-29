const { MongoClient } = require("mongodb");
const config = require("../src/config");
const { ensureIndexes } = require("../src/db");
const { migrateLegacyQuestions } = require("../src/library");

async function main() {
  const client = new MongoClient(config.mongoUri);
  try {
    await client.connect();
    const db = client.db(config.dbName);
    await ensureIndexes(db);
    const migrated = await migrateLegacyQuestions(db);
    console.log("第二阶段数据迁移完成，已关联旧题目：" + migrated + " 道");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("第二阶段数据迁移失败：", error);
  process.exit(1);
});
