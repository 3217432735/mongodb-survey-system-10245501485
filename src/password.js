const crypto = require("crypto");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function checkPassword(password, salt, expectedHash) {
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

module.exports = { hashPassword, checkPassword };
