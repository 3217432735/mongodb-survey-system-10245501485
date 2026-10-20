const { ObjectId } = require("mongodb");
const crypto = require("crypto");

function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "请先登录" });
  }
  next();
}

function toObjectId(value) {
  if (!ObjectId.isValid(value)) return null;
  return new ObjectId(value);
}

function publicId() {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(8);
  let result = "";
  for (const byte of bytes) result += chars[byte % chars.length];
  return result;
}

function respondentKey(userId, surveyId) {
  return crypto
    .createHmac("sha256", "survey-respondent-key")
    .update(String(userId) + ":" + String(surveyId))
    .digest("hex");
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

module.exports = {
  asyncHandler,
  requireLogin,
  toObjectId,
  publicId,
  respondentKey,
  cleanText
};
