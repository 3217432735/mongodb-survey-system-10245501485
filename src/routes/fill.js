const express = require("express");
const { ObjectId } = require("mongodb");
const {
  asyncHandler,
  requireLogin,
  toObjectId,
  respondentKey
} = require("../helpers");
const {
  InputError,
  answerError,
  normalizeAnswer,
  isBlank
} = require("../validation");
const { buildPath } = require("../jump");

module.exports = function createFillRouter(db) {
  const router = express.Router();
  const surveys = db.collection("surveys");
  const questions = db.collection("questions");
  const responses = db.collection("responses");

  router.use(requireLogin);

  async function findOpenSurvey(publicIdValue) {
    const survey = await surveys.findOne({
      public_id: String(publicIdValue || "")
    });
    if (!survey) {
      const error = new Error("问卷不存在");
      error.status = 404;
      throw error;
    }
    if (survey.status !== "published") {
      const error = new Error(
        survey.status === "closed" ? "问卷已经关闭" : "问卷还没有发布"
      );
      error.status = 403;
      throw error;
    }
    if (survey.deadline && survey.deadline.getTime() <= Date.now()) {
      const error = new Error("问卷已经超过截止时间");
      error.status = 403;
      throw error;
    }
    return survey;
  }

  router.get(
    "/fill/:publicId",
    asyncHandler(async (req, res) => {
      const survey = await findOpenSurvey(req.params.publicId);
      const list = await questions
        .find({ survey_id: survey._id })
        .sort({ order: 1 })
        .toArray();

      let alreadySubmitted = false;
      if (!survey.allow_multiple) {
        const key = respondentKey(req.session.user.id, survey._id);
        alreadySubmitted = Boolean(
          await responses.findOne({
            survey_id: survey._id,
            respondent_key: key
          })
        );
      }

      res.json({
        survey: {
          public_id: survey.public_id,
          title: survey.title,
          description: survey.description,
          allow_anonymous: survey.allow_anonymous,
          allow_multiple: survey.allow_multiple,
          deadline: survey.deadline
        },
        already_submitted: alreadySubmitted,
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

  router.post(
    "/fill/:publicId",
    asyncHandler(async (req, res) => {
      const survey = await findOpenSurvey(req.params.publicId);
      const list = await questions
        .find({ survey_id: survey._id })
        .sort({ order: 1 })
        .toArray();

      if (!Array.isArray(req.body.answers)) {
        throw new InputError("答案格式不正确");
      }
      const byOrder = new Map(list.map((item) => [item.order, item]));
      const rawByOrder = new Map();
      for (const item of req.body.answers) {
        const order = Number(item.question_order);
        if (!byOrder.has(order)) continue;
        rawByOrder.set(String(order), item.value);
      }

      const path = buildPath(list, rawByOrder);
      const savedAnswers = [];
      for (const question of path) {
        const rawValue = rawByOrder.get(String(question.order));
        if (isBlank(question, rawValue)) {
          if (question.required) {
            return res.status(400).json({
              error: "第" + question.order + "题是必答题，请填写后再提交"
            });
          }
          continue;
        }
        const error = answerError(question, rawValue);
        if (error) {
          return res.status(400).json({
            error: "第" + question.order + "题：" + error
          });
        }
        savedAnswers.push({
          question_id: question._id,
          question_order: question.order,
          type: question.type,
          value: normalizeAnswer(question, rawValue)
        });
      }

      const anonymous = survey.allow_anonymous && req.body.anonymous === true;
      const key = respondentKey(req.session.user.id, survey._id);
      if (!survey.allow_multiple) {
        const exists = await responses.findOne({
          survey_id: survey._id,
          respondent_key: key
        });
        if (exists) {
          return res.status(409).json({ error: "你已经填写过这份问卷" });
        }
      }

      const doc = {
        survey_id: survey._id,
        respondent_id: anonymous ? null : new ObjectId(req.session.user.id),
        respondent_name: anonymous ? null : req.session.user.username,
        respondent_key: key,
        anonymous,
        answers: savedAnswers,
        submitted_at: new Date()
      };
      const result = await responses.insertOne(doc);
      res.status(201).json({
        ok: true,
        response_id: result.insertedId.toString(),
        message: anonymous ? "已匿名提交" : "提交成功"
      });
    })
  );

  return router;
};
