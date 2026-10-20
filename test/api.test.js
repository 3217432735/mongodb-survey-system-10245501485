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
    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];
    if (setCookies.length) {
      cookie = setCookies.map((item) => item.split(";")[0]).join("; ");
    }
    let data = {};
    try {
      data = await response.json();
    } catch (error) {
      data = {};
    }
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

function questionOptions(texts) {
  return texts;
}

test("基于 MongoDB 的问卷系统接口测试", async (t) => {
  const dbName = "survey_system_test_" + Date.now();
  const { app, client, db } = await createServer({
    dbName,
    sessionSecret: "test-secret"
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

  let surveyId;
  let publicId;
  let questions;

  await t.test("自动生成局域网分享地址", async () => {
    const data = await alice.get("/api/app-info");
    assert.match(data.share_origin, /^http:\/\/\d{1,3}(\.\d{1,3}){3}:\d+$/);
    assert.doesNotMatch(data.share_origin, /localhost|127\.0\.0\.1/);
  });

  await t.test("注册、登录和用户信息", async () => {
    const result = await alice.post(
      "/api/auth/register",
      { username: "alice", password: "123456" },
      201
    );
    assert.equal(result.user.username, "alice");
    assert.ok(result.user.created_at);

    await alice.post(
      "/api/auth/register",
      { username: "alice", password: "123456" },
      409
    );
    await bob.post(
      "/api/auth/register",
      { username: "bob", password: "654321" },
      201
    );
    const me = await alice.get("/api/auth/me");
    assert.equal(me.user.username, "alice");
  });

  await t.test("创建问卷并添加四种题型", async () => {
    const created = await alice.post(
      "/api/surveys",
      {
        title: "校园生活小调查",
        description: "想了解一下大家平时的校园生活，大概两分钟。",
        allow_anonymous: true,
        allow_multiple: true,
        deadline: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
      },
      201
    );
    surveyId = created.survey.id;
    publicId = created.survey.public_id;
    assert.equal(created.survey.status, "draft");

    const q1 = await alice.post(
      "/api/surveys/" + surveyId + "/questions",
      {
        title: "你平时主要在哪里吃饭？",
        type: "single",
        required: true,
        options: ["食堂", "外卖", "自己做"]
      },
      201
    );
    assert.equal(q1.question.order, 1);

    const q2 = await alice.post(
      "/api/surveys/" + surveyId + "/questions",
      {
        title: "你喜欢哪些校园活动？",
        type: "multiple",
        required: true,
        options: ["运动会", "讲座", "社团活动", "志愿活动"],
        min_choices: 2,
        max_choices: 3
      },
      201
    );
    assert.equal(q2.question.order, 2);

    await alice.post(
      "/api/surveys/" + surveyId + "/questions",
      {
        title: "用一两句话说说你对校园生活的建议",
        type: "text",
        required: false,
        min_length: 5,
        max_length: 100
      },
      201
    );
    await alice.post(
      "/api/surveys/" + surveyId + "/questions",
      {
        title: "你平均每天花多少时间运动（分钟）",
        type: "number",
        required: true,
        min_value: 0,
        max_value: 300,
        integer_only: true
      },
      201
    );
    await alice.post(
      "/api/surveys/" + surveyId + "/questions",
      {
        title: "如果愿意，请留下你的联系方式",
        type: "text",
        required: false,
        min_length: 0,
        max_length: 50
      },
      201
    );
    await alice.post(
      "/api/surveys/" + surveyId + "/questions",
      {
        title: "你给学校食堂打几分（0-10）",
        type: "number",
        required: true,
        min_value: 0,
        max_value: 10,
        integer_only: true
      },
      201
    );

    const detail = await alice.get("/api/surveys/" + surveyId);
    assert.equal(detail.questions.length, 6);
    assert.equal(detail.survey.question_count, 6);

    await alice.post(
      "/api/surveys/" + surveyId + "/questions",
      {
        title: "补充题",
        type: "single",
        required: false,
        options: ["A", "B"]
      },
      201
    );
    const afterAdd = await alice.get("/api/surveys/" + surveyId);
    const extra = afterAdd.questions.find((item) => item.order === 7);
    await alice.delete(
      "/api/surveys/" + surveyId + "/questions/" + extra.id,
      200
    );
  });

  await t.test("设置单选题、多选题和数字题的跳转规则", async () => {
    const detail = await alice.get("/api/surveys/" + surveyId);
    questions = detail.questions;
    assert.equal(questions.length, 6);

    const q1 = questions.find((item) => item.order === 1);
    await alice.patch(
      "/api/surveys/" + surveyId + "/questions/" + q1.id,
      {
        title: q1.title,
        type: "single",
        required: true,
        options: questionOptions(["食堂", "外卖", "自己做"]),
        jump_rules: [
          { condition: { option: "A" }, target_order: 4 },
          { condition: { option: "B" }, target_order: 2 }
        ]
      }
    );

    const q2 = questions.find((item) => item.order === 2);
    await alice.patch(
      "/api/surveys/" + surveyId + "/questions/" + q2.id,
      {
        title: q2.title,
        type: "multiple",
        required: true,
        options: ["运动会", "讲座", "社团活动", "志愿活动"],
        min_choices: 2,
        max_choices: 3,
        jump_rules: [{ condition: { option: "D" }, target_order: 6 }]
      }
    );

    const q4 = questions.find((item) => item.order === 4);
    await alice.patch(
      "/api/surveys/" + surveyId + "/questions/" + q4.id,
      {
        title: q4.title,
        type: "number",
        required: true,
        min_value: 0,
        max_value: 300,
        integer_only: true,
        jump_rules: [
          { condition: { op: "gte", value: 30 }, target_order: 6 }
        ]
      }
    );

    await alice.post(
      "/api/surveys/" + surveyId + "/questions/" + q1.id,
      {},
      404
    );

    await alice.post("/api/surveys/" + surveyId + "/publish", {}, 200);
    const published = await alice.get("/api/surveys/" + surveyId);
    assert.equal(published.survey.status, "published");
    assert.equal(
      published.survey.public_id,
      publicId
    );
  });

  await t.test("填写页面只能读到公开字段", async () => {
    const data = await bob.get("/api/fill/" + publicId);
    assert.equal(data.survey.title, "校园生活小调查");
    assert.equal(data.survey.owner_id, undefined);
    assert.equal(data.questions.length, 6);
    assert.equal(data.questions[0].jump_rules.length, 2);
  });

  await t.test("必答、多选数量、文本长度和数字范围校验", async () => {
    const invalidCases = [
      { answers: [], error: "第1题是必答题" },
      {
        answers: [{ question_order: 1, value: "A" }],
        error: "第4题是必答题"
      },
      {
        answers: [
          { question_order: 1, value: "A" },
          { question_order: 4, value: "abc" }
        ],
        error: "第4题：请填写有效的数字"
      },
      {
        answers: [
          { question_order: 1, value: "A" },
          { question_order: 4, value: 25.5 }
        ],
        error: "第4题：本题只能填写整数"
      },
      {
        answers: [
          { question_order: 1, value: "B" },
          { question_order: 2, value: ["A"] }
        ],
        error: "第2题：本题至少选择2项"
      },
      {
        answers: [
          { question_order: 1, value: "B" },
          { question_order: 2, value: ["A", "B", "C", "D"] }
        ],
        error: "第2题：本题最多选择3项"
      },
      {
        answers: [
          { question_order: 1, value: "C" },
          { question_order: 2, value: ["A", "B"] },
          { question_order: 3, value: "太短" }
        ],
        error: "第3题：至少需要填写5个字"
      }
    ];
    for (const item of invalidCases) {
      const result = await bob.post(
        "/api/fill/" + publicId,
        { answers: item.answers },
        400
      );
      assert.match(result.error, new RegExp(item.error));
    }
    assert.equal(
      await db.collection("responses").countDocuments({ survey_id: new (require("mongodb").ObjectId)(surveyId) }),
      0
    );
  });

  await t.test("三种跳转路径都能提交并正确保存", async () => {
    const r1 = await alice.post(
      "/api/fill/" + publicId,
      {
        anonymous: false,
        answers: [
          { question_order: 1, value: "A" },
          { question_order: 4, value: 25 },
          { question_order: 6, value: 8 }
        ]
      },
      201
    );
    assert.ok(r1.response_id);

    await bob.post(
      "/api/fill/" + publicId,
      {
        anonymous: false,
        answers: [
          { question_order: 1, value: "B" },
          { question_order: 2, value: ["A", "B"] },
          { question_order: 3, value: "建议增加夜间自习教室。" },
          { question_order: 4, value: 40 },
          { question_order: 6, value: 6 }
        ]
      },
      201
    );

    await alice.post(
      "/api/fill/" + publicId,
      {
        anonymous: true,
        answers: [
          { question_order: 1, value: "B" },
          { question_order: 2, value: ["A", "D"] },
          { question_order: 6, value: 9 }
        ]
      },
      201
    );

    const docs = await db
      .collection("responses")
      .find({ survey_id: new (require("mongodb").ObjectId)(surveyId) })
      .sort({ submitted_at: 1 })
      .toArray();
    assert.equal(docs.length, 3);
    assert.deepEqual(
      docs[0].answers.map((item) => item.question_order),
      [1, 4, 6]
    );
    assert.deepEqual(
      docs[1].answers.map((item) => item.question_order),
      [1, 2, 3, 4, 6]
    );
    assert.deepEqual(
      docs[2].answers.map((item) => item.question_order),
      [1, 2, 6]
    );
    assert.equal(docs[2].anonymous, true);
    assert.equal(docs[2].respondent_id, null);
    assert.equal(docs[2].respondent_name, null);
  });

  await t.test("统计结果按题目分别计算", async () => {
    const result = await alice.get("/api/surveys/" + surveyId + "/stats");
    assert.equal(result.total_responses, 3);
    assert.equal(result.questions.length, 6);

    const q1 = result.questions.find((item) => item.order === 1);
    const q1Counts = Object.fromEntries(
      q1.options.map((item) => [item.key, item.count])
    );
    assert.deepEqual(q1Counts, { A: 1, B: 2, C: 0 });
    assert.equal(q1.answered_count, 3);

    const q2 = result.questions.find((item) => item.order === 2);
    const q2Counts = Object.fromEntries(
      q2.options.map((item) => [item.key, item.count])
    );
    assert.deepEqual(q2Counts, { A: 2, B: 1, C: 0, D: 1 });
    assert.equal(q2.answered_count, 2);

    const q3 = result.questions.find((item) => item.order === 3);
    assert.equal(q3.answered_count, 1);
    assert.equal(q3.values[0].value, "建议增加夜间自习教室。");

    const q4 = result.questions.find((item) => item.order === 4);
    assert.equal(q4.answered_count, 2);
    assert.equal(q4.average, 32.5);
    assert.equal(q4.min, 25);
    assert.equal(q4.max, 40);

    const q5 = result.questions.find((item) => item.order === 5);
    assert.equal(q5.answered_count, 0);

    const q6 = result.questions.find((item) => item.order === 6);
    assert.equal(q6.answered_count, 3);
    assert.equal(q6.average, 7.67);
  });

  await t.test("用户只能看到自己的问卷", async () => {
    const list = await bob.get("/api/surveys");
    assert.equal(list.surveys.length, 0);
    await bob.get("/api/surveys/" + surveyId, 404);
    await bob.get("/api/surveys/" + surveyId + "/stats", 404);
  });

  await t.test("匿名、限填一次和重复填写限制", async () => {
    const created = await alice.post(
      "/api/surveys",
      {
        title: "匿名意见征集",
        description: "只填一次",
        allow_anonymous: true,
        allow_multiple: false
      },
      201
    );
    const id = created.survey.id;
    await alice.post(
      "/api/surveys/" + id + "/questions",
      {
        title: "你对目前的教学安排满意吗？",
        type: "single",
        required: true,
        options: ["满意", "一般", "不满意"]
      },
      201
    );
    await alice.post("/api/surveys/" + id + "/publish", {}, 200);
    const createdPublic = (await alice.get("/api/surveys/" + id)).survey.public_id;

    await bob.post(
      "/api/fill/" + createdPublic,
      {
        anonymous: true,
        answers: [{ question_order: 1, value: "A" }]
      },
      201
    );
    const duplicate = await bob.post(
      "/api/fill/" + createdPublic,
      {
        anonymous: true,
        answers: [{ question_order: 1, value: "B" }]
      },
      409
    );
    assert.match(duplicate.error, /已经填写过/);

    const fillInfo = await bob.get("/api/fill/" + createdPublic);
    assert.equal(fillInfo.already_submitted, true);
    const doc = await db.collection("responses").findOne({
      survey_id: new (require("mongodb").ObjectId)(id)
    });
    assert.equal(doc.respondent_id, null);
    assert.equal(doc.respondent_name, null);
    assert.ok(doc.respondent_key);
  });

  await t.test("关闭问卷后不能再填写，统计仍然可看", async () => {
    await alice.post("/api/surveys/" + surveyId + "/close", {}, 200);
    const result = await bob.get("/api/fill/" + publicId, 403);
    assert.match(result.error, /关闭/);
    const stats = await alice.get("/api/surveys/" + surveyId + "/stats");
    assert.equal(stats.total_responses, 3);
  });

  await t.test("截止时间已过的问卷不能发布", async () => {
    const created = await alice.post(
      "/api/surveys",
      {
        title: "过期问卷",
        deadline: new Date(Date.now() - 3600 * 1000).toISOString()
      },
      201
    );
    const id = created.survey.id;
    await alice.post(
      "/api/surveys/" + id + "/questions",
      {
        title: "测试题",
        type: "single",
        required: false,
        options: ["A", "B"]
      },
      201
    );
    const result = await alice.post(
      "/api/surveys/" + id + "/publish",
      {},
      400
    );
    assert.match(result.error, /截止时间/);
    await alice.delete("/api/surveys/" + id, 200);
  });
});
