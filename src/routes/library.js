const express = require("express");
const { ObjectId } = require("mongodb");
const {
  asyncHandler,
  requireLogin,
  toObjectId
} = require("../helpers");
const {
  InputError,
  text
} = require("../validation");
const {
  canAccessRoot,
  createRootWithVersion,
  normalizeLibraryContent,
  publicRoot,
  publicVersion,
  questionRootStats,
  reviseRoot
} = require("../library");

module.exports = function createLibraryRouter(db) {
  const router = express.Router();
  const roots = db.collection("question_roots");
  const versions = db.collection("question_versions");
  const users = db.collection("users");
  const questions = db.collection("questions");
  const surveys = db.collection("surveys");

  router.use(requireLogin);

  function viewerId(req) {
    return new ObjectId(req.session.user.id);
  }

  async function getAccessibleRoot(req, id) {
    const rootId = toObjectId(id);
    if (!rootId) throw new InputError("题目编号不正确");
    const root = await roots.findOne({ _id: rootId });
    if (!root || !canAccessRoot(root, req.session.user.id)) {
      const error = new Error("题目不存在或无权访问");
      error.status = 404;
      throw error;
    }
    return root;
  }

  async function getOwnedRoot(req, id, options = {}) {
    const rootId = toObjectId(id);
    if (!rootId) throw new InputError("题目编号不正确");
    const root = await roots.findOne({ _id: rootId });
    if (!root || String(root.owner_id) !== String(req.session.user.id)) {
      const error = new Error(
        options.publicMessage || "题目不存在或无权修改"
      );
      error.status = 404;
      throw error;
    }
    return root;
  }

  async function loadVersions(rootId) {
    return versions
      .find({ root_id: rootId })
      .sort({ version_no: -1 })
      .toArray();
  }

  router.get(
    "/library/questions",
    asyncHandler(async (req, res) => {
      const userId = viewerId(req);
      const filter = {
        $or: [{ owner_id: userId }, { shared_with_user_ids: userId }]
      };
      if (req.query.library_only === "1") {
        filter.in_library = true;
      }
      const list = await roots
        .find(filter)
        .sort({ updated_at: -1, created_at: -1 })
        .toArray();
      if (!list.length) return res.json({ questions: [] });

      const rootIds = list.map((item) => item._id);
      const versionList = await versions
        .find({ root_id: { $in: rootIds } })
        .sort({ version_no: -1 })
        .toArray();
      const versionMap = new Map();
      for (const version of versionList) {
        const key = String(version.root_id);
        if (!versionMap.has(key)) versionMap.set(key, []);
        versionMap.get(key).push(version);
      }

      const questions = list.map((root) => {
        const rootVersions = versionMap.get(String(root._id)) || [];
        const current = rootVersions.find(
          (item) => String(item._id) === String(root.current_version_id)
        );
        return publicRoot(root, current, rootVersions, req.session.user.id);
      });
      res.json({ questions });
    })
  );

  router.post(
    "/library/questions",
    asyncHandler(async (req, res) => {
      const content = normalizeLibraryContent(req.body);
      const { root, version } = await createRootWithVersion(
        db,
        viewerId(req),
        content,
        { inLibrary: true }
      );
      res.status(201).json({
        question: publicRoot(root, version, [version], req.session.user.id)
      });
    })
  );

  router.get(
    "/library/questions/:id",
    asyncHandler(async (req, res) => {
      const root = await getAccessibleRoot(req, req.params.id);
      const versionList = await loadVersions(root._id);
      const current = versionList.find(
        (item) => String(item._id) === String(root.current_version_id)
      );
      res.json({
        question: publicRoot(
          root,
          current,
          versionList,
          req.session.user.id
        )
      });
    })
  );

  router.patch(
    "/library/questions/:id",
    asyncHandler(async (req, res) => {
      const root = await getOwnedRoot(req, req.params.id);
      if (typeof req.body.in_library !== "boolean") {
        throw new InputError("缺少题库状态");
      }
      await roots.updateOne(
        { _id: root._id },
        {
          $set: {
            in_library: req.body.in_library,
            updated_at: new Date()
          }
        }
      );
      res.json({ ok: true });
    })
  );

  router.post(
    "/library/questions/:id/versions",
    asyncHandler(async (req, res) => {
      const root = await getOwnedRoot(req, req.params.id);
      const content = normalizeLibraryContent(req.body);
      const version = await reviseRoot(
        db,
        root,
        content,
        viewerId(req)
      );
      res.status(201).json({
        version: publicVersion(version),
        current_version_no: version.version_no
      });
    })
  );

  router.post(
    "/library/questions/:id/versions/:versionId/restore",
    asyncHandler(async (req, res) => {
      const root = await getOwnedRoot(req, req.params.id);
      const versionId = toObjectId(req.params.versionId);
      if (!versionId) throw new InputError("版本编号不正确");
      const target = await versions.findOne({
        _id: versionId,
        root_id: root._id
      });
      if (!target) {
        const error = new Error("历史版本不存在");
        error.status = 404;
        throw error;
      }
      const content = {};
      for (const field of [
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
      ]) {
        content[field] = target[field];
      }
      const version = await reviseRoot(
        db,
        root,
        content,
        viewerId(req),
        { derivedFromVersionId: target._id }
      );
      res.status(201).json({
        version: publicVersion(version),
        restored_from_version_no: target.version_no
      });
    })
  );

  router.post(
    "/library/questions/:id/share",
    asyncHandler(async (req, res) => {
      const root = await getOwnedRoot(req, req.params.id);
      const username = text(req.body.username, 20, "用户名");
      const target = await users.findOne({ username });
      if (!target) throw new InputError("用户不存在");
      if (String(target._id) === String(root.owner_id)) {
        throw new InputError("不能共享给题目创建者本人");
      }
      await roots.updateOne(
        { _id: root._id },
        {
          $addToSet: { shared_with_user_ids: target._id },
          $set: { visibility: "shared", updated_at: new Date() }
        }
      );
      res.json({ ok: true, username: target.username });
    })
  );

  router.delete(
    "/library/questions/:id/share/:userId",
    asyncHandler(async (req, res) => {
      const root = await getOwnedRoot(req, req.params.id);
      const targetId = toObjectId(req.params.userId);
      if (!targetId) throw new InputError("用户编号不正确");
      await roots.updateOne(
        { _id: root._id },
        {
          $pull: { shared_with_user_ids: targetId },
          $set: { updated_at: new Date() }
        }
      );
      const updated = await roots.findOne({ _id: root._id });
      if (!updated.shared_with_user_ids?.length) {
        await roots.updateOne(
          { _id: root._id },
          { $set: { visibility: "private" } }
        );
      }
      res.json({ ok: true });
    })
  );

  router.get(
    "/library/questions/:id/usage",
    asyncHandler(async (req, res) => {
      const root = await getAccessibleRoot(req, req.params.id);
      const ownerRequest = String(root.owner_id) === String(req.session.user.id);
      const usage = await questions
        .find({ library_root_id: root._id })
        .sort({ created_at: -1 })
        .toArray();
      const surveyIds = [
        ...new Set(usage.map((item) => String(item.survey_id)))
      ].map((id) => new ObjectId(id));
      const surveyFilter = { _id: { $in: surveyIds } };
      if (!ownerRequest) {
        surveyFilter.owner_id = viewerId(req);
      }
      const surveyList = await surveys.find(surveyFilter).toArray();
      const surveyMap = new Map(
        surveyList.map((item) => [String(item._id), item])
      );
      const versionList = await versions
        .find({
          _id: {
            $in: usage
              .map((item) => item.library_version_id)
              .filter(Boolean)
          }
        })
        .toArray();
      const versionMap = new Map(
        versionList.map((item) => [String(item._id), item])
      );
      const list = usage
        .filter((item) => surveyMap.has(String(item.survey_id)))
        .map((item) => {
          const survey = surveyMap.get(String(item.survey_id));
          const version = versionMap.get(String(item.library_version_id));
          return {
            survey_id: survey._id.toString(),
            survey_title: survey.title,
            survey_status: survey.status,
            question_id: item._id.toString(),
            question_order: item.order,
            question_title: item.title,
            version_id: item.library_version_id
              ? item.library_version_id.toString()
              : null,
            version_no: version ? version.version_no : null
          };
        });
      res.json({ usages: list });
    })
  );

  router.get(
    "/library/questions/:id/stats",
    asyncHandler(async (req, res) => {
      const root = await getAccessibleRoot(req, req.params.id);
      const stats = await questionRootStats(
        db,
        root,
        req.session.user.id
      );
      res.json(stats);
    })
  );

  return router;
};
