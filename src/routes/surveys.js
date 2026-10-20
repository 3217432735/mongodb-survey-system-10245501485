const express = require("express");
const { ObjectId } = require("mongodb");
const {
  asyncHandler,
  requireLogin,
  toObjectId,
  publicId,
  cleanText
} = require("../helpers");
const {
  InputError,
  text,
  normalizeQuestion
} = require("../validation");
const { getSurveyStats } = require("../stats");

module.exports = function createSurveyRouter(db) {
  const router = express.Router();
  const surveys = db.collection("surveys");
  const questions = db.collection("questions");
  const responses = db.collection("responses");

  router.use(requireLogin);

  async function findOwnedSurvey(req) {
    const id = toObjectId(req.params.id);
    if (!id) throw new InputError("问卷编号不正确");
    const survey = await surveys.findOne({
      _id: id,
      owner_id: new ObjectId(req.session.user.id)
    });
    if (!survey) {
      const error = new Error("问卷不存在或无权访问");
      error.status = 404;
      throw error;
    }
    return survey;
  }

  function parseDeadline(value) {
    if (value === undefined || value === null || value === "") return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new InputError("截止时间格式不正确");
    return date;
  }

  router.get(
    "/surveys",
    asyncHandler(async (req, res) => {
      const ownerId = new ObjectId(req.session.user.id);
      const list = await surveys
        .aggregate([
          { $match: { owner_id: ownerId } },
          {
            $lookup: {
              from: "responses",
              localField: "_id",
              foreignField: "survey_id",
              as: "response_docs"
            }
          },
          { $addFields: { response_count: { $size: "$response_docs" } } },
          { $project: { response_docs: 0 } },
          { $sort: { created_at: -1 } }
        ])
        .toArray();

      res.json({
        surveys: list.map((item) => ({
          id: item._id.toString(),
          public_id: item.public_id,
          title: item.title,
          description: item.description,
          status: item.status,
          deadline: item.deadline,
          allow_anonymous: item.allow_anonymous,
          allow_multiple: item.allow_multiple,
          question_count: item.question_count,
          response_count: item.response_count,
          created_at: item.created_at,
          published_at: item.published_at
        }))
      });
    })
  );

  router.post(
    "/surveys",
    asyncHandler(async (req, res) => {
      const title = text(req.body.title, 100, "问卷标题");
      const description = cleanText(req.body.description, 1000);
      const deadline = parseDeadline(req.body.deadline);

      const doc = {
        owner_id: new ObjectId(req.session.user.id),
        public_id: publicId(),
        title,
        description,
        allow_anonymous: req.body.allow_anonymous === true,
        allow_multiple: req.body.allow_multiple !== false,
        status: "draft",
        deadline,
        question_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
        published_at: null,
        closed_at: null
      };
      const result = await surveys.insertOne(doc);
      res.status(201).json({
        survey: { id: result.insertedId.toString(), ...doc }
      });
    })
  );

  router.get(
    "/surveys/:id",
    asyncHandler(async (req, res) => {
      const survey = await findOwnedSurvey(req);
      const list = await questions
        .find({ survey_id: survey._id })
        .sort({ order: 1 })
        .toArray();
      const responseCount = await responses.countDocuments({
        survey_id: survey._id
      });
      res.json({
        survey: {
          id: survey._id.toString(),
          public_id: survey.public_id,
          title: survey.title,
          description: survey.description,
          status: survey.status,
          deadline: survey.deadline,
          allow_anonymous: survey.allow_anonymous,
          allow_multiple: survey.allow_multiple,
          question_count: survey.question_count,
          response_count: responseCount,
          created_at: survey.created_at,
          published_at: survey.published_at
        },
        questions: list.map((item) => ({
          id: item._id.toString(),
          order: item.order,
          type: item.type,
          title: item.title,
          required: item.required,
          options: item.options,
          min_choices: item.min_choices,
          max_choices: item.max_choices,
          exact_choices: item.exact_choices,
          min_length: item.min_length,
          max_length: item.max_length,
          min_value: item.min_value,
          max_value: item.max_value,
          integer_only: item.integer_only,
          jump_rules: item.jump_rules
        }))
      });
    })
  );

  router.patch(
    "/surveys/:id",
    asyncHandler(async (req, res) => {
      const survey = await findOwnedSurvey(req);
      if (survey.status !== "draft") {
        return res.status(409).json({ error: "问卷发布后不能修改基本信息" });
      }
      const update = { updated_at: new Date() };
      if (req.body.title !== undefined) {
        update.title = text(req.body.title, 100, "问卷标题");
      }
      if (req.body.description !== undefined) {
        update.description = cleanText(req.body.description, 1000);
      }
      if (req.body.deadline !== undefined) {
        update.deadline = parseDeadline(req.body.deadline);
      }
      if (req.body.allow_anonymous !== undefined) {
        update.allow_anonymous = req.body.allow_anonymous === true;
      }
      if (req.body.allow_multiple !== undefined) {
        update.allow_multiple = req.body.allow_multiple === true;
      }
      await surveys.updateOne({ _id: survey._id }, { $set: update });
      res.json({ ok: true });
    })
  );

  router.post(
    "/surveys/:id/questions",
    asyncHandler(async (req, res) => {
      const survey = await findOwnedSurvey(req);
      if (survey.status !== "draft") {
        return res.status(409).json({ error: "问卷发布后不能添加题目" });
      }
      const count = await questions.countDocuments({ survey_id: survey._id });
      const normalized = normalizeQuestion(req.body, count + 1, count + 1);
      const doc = {
        survey_id: survey._id,
        ...normalized,
        created_at: new Date()
      };
      const result = await questions.insertOne(doc);
      await surveys.updateOne(
        { _id: survey._id },
        { $set: { question_count: count + 1, updated_at: new Date() } }
      );
      res.status(201).json({
        question: {
          id: result.insertedId.toString(),
          ...normalized
        }
      });
    })
  );

  router.patch(
    "/surveys/:id/questions/:questionId",
    asyncHandler(async (req, res) => {
      const survey = await findOwnedSurvey(req);
      if (survey.status !== "draft") {
        return res.status(409).json({ error: "问卷发布后不能修改题目" });
      }
      const questionId = toObjectId(req.params.questionId);
      if (!questionId) throw new InputError("题目编号不正确");
      const question = await questions.findOne({
        _id: questionId,
        survey_id: survey._id
      });
      if (!question) {
        const error = new Error("题目不存在");
        error.status = 404;
        throw error;
      }
      const count = await questions.countDocuments({ survey_id: survey._id });
      const normalized = normalizeQuestion(req.body, question.order, count);
      const { order, ...update } = normalized;
      await questions.updateOne({ _id: question._id }, { $set: update });
      await surveys.updateOne(
        { _id: survey._id },
        { $set: { updated_at: new Date() } }
      );
      res.json({ ok: true });
    })
  );

  router.delete(
    "/surveys/:id/questions/:questionId",
    asyncHandler(async (req, res) => {
      const survey = await findOwnedSurvey(req);
      if (survey.status !== "draft") {
        return res.status(409).json({ error: "问卷发布后不能删除题目" });
      }
      const questionId = toObjectId(req.params.questionId);
      const question = questionId
        ? await questions.findOne({ _id: questionId, survey_id: survey._id })
        : null;
      if (!question) {
        const error = new Error("题目不存在");
        error.status = 404;
        throw error;
      }
      const count = await questions.countDocuments({ survey_id: survey._id });
      if (question.order !== count) {
        return res.status(409).json({ error: "为了保持题号不变，只能删除最后一题" });
      }
      await questions.deleteOne({ _id: question._id });
      await surveys.updateOne(
        { _id: survey._id },
        { $set: { question_count: count - 1, updated_at: new Date() } }
      );
      res.json({ ok: true });
    })
  );

  router.post(
    "/surveys/:id/publish",
    asyncHandler(async (req, res) => {
      const survey = await findOwnedSurvey(req);
      if (survey.status !== "draft") {
        return res.status(409).json({ error: "只有草稿问卷可以发布" });
      }
      const count = await questions.countDocuments({ survey_id: survey._id });
      if (count === 0) {
        return res.status(400).json({ error: "请先添加至少一道题目" });
      }
      if (survey.deadline && survey.deadline.getTime() <= Date.now()) {
        return res.status(400).json({ error: "截止时间已经过去，请先修改" });
      }
      await surveys.updateOne(
        { _id: survey._id },
        {
          $set: {
            status: "published",
            question_count: count,
            published_at: new Date(),
            updated_at: new Date()
          }
        }
      );
      res.json({ ok: true, public_id: survey.public_id });
    })
  );

  router.post(
    "/surveys/:id/close",
    asyncHandler(async (req, res) => {
      const survey = await findOwnedSurvey(req);
      if (survey.status !== "published") {
        return res.status(409).json({ error: "只有已发布的问卷可以关闭" });
      }
      await surveys.updateOne(
        { _id: survey._id },
        {
          $set: {
            status: "closed",
            closed_at: new Date(),
            updated_at: new Date()
          }
        }
      );
      res.json({ ok: true });
    })
  );

  router.delete(
    "/surveys/:id",
    asyncHandler(async (req, res) => {
      const survey = await findOwnedSurvey(req);
      if (survey.status !== "draft") {
        return res.status(409).json({ error: "只能删除还没有发布的问卷" });
      }
      await questions.deleteMany({ survey_id: survey._id });
      await surveys.deleteOne({ _id: survey._id });
      res.json({ ok: true });
    })
  );

  router.get(
    "/surveys/:id/stats",
    asyncHandler(async (req, res) => {
      const survey = await findOwnedSurvey(req);
      const stats = await getSurveyStats(db, survey);
      res.json({
        survey: {
          id: survey._id.toString(),
          title: survey.title,
          status: survey.status,
          public_id: survey.public_id
        },
        ...stats
      });
    })
  );

  return router;
};
