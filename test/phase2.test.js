const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createServer } = require("../app");

function createClient(baseUrl) {
  let cookie = "";

  async function request(method, path, body, expectedStatus = 200) {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    const response = await fetch(baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const cookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];
    if (cookies.length) {
      cookie = cookies.map((item) => item.split(";")[0]).join("; ");
    }
    const data = await response.json().catch(() => ({}));
    assert.equal(
      response.status,
      expectedStatus,
      method + " " + path + " 返回 " + response.status + "：" + JSON.stringify(data)
    );
    return data;
  }

  return {
    get: (path, status) => request("GET", path, undefined, status),
    post: (path, body, status) => request("POST", path, body, status),
    patch: (path, body, status) => request("PATCH", path, body, status),
    delete: (path, status) => request("DELETE", path, undefined, status)
  };
}

test("第二阶段题目库、版本、共享和跨问卷统计", async (t) => {
  const dbName = "survey_phase2_test_" + Date.now();
  const { app, client, db } = await createServer({
    dbName,
    sessionSecret: "phase2-test-secret"
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = "http://127.0.0.1:" + server.address().port;
  const alice = createClient(baseUrl);
  const bob = createClient(baseUrl);

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.dropDatabase();
    await client.close();
  });

  await alice.post(
    "/api/auth/register",
    { username: "alice", password: "123456" },
    201
  );
  await bob.post(
    "/api/auth/register",
    { username: "bob", password: "654321" },
    201
  );

  const createdRoot = await alice.post(
    "/api/library/questions",
    {
      title: "你的年龄",
      type: "number",
      required: true,
      min_value: 0,
      max_value: 120,
      integer_only: true
    },
    201
  );
  const rootId = createdRoot.question.id;
  const version1Id = createdRoot.question.current_version.id;
  assert.equal(createdRoot.question.current_version.version_no, 1);
  assert.equal(createdRoot.question.in_library, true);

  const survey1 = await alice.post(
    "/api/surveys",
    {
      title: "人群调查 A",
      allow_anonymous: true,
      allow_multiple: true
    },
    201
  );
  const survey1Id = survey1.survey.id;
  await alice.post(
    "/api/surveys/" + survey1Id + "/questions/from-library",
    { root_id: rootId, version_id: version1Id },
    201
  );

  const detail1 = await alice.get("/api/surveys/" + survey1Id);
  assert.equal(detail1.questions[0].title, "你的年龄");
  assert.equal(detail1.questions[0].library_version_no, 1);

  const version2 = await alice.post(
    "/api/library/questions/" + rootId + "/versions",
    {
      title: "你的年龄段",
      type: "number",
      required: true,
      min_value: 0,
      max_value: 150,
      integer_only: true
    },
    201
  );
  assert.equal(version2.version.version_no, 2);
  assert.equal(version2.version.previous_version_id, version1Id);

  const unchanged1 = await alice.get("/api/surveys/" + survey1Id);
  assert.equal(unchanged1.questions[0].title, "你的年龄");
  assert.equal(unchanged1.questions[0].library_version_no, 1);

  const survey2 = await alice.post(
    "/api/surveys",
    {
      title: "人群调查 B",
      allow_anonymous: true,
      allow_multiple: true
    },
    201
  );
  const survey2Id = survey2.survey.id;
  await alice.post(
    "/api/surveys/" + survey2Id + "/questions/from-library",
    {
      root_id: rootId,
      version_id: version2.version.id
    },
    201
  );
  const detail2 = await alice.get("/api/surveys/" + survey2Id);
  assert.equal(detail2.questions[0].title, "你的年龄段");
  assert.equal(detail2.questions[0].library_version_no, 2);

  await alice.post("/api/surveys/" + survey1Id + "/publish", {}, 200);
  await alice.post("/api/surveys/" + survey2Id + "/publish", {}, 200);
  const fillInfo1 = await bob.get(
    "/api/fill/" + survey1.survey.public_id
  );
  const fillInfo2 = await bob.get(
    "/api/fill/" + survey2.survey.public_id
  );
  await bob.post(
    "/api/fill/" + fillInfo1.survey.public_id,
    { answers: [{ question_order: 1, value: 20 }] },
    201
  );
  await bob.post(
    "/api/fill/" + fillInfo2.survey.public_id,
    { answers: [{ question_order: 1, value: 40 }] },
    201
  );

  await alice.post(
    "/api/library/questions/" + rootId + "/share",
    { username: "bob" },
    200
  );
  const bobLibrary = await bob.get("/api/library/questions");
  assert.ok(bobLibrary.questions.some((item) => item.id === rootId));

  const bobSurvey = await bob.post(
    "/api/surveys",
    { title: "共享题目测试" },
    201
  );
  await bob.post(
    "/api/surveys/" + bobSurvey.survey.id + "/questions/from-library",
    { root_id: rootId },
    201
  );
  await bob.post(
    "/api/library/questions/" + rootId + "/versions",
    {
      title: "不应成功",
      type: "number",
      required: true
    },
    404
  );

  const history = await alice.get(
    "/api/library/questions/" + rootId
  );
  assert.equal(history.question.versions.length, 2);

  const stats = await alice.get(
    "/api/library/questions/" + rootId + "/stats"
  );
  assert.equal(stats.survey_count, 2);
  assert.equal(stats.total_responses, 2);
  assert.equal(stats.answered_count, 2);
  assert.equal(stats.average, 30);
  assert.equal(stats.min, 20);
  assert.equal(stats.max, 40);

  const aliceUsage = await alice.get(
    "/api/library/questions/" + rootId + "/usage"
  );
  assert.equal(aliceUsage.usages.length, 3);
  const bobUsage = await bob.get(
    "/api/library/questions/" + rootId + "/usage"
  );
  assert.equal(bobUsage.usages.length, 1);
  assert.equal(bobUsage.usages[0].survey_id, bobSurvey.survey.id);

  const restored = await alice.post(
    "/api/library/questions/" +
      rootId +
      "/versions/" +
      version1Id +
      "/restore",
    {},
    201
  );
  assert.equal(restored.version.version_no, 3);
  assert.equal(restored.version.title, "你的年龄");
  assert.equal(restored.version.derived_from_version_id, version1Id);

  const historyAfterRestore = await alice.get(
    "/api/library/questions/" + rootId
  );
  assert.equal(historyAfterRestore.question.versions.length, 3);
  assert.equal(historyAfterRestore.question.current_version.title, "你的年龄");

  const inlineSurvey = await alice.post(
    "/api/surveys",
    { title: "内联题保存题库" },
    201
  );
  const inlineQuestion = await alice.post(
    "/api/surveys/" + inlineSurvey.survey.id + "/questions",
    {
      title: "你所在的城市",
      type: "text",
      required: false,
      min_length: 2,
      max_length: 30,
      save_to_library: true
    },
    201
  );
  assert.ok(inlineQuestion.question.library_root_id);
  const libraryAfterInline = await alice.get(
    "/api/library/questions?library_only=1"
  );
  assert.ok(
    libraryAfterInline.questions.some(
      (item) => item.id === inlineQuestion.question.library_root_id
    )
  );
});
