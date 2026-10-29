async function ensureIndexes(db) {
  await db.collection("users").createIndex({ username: 1 }, { unique: true });
  await db.collection("surveys").createIndex({ public_id: 1 }, { unique: true });
  await db.collection("surveys").createIndex({ owner_id: 1, created_at: -1 });
  await db
    .collection("questions")
    .createIndex({ survey_id: 1, order: 1 }, { unique: true });
  await db
    .collection("questions")
    .createIndex({ library_root_id: 1, library_version_id: 1 });
  await db.collection("question_roots").createIndex({
    owner_id: 1,
    in_library: 1,
    updated_at: -1
  });
  await db.collection("question_roots").createIndex({
    shared_with_user_ids: 1,
    updated_at: -1
  });
  await db
    .collection("question_versions")
    .createIndex({ root_id: 1, version_no: -1 }, { unique: true });
  await db
    .collection("responses")
    .createIndex({ survey_id: 1, submitted_at: -1 });
  await db
    .collection("responses")
    .createIndex({ survey_id: 1, respondent_key: 1 });
  await db
    .collection("responses")
    .createIndex({ survey_id: 1, "answers.question_id": 1 });
}

module.exports = { ensureIndexes };
