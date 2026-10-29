const { ObjectId } = require("mongodb");
const {
  InputError,
  normalizeQuestion
} = require("./validation");

const CONTENT_FIELDS = [
  "title",
  "type",
  "required",
  "options",
  "min_choices",
  "max_choices",
  "exact_choices",
  "min_length",
  "max_length",
  "min_value",
  "max_value",
  "integer_only"
];

function questionContent(source) {
  const content = {};
  for (const field of CONTENT_FIELDS) content[field] = source[field];
  return content;
}

function normalizeLibraryContent(body) {
  const normalized = normalizeQuestion(
    { ...body, jump_rules: [] },
    1,
    1
  );
  return questionContent(normalized);
}

function canAccessRoot(root, userId) {
  const id = String(userId);
  return (
    String(root.owner_id) === id ||
    (root.shared_with_user_ids || []).some((item) => String(item) === id)
  );
}

async function createRootWithVersion(db, ownerId, content, options = {}) {
  const roots = db.collection("question_roots");
  const versions = db.collection("question_versions");
  const now = new Date();
  const rootId = new ObjectId();
  const versionId = new ObjectId();
  const version = {
    _id: versionId,
    root_id: rootId,
    version_no: 1,
    previous_version_id: null,
    derived_from_version_id: options.derivedFromVersionId || null,
    ...content,
    created_by: ownerId,
    created_at: now
  };
  const root = {
    _id: rootId,
    owner_id: ownerId,
    current_version_id: versionId,
    current_version_no: 1,
    in_library: options.inLibrary === true,
    visibility: "private",
    shared_with_user_ids: [],
    created_at: now,
    updated_at: now
  };

  await versions.insertOne(version);
  await roots.insertOne(root);
  return { root, version };
}

async function reviseRoot(db, root, content, createdBy, options = {}) {
  if (content.type !== root.question_type && root.question_type) {
    throw new InputError("同一题目的版本必须保持题型不变，请新建一道题");
  }

  const versions = db.collection("question_versions");
  const roots = db.collection("question_roots");
  const current = await versions.findOne({ _id: root.current_version_id });
  if (!current) throw new InputError("当前题目版本不存在");
  if (content.type !== current.type) {
    throw new InputError("同一题目的版本必须保持题型不变，请新建一道题");
  }

  const now = new Date();
  const version = {
    _id: new ObjectId(),
    root_id: root._id,
    version_no: root.current_version_no + 1,
    previous_version_id: root.current_version_id,
    derived_from_version_id:
      options.derivedFromVersionId || root.current_version_id,
    ...content,
    created_by: createdBy,
    created_at: now
  };
  await versions.insertOne(version);
  await roots.updateOne(
    { _id: root._id },
    {
      $set: {
        current_version_id: version._id,
        current_version_no: version.version_no,
        question_type: version.type,
        updated_at: now
      }
    }
  );
  root.current_version_id = version._id;
  root.current_version_no = version.version_no;
  root.question_type = version.type;
  root.updated_at = now;
  return version;
}

async function migrateLegacyQuestions(db) {
  const questions = db.collection("questions");
  const surveys = db.collection("surveys");
  const legacy = await questions
    .find({
      $or: [
        { library_root_id: { $exists: false } },
        { library_root_id: null }
      ]
    })
    .toArray();

  let migrated = 0;
  for (const question of legacy) {
    const survey = await surveys.findOne({ _id: question.survey_id });
    if (!survey) continue;
    const content = questionContent(question);
    const { root, version } = await createRootWithVersion(
      db,
      survey.owner_id,
      content,
      { inLibrary: false }
    );
    await questions.updateOne(
      { _id: question._id },
      {
        $set: {
          library_root_id: root._id,
          library_version_id: version._id,
          derived_from_library_version_id: null
        }
      }
    );
    migrated += 1;
  }
  return migrated;
}

function publicVersion(version) {
  return {
    id: version._id.toString(),
    root_id: version.root_id.toString(),
    version_no: version.version_no,
    previous_version_id: version.previous_version_id
      ? version.previous_version_id.toString()
      : null,
    derived_from_version_id: version.derived_from_version_id
      ? version.derived_from_version_id.toString()
      : null,
    title: version.title,
    type: version.type,
    required: version.required,
    options: version.options,
    min_choices: version.min_choices,
    max_choices: version.max_choices,
    exact_choices: version.exact_choices,
    min_length: version.min_length,
    max_length: version.max_length,
    min_value: version.min_value,
    max_value: version.max_value,
    integer_only: version.integer_only,
    created_at: version.created_at
  };
}

function publicRoot(root, currentVersion, versions, viewerId) {
  return {
    id: root._id.toString(),
    owner_id: root.owner_id.toString(),
    can_edit: root.owner_id.toString() === String(viewerId),
    in_library: root.in_library === true,
    visibility: root.visibility || "private",
    shared_user_count: (root.shared_with_user_ids || []).length,
    current_version: currentVersion
      ? publicVersion(currentVersion)
      : null,
    versions: versions.map(publicVersion),
    created_at: root.created_at,
    updated_at: root.updated_at
  };
}

async function questionRootStats(db, root, viewerId) {
  const questions = db.collection("questions");
  const surveys = db.collection("surveys");
  const responses = db.collection("responses");
  const versions = db.collection("question_versions");

  const rootQuestions = await questions
    .find({ library_root_id: root._id })
    .toArray();
  const allSurveyIds = [
    ...new Set(rootQuestions.map((item) => String(item.survey_id)))
  ].map((id) => new ObjectId(id));
  const ownedSurveys = await surveys
    .find({
      _id: { $in: allSurveyIds },
      owner_id: new ObjectId(viewerId)
    })
    .toArray();
  const surveyIds = ownedSurveys.map((item) => item._id);
  const ownedSurveyIdSet = new Set(surveyIds.map(String));
  const questionDocs = rootQuestions.filter((item) =>
    ownedSurveyIdSet.has(String(item.survey_id))
  );
  const questionIds = questionDocs.map((item) => item._id);
  const currentVersion = await versions.findOne({
    _id: root.current_version_id
  });
  const type = currentVersion ? currentVersion.type : null;
  const result = {
    root_id: root._id.toString(),
    title: currentVersion ? currentVersion.title : "",
    type,
    current_version_no: root.current_version_no,
    survey_count: surveyIds.length,
    version_count: new Set(
      questionDocs.map((item) => String(item.library_version_id))
    ).size,
    total_responses: surveyIds.length
      ? await responses.countDocuments({ survey_id: { $in: surveyIds } })
      : 0,
    answered_count: 0,
    options: [],
    values: [],
    average: null,
    min: null,
    max: null
  };

  if (!surveyIds.length || !questionIds.length) return result;

  if (type === "single" || type === "multiple") {
    const pipeline = [
      { $match: { survey_id: { $in: surveyIds } } },
      { $unwind: "$answers" },
      { $match: { "answers.question_id": { $in: questionIds } } }
    ];
    if (type === "multiple") {
      pipeline.push({ $unwind: "$answers.value" });
    }
    pipeline.push({
      $group: {
        _id: {
          question_id: "$answers.question_id",
          value: "$answers.value"
        },
        count: { $sum: 1 }
      }
    });

    const rows = await responses.aggregate(pipeline).toArray();
    const questionMap = new Map(
      questionDocs.map((item) => [String(item._id), item])
    );
    const textCounts = new Map();
    for (const row of rows) {
      const question = questionMap.get(String(row._id.question_id));
      const option = question
        ? (question.options || []).find(
            (item) => item.key === row._id.value
          )
        : null;
      const text = option ? option.text : String(row._id.value);
      textCounts.set(text, (textCounts.get(text) || 0) + row.count);
    }
    result.answered_count = await responses.countDocuments({
      survey_id: { $in: surveyIds },
      "answers.question_id": { $in: questionIds }
    });
    result.options = [...textCounts.entries()]
      .map(([text, count]) => ({
        text,
        count,
        percent: result.answered_count
          ? Math.round((count / result.answered_count) * 1000) / 10
          : 0
      }))
      .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
  }

  if (type === "number") {
    const rows = await responses
      .aggregate([
        { $match: { survey_id: { $in: surveyIds } } },
        { $unwind: "$answers" },
        { $match: { "answers.question_id": { $in: questionIds } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            average: { $avg: "$answers.value" },
            min: { $min: "$answers.value" },
            max: { $max: "$answers.value" }
          }
        }
      ])
      .toArray();
    if (rows.length) {
      result.answered_count = rows[0].count;
      result.average = Math.round(rows[0].average * 100) / 100;
      result.min = rows[0].min;
      result.max = rows[0].max;
    }
  }

  if (type === "text") {
    const rows = await responses
      .aggregate([
        { $match: { survey_id: { $in: surveyIds } } },
        { $unwind: "$answers" },
        { $match: { "answers.question_id": { $in: questionIds } } },
        { $sort: { submitted_at: -1 } },
        {
          $project: {
            _id: 0,
            survey_id: 1,
            value: "$answers.value",
            submitted_at: 1
          }
        }
      ])
      .toArray();
    const surveyMap = new Map(
      ownedSurveys.map((item) => [String(item._id), item.title])
    );
    result.answered_count = rows.length;
    result.values = rows.map((row) => ({
      value: row.value,
      survey_title: surveyMap.get(String(row.survey_id)) || "",
      submitted_at: row.submitted_at
    }));
  }

  return result;
}

module.exports = {
  canAccessRoot,
  createRootWithVersion,
  questionContent,
  normalizeLibraryContent,
  publicRoot,
  publicVersion,
  migrateLegacyQuestions,
  questionRootStats,
  reviseRoot
};
