const { MongoClient, ObjectId } = require("mongodb");
const config = require("../src/config");
const { hashPassword } = require("../src/password");
const { respondentKey } = require("../src/helpers");
const { getLanAddress } = require("../src/network");

async function ensureUser(users, username, password, id) {
  const exists = await users.findOne({ username });
  if (exists) return exists;
  const { salt, hash } = hashPassword(password);
  const doc = {
    _id: id,
    username,
    password_salt: salt,
    password_hash: hash,
    created_at: new Date("2026-09-20T09:00:00+08:00")
  };
  await users.insertOne(doc);
  return doc;
}

async function main() {
  const client = new MongoClient(config.mongoUri);
  await client.connect();
  const db = client.db(config.dbName);
  const users = db.collection("users");
  const surveys = db.collection("surveys");
  const questions = db.collection("questions");
  const responses = db.collection("responses");

  const demo = await ensureUser(
    users,
    "demo",
    "demo123",
    new ObjectId("66f000000000000000000001")
  );
  const xiaoming = await ensureUser(
    users,
    "xiaoming",
    "123456",
    new ObjectId("66f000000000000000000002")
  );
  const xiaohong = await ensureUser(
    users,
    "xiaohong",
    "123456",
    new ObjectId("66f000000000000000000003")
  );
  const xiaolan = await ensureUser(
    users,
    "xiaolan",
    "123456",
    new ObjectId("66f000000000000000000004")
  );
  const xiaobo = await ensureUser(
    users,
    "xiaobo",
    "123456",
    new ObjectId("66f000000000000000000005")
  );

  const surveyMainId = new ObjectId("66f100000000000000000001");
  const surveyDraftId = new ObjectId("66f100000000000000000002");
  const surveyLibraryId = new ObjectId("66f100000000000000000003");
  const allSurveyIds = [surveyMainId, surveyDraftId, surveyLibraryId];
  await questions.deleteMany({ survey_id: { $in: allSurveyIds } });
  await responses.deleteMany({ survey_id: { $in: allSurveyIds } });
  await surveys.deleteMany({ _id: { $in: allSurveyIds } });

  const mainQuestions = [
    {
      _id: new ObjectId("66f200000000000000000101"),
      survey_id: surveyMainId,
      order: 1,
      type: "single",
      title: "你平时主要在哪里吃饭？",
      required: true,
      options: [
        { key: "A", text: "食堂" },
        { key: "B", text: "外卖" },
        { key: "C", text: "自己做" }
      ],
      min_choices: null,
      max_choices: null,
      exact_choices: null,
      min_length: null,
      max_length: null,
      min_value: null,
      max_value: null,
      integer_only: false,
      jump_rules: [
        { condition: { option: "A", match: "any" }, target_order: 4 },
        { condition: { option: "B", match: "any" }, target_order: 2 }
      ]
    },
    {
      _id: new ObjectId("66f200000000000000000102"),
      survey_id: surveyMainId,
      order: 2,
      type: "multiple",
      title: "你喜欢哪些校园活动？",
      required: true,
      options: [
        { key: "A", text: "运动会" },
        { key: "B", text: "讲座" },
        { key: "C", text: "社团活动" },
        { key: "D", text: "志愿活动" }
      ],
      min_choices: 2,
      max_choices: 3,
      exact_choices: null,
      min_length: null,
      max_length: null,
      min_value: null,
      max_value: null,
      integer_only: false,
      jump_rules: [
        { condition: { option: "D", match: "any" }, target_order: 6 }
      ]
    },
    {
      _id: new ObjectId("66f200000000000000000103"),
      survey_id: surveyMainId,
      order: 3,
      type: "text",
      title: "用一两句话说说你对校园生活的建议",
      required: false,
      options: [],
      min_choices: null,
      max_choices: null,
      exact_choices: null,
      min_length: 5,
      max_length: 100,
      min_value: null,
      max_value: null,
      integer_only: false,
      jump_rules: []
    },
    {
      _id: new ObjectId("66f200000000000000000104"),
      survey_id: surveyMainId,
      order: 4,
      type: "number",
      title: "你平均每天运动多少分钟？",
      required: true,
      options: [],
      min_choices: null,
      max_choices: null,
      exact_choices: null,
      min_length: null,
      max_length: null,
      min_value: 0,
      max_value: 300,
      integer_only: true,
      jump_rules: [
        {
          condition: { op: "gte", value: 30 },
          target_order: 6
        }
      ]
    },
    {
      _id: new ObjectId("66f200000000000000000105"),
      survey_id: surveyMainId,
      order: 5,
      type: "text",
      title: "如果愿意，请留下你的联系方式",
      required: false,
      options: [],
      min_choices: null,
      max_choices: null,
      exact_choices: null,
      min_length: 0,
      max_length: 50,
      min_value: null,
      max_value: null,
      integer_only: false,
      jump_rules: []
    },
    {
      _id: new ObjectId("66f200000000000000000106"),
      survey_id: surveyMainId,
      order: 6,
      type: "number",
      title: "你给学校食堂打几分（0-10）",
      required: true,
      options: [],
      min_choices: null,
      max_choices: null,
      exact_choices: null,
      min_length: null,
      max_length: null,
      min_value: 0,
      max_value: 10,
      integer_only: true,
      jump_rules: []
    }
  ];

  const draftQuestions = [
    {
      _id: new ObjectId("66f200000000000000000201"),
      survey_id: surveyDraftId,
      order: 1,
      type: "single",
      title: "你更愿意参加哪一类社团活动？",
      required: true,
      options: [
        { key: "A", text: "运动类" },
        { key: "B", text: "学术类" },
        { key: "C", text: "文艺类" },
        { key: "D", text: "志愿类" }
      ],
      min_choices: null,
      max_choices: null,
      exact_choices: null,
      min_length: null,
      max_length: null,
      min_value: null,
      max_value: null,
      integer_only: false,
      jump_rules: [
        { condition: { option: "A", match: "any" }, target_order: 3 }
      ]
    },
    {
      _id: new ObjectId("66f200000000000000000202"),
      survey_id: surveyDraftId,
      order: 2,
      type: "multiple",
      title: "你希望活动安排在什么时间？",
      required: true,
      options: [
        { key: "A", text: "周末上午" },
        { key: "B", text: "周末下午" },
        { key: "C", text: "工作日晚间" }
      ],
      min_choices: 1,
      max_choices: 2,
      exact_choices: null,
      min_length: null,
      max_length: null,
      min_value: null,
      max_value: null,
      integer_only: false,
      jump_rules: [
        { condition: { option: "C", match: "any" }, target_order: 4 }
      ]
    },
    {
      _id: new ObjectId("66f200000000000000000203"),
      survey_id: surveyDraftId,
      order: 3,
      type: "text",
      title: "简单介绍一下你的兴趣或特长",
      required: false,
      options: [],
      min_choices: null,
      max_choices: null,
      exact_choices: null,
      min_length: 0,
      max_length: 100,
      min_value: null,
      max_value: null,
      integer_only: false,
      jump_rules: []
    },
    {
      _id: new ObjectId("66f200000000000000000204"),
      survey_id: surveyDraftId,
      order: 4,
      type: "number",
      title: "你每周大概能投入多少小时？",
      required: false,
      options: [],
      min_choices: null,
      max_choices: null,
      exact_choices: null,
      min_length: null,
      max_length: null,
      min_value: 0,
      max_value: 40,
      integer_only: true,
      jump_rules: []
    }
  ];

  const libraryQuestions = [
    {
      _id: new ObjectId("66f200000000000000000301"),
      survey_id: surveyLibraryId,
      order: 1,
      type: "single",
      title: "你每周去图书馆几次？",
      required: true,
      options: [
        { key: "A", text: "基本不去" },
        { key: "B", text: "1-2 次" },
        { key: "C", text: "3-5 次" },
        { key: "D", text: "6 次以上" }
      ],
      min_choices: null,
      max_choices: null,
      exact_choices: null,
      min_length: null,
      max_length: null,
      min_value: null,
      max_value: null,
      integer_only: false,
      jump_rules: []
    },
    {
      _id: new ObjectId("66f200000000000000000302"),
      survey_id: surveyLibraryId,
      order: 2,
      type: "text",
      title: "你觉得图书馆最需要改进的地方是什么？",
      required: false,
      options: [],
      min_choices: null,
      max_choices: null,
      exact_choices: null,
      min_length: 0,
      max_length: 200,
      min_value: null,
      max_value: null,
      integer_only: false,
      jump_rules: []
    }
  ];

  const now = Date.now();
  await surveys.insertMany([
    {
      _id: surveyMainId,
      owner_id: demo._id,
      public_id: "campus26",
      title: "校园生活小调查",
      description:
        "想了解一下大家平时的吃饭、运动和校园活动情况。问卷大概需要两分钟，结果只用于课程作业，不会公开个人信息。",
      allow_anonymous: true,
      allow_multiple: true,
      status: "published",
      deadline: new Date(now + 15 * 24 * 3600 * 1000),
      question_count: 6,
      created_at: new Date("2026-10-12T10:00:00+08:00"),
      updated_at: new Date("2026-10-14T16:00:00+08:00"),
      published_at: new Date("2026-10-14T16:00:00+08:00"),
      closed_at: null
    },
    {
      _id: surveyDraftId,
      owner_id: demo._id,
      public_id: "club2026",
      title: "社团活动报名意向调查",
      description: "用于了解大家对社团活动类型和时间的偏好。",
      allow_anonymous: false,
      allow_multiple: true,
      status: "draft",
      deadline: new Date(now + 30 * 24 * 3600 * 1000),
      question_count: 4,
      created_at: new Date("2026-10-16T14:20:00+08:00"),
      updated_at: new Date("2026-10-17T09:30:00+08:00"),
      published_at: null,
      closed_at: null
    },
    {
      _id: surveyLibraryId,
      owner_id: demo._id,
      public_id: "library8",
      title: "图书馆使用情况调查",
      description: "了解一下同学们去图书馆的频率和意见。",
      allow_anonymous: false,
      allow_multiple: true,
      status: "published",
      deadline: new Date(now + 10 * 24 * 3600 * 1000),
      question_count: 2,
      created_at: new Date("2026-10-08T09:10:00+08:00"),
      updated_at: new Date("2026-10-09T11:00:00+08:00"),
      published_at: new Date("2026-10-09T11:00:00+08:00"),
      closed_at: null
    }
  ]);
  await questions.insertMany([
    ...mainQuestions,
    ...draftQuestions,
    ...libraryQuestions
  ]);

  const q = Object.fromEntries(mainQuestions.map((item) => [item.order, item]));
  function answer(order, value) {
    return {
      question_id: q[order]._id,
      question_order: order,
      type: q[order].type,
      value
    };
  }

  const responseRows = [
    {
      user: xiaoming,
      anonymous: false,
      submitted_at: new Date(now - 2.7 * 24 * 3600 * 1000),
      answers: [
        answer(1, "A"),
        answer(4, 20),
        answer(5, "希望食堂晚上多开一会儿。"),
        answer(6, 7)
      ]
    },
    {
      user: xiaohong,
      anonymous: false,
      submitted_at: new Date(now - 2.2 * 24 * 3600 * 1000),
      answers: [
        answer(1, "B"),
        answer(2, ["B", "C"]),
        answer(3, "建议增加夜间自习教室。"),
        answer(4, 40),
        answer(6, 6)
      ]
    },
    {
      user: xiaolan,
      anonymous: false,
      submitted_at: new Date(now - 1.6 * 24 * 3600 * 1000),
      answers: [answer(1, "B"), answer(2, ["A", "D"]), answer(6, 9)]
    },
    {
      user: xiaobo,
      anonymous: false,
      submitted_at: new Date(now - 1.2 * 24 * 3600 * 1000),
      answers: [answer(1, "A"), answer(4, 60), answer(6, 8)]
    },
    {
      user: xiaoming,
      anonymous: false,
      submitted_at: new Date(now - 0.8 * 24 * 3600 * 1000),
      answers: [
        answer(1, "B"),
        answer(2, ["A", "B", "C"]),
        answer(3, "社团活动可以多一些，时间最好放在周末。"),
        answer(4, 35),
        answer(6, 7)
      ]
    },
    {
      user: xiaohong,
      anonymous: false,
      submitted_at: new Date(now - 0.4 * 24 * 3600 * 1000),
      answers: [
        answer(1, "C"),
        answer(2, ["B", "C"]),
        answer(3, "希望宿舍楼下多放几个快递柜。"),
        answer(4, 25),
        answer(5, "微信：xiaohong_2026"),
        answer(6, 5)
      ]
    },
    {
      user: xiaolan,
      anonymous: true,
      submitted_at: new Date(now - 0.1 * 24 * 3600 * 1000),
      answers: [answer(1, "A"), answer(4, 45), answer(6, 9)]
    }
  ];

  await responses.insertMany(
    responseRows.map((row) => ({
      survey_id: surveyMainId,
      respondent_id: row.anonymous ? null : row.user._id,
      respondent_name: row.anonymous ? null : row.user.username,
      respondent_key: respondentKey(row.user._id, surveyMainId),
      anonymous: row.anonymous,
      answers: row.answers,
      submitted_at: row.submitted_at
    }))
  );

  await responses.insertMany([
    {
      survey_id: surveyLibraryId,
      respondent_id: xiaoming._id,
      respondent_name: xiaoming.username,
      respondent_key: respondentKey(xiaoming._id, surveyLibraryId),
      anonymous: false,
      answers: [
        {
          question_id: new ObjectId("66f200000000000000000301"),
          question_order: 1,
          type: "single",
          value: "B"
        },
        {
          question_id: new ObjectId("66f200000000000000000302"),
          question_order: 2,
          type: "text",
          value: "插座有点少，靠窗的位置经常没有位置。"
        }
      ],
      submitted_at: new Date(now - 2 * 24 * 3600 * 1000)
    },
    {
      survey_id: surveyLibraryId,
      respondent_id: xiaohong._id,
      respondent_name: xiaohong.username,
      respondent_key: respondentKey(xiaohong._id, surveyLibraryId),
      anonymous: false,
      answers: [
        {
          question_id: new ObjectId("66f200000000000000000301"),
          question_order: 1,
          type: "single",
          value: "C"
        },
        {
          question_id: new ObjectId("66f200000000000000000302"),
          question_order: 2,
          type: "text",
          value: "希望考试周延长开放时间。"
        }
      ],
      submitted_at: new Date(now - 1.5 * 24 * 3600 * 1000)
    }
  ]);

  console.log("演示数据已经写入。");
  console.log("登录账号：demo / demo123");
  console.log("主问卷链接：http://localhost:" + config.port + "/survey/campus26");
  const lanAddress = getLanAddress();
  if (lanAddress) {
    console.log("手机填写链接：http://" + lanAddress + ":" + config.port + "/survey/campus26");
  }
  console.log("草稿问卷链接：http://localhost:" + config.port + "/builder.html?id=" + surveyDraftId);
  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
