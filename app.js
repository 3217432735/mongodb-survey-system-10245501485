const path = require("path");
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const { MongoClient } = require("mongodb");
const config = require("./src/config");
const { ensureIndexes } = require("./src/db");
const { getLanAddress, getShareOrigin } = require("./src/network");
const createAuthRouter = require("./src/routes/auth");
const createSurveyRouter = require("./src/routes/surveys");
const createFillRouter = require("./src/routes/fill");
const createLibraryRouter = require("./src/routes/library");
const { migrateLegacyQuestions } = require("./src/library");

async function createServer(options = {}) {
  const mongoUri = options.mongoUri || config.mongoUri;
  const dbName = options.dbName || config.dbName;
  const sessionSecret = options.sessionSecret || config.sessionSecret;
  const publicOrigin = options.publicOrigin || config.publicOrigin;

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);
  await ensureIndexes(db);
  await migrateLegacyQuestions(db);

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "300kb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(
    session({
      name: "connect.sid",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        client,
        dbName,
        collectionName: "sessions",
        ttl: 7 * 24 * 60 * 60
      }),
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
      }
    })
  );

  app.use(express.static(path.join(__dirname, "public")));
  app.get("/api/app-info", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({
      share_origin: getShareOrigin(req, {
        publicOrigin,
        fallbackPort: config.port
      })
    });
  });
  app.use("/api/auth", createAuthRouter(db));
  app.use("/api", createLibraryRouter(db));
  app.use("/api", createSurveyRouter(db));
  app.use("/api", createFillRouter(db));

  app.get("/", (req, res) => {
    res.redirect("/dashboard.html");
  });
  app.get("/survey/:publicId", (req, res) => {
    res.redirect("/fill.html?id=" + encodeURIComponent(req.params.publicId));
  });

  app.use("/api", (req, res) => {
    res.status(404).json({ error: "接口不存在" });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || 500;
    if (status >= 500) console.error(error);
    res.status(status).json({
      error: status >= 500 ? "服务器内部错误" : error.message
    });
  });

  return { app, client, db };
}

async function start() {
  const { app, client } = await createServer();
  const server = app.listen(config.port, () => {
    console.log("问卷系统已启动：http://localhost:" + config.port);
    const lanAddress = getLanAddress();
    if (lanAddress) {
      console.log("局域网访问：http://" + lanAddress + ":" + config.port);
    }
  });

  async function shutdown() {
    server.close(async () => {
      await client.close();
      process.exit(0);
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (require.main === module) {
  start().catch((error) => {
    console.error("启动失败：", error.message);
    process.exit(1);
  });
}

module.exports = { createServer };
