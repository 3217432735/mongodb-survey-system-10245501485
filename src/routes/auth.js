const express = require("express");
const { asyncHandler } = require("../helpers");
const { hashPassword, checkPassword } = require("../password");

module.exports = function createAuthRouter(db) {
  const router = express.Router();
  const users = db.collection("users");

  router.post(
    "/register",
    asyncHandler(async (req, res) => {
      const username = String(req.body.username || "").trim();
      const password = String(req.body.password || "");

      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        return res.status(400).json({
          error: "用户名需要3到20位，只能使用字母、数字和下划线"
        });
      }
      if (password.length < 6 || password.length > 64) {
        return res.status(400).json({ error: "密码长度需要为6到64位" });
      }

      const exists = await users.findOne({ username });
      if (exists) return res.status(409).json({ error: "用户名已经被注册" });

      const { salt, hash } = hashPassword(password);
      const doc = {
        username,
        password_salt: salt,
        password_hash: hash,
        created_at: new Date()
      };
      try {
        const result = await users.insertOne(doc);
        req.session.user = {
          id: result.insertedId.toString(),
          username
        };
        res.status(201).json({
          user: {
            id: result.insertedId.toString(),
            username,
            created_at: doc.created_at
          }
        });
      } catch (error) {
        if (error.code === 11000) {
          return res.status(409).json({ error: "用户名已经被注册" });
        }
        throw error;
      }
    })
  );

  router.post(
    "/login",
    asyncHandler(async (req, res) => {
      const username = String(req.body.username || "").trim();
      const password = String(req.body.password || "");
      const user = await users.findOne({ username });

      if (
        !user ||
        !checkPassword(password, user.password_salt, user.password_hash)
      ) {
        return res.status(401).json({ error: "用户名或密码错误" });
      }

      req.session.user = { id: user._id.toString(), username: user.username };
      res.json({
        user: {
          id: user._id.toString(),
          username: user.username,
          created_at: user.created_at
        }
      });
    })
  );

  router.post("/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });

  router.get(
    "/me",
    asyncHandler(async (req, res) => {
      if (!req.session.user) return res.json({ user: null });
      const user = await users.findOne(
        { username: req.session.user.username },
        { projection: { password_hash: 0, password_salt: 0 } }
      );
      if (!user) {
        req.session.destroy(() => {});
        return res.json({ user: null });
      }
      res.json({
        user: {
          id: user._id.toString(),
          username: user.username,
          created_at: user.created_at
        }
      });
    })
  );

  return router;
};
