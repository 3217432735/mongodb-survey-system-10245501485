# AI 使用日志

- 项目：基于 MongoDB 的在线问卷系统
- 姓名：银启行
- 学号：10245501485
- 工具：Codex（GPT-5）
- 记录时间：2026-10-10 至 2026-10-21

> 本日志跟随项目开发规划中的 M0-M7 里程碑，区分用户自主完成的工作与 AI 辅助生成的内容，记录提示要点、AI 输出、缺陷、人工修改代码片段和测试验证结果。

## 1. 实际分工

| 角色 | 实际完成的工作 |
| --- | --- |
| 用户 | 阅读课程作业需求与《开发规划.md》；确定数据库集合拆分方案；设计跳转规则数据结构与匿名答卷判重方案；编写核心业务逻辑；调试 MongoDB 聚合统计；编写接口测试用例；排查缺陷；编写项目报告；验收页面效果；提出修改需求；完成人工回归测试；整理项目文档；发现局域网 localhost 分享链接和并发提交隐患 |
| AI | 生成项目初始代码骨架、路由模板和数据库连接模板；提供部分工具函数与 MongoDB 聚合管道示例；生成前端页面 HTML/JavaScript 初稿；编写测试代码初稿；提供部署建议；根据报错给出修复方向；生成文档初稿；对照开发规划做差距分析 |

## 2. 按开发阶段记录

### 2.1 M0 基础工程与 M1 账号系统

**时间：2026-10-10 14:20**

需求是使用 Node.js、Express 和 MongoDB 搭建问卷系统基础骨架，实现注册、登录和基于 Session 的身份认证。

AI 输出了项目目录模板、MongoDB 连接初始化代码、注册登录路由骨架，并使用 `scrypt` 处理密码、使用 `connect-mongo` 保存 Session。最终数据库连接和索引初始化代码为：

```javascript
const client = new MongoClient(mongoUri);
await client.connect();
const db = client.db(dbName);
await ensureIndexes(db);
```

```javascript
async function ensureIndexes(db) {
  await db.collection("users").createIndex({ username: 1 }, { unique: true });
  await db.collection("surveys").createIndex({ public_id: 1 }, { unique: true });
  await db
    .collection("surveys")
    .createIndex({ owner_id: 1, created_at: -1 });
  await db
    .collection("questions")
    .createIndex({ survey_id: 1, order: 1 }, { unique: true });
  await db
    .collection("responses")
    .createIndex({ survey_id: 1, respondent_key: 1 });
}
```

用户补充了统一异常捕获中间件、环境变量判断、用户集合 `username` 唯一索引、退出登录接口和密码加盐逻辑。密码摘要的实际实现为：

```javascript
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
```

Session 通过 MongoDB 保存，登录保护中间件在未登录时返回 401：

```javascript
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
```

**验证**：可以注册账号，Session 持久化到 MongoDB，未登录访问管理接口返回 401。

用户确定的集合划分如下：

| 集合 | 用途 |
| --- | --- |
| `users` | 用户账号与密码摘要 |
| `surveys` | 问卷基本信息、状态和公开编号 |
| `questions` | 题目、选项、校验参数和跳转规则 |
| `responses` | 提交的答卷 |
| `sessions` | 登录 Session |

题目采用独立 `questions` 集合，通过 `survey_id` 与问卷关联，没有嵌套在 `surveys` 文档中。

### 2.2 M2 问卷管理

**时间：2026-10-10 16:40**

需求包括问卷新建、保存草稿、发布、关闭、公开访问编号、截止时间、匿名和重复填写配置。

AI 输出了问卷 CRUD 路由、公开编号生成函数和基础表单模板。最终公开编号使用 `crypto.randomBytes()` 生成 8 位字符，字符表排除了容易混淆的 `l`、`o`、`0` 和 `1`：

```javascript
function publicId() {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(8);
  let result = "";
  for (const byte of bytes) result += chars[byte % chars.length];
  return result;
}
```

发布接口检查问卷状态、题目数量和截止时间：

```javascript
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
```

问卷状态使用 `draft`、`published` 和 `closed`。发布后题目被锁定；关闭或过期问卷不能继续填写：

```javascript
if (survey.status !== "published") {
  const message =
    survey.status === "closed" ? "问卷已经关闭" : "问卷还没有发布";
  return res.status(403).json({ error: message });
}

if (survey.deadline && survey.deadline.getTime() <= Date.now()) {
  return res.status(403).json({ error: "问卷已经超过截止时间" });
}
```

用户增加了状态枚举校验、发布前题目数量校验、发布后锁定题目和截止时间运行时判断。

**验证**：草稿可编辑；发布后生成独立公开链接；关闭或过期问卷禁止填写；已有答卷仍可统计。

### 2.3 M3 题目编辑与答案校验

**时间：2026-10-10 19:10**

需求是实现单选、多选、文本和数字四类题型，并配置必答、文本长度、数字范围和多选数量限制。

AI 输出了题目增改接口模板、前端题目编辑表单和基础校验函数骨架。项目实际字段统一使用下划线命名：

```text
min_choices
max_choices
exact_choices
min_length
max_length
min_value
max_value
integer_only
```

用户扩展了多选、文本和数字题的完整校验。多选答案先去重，再检查选项合法性、固定数量、最少数量和最多数量：

```javascript
if (question.type === "multiple") {
  if (!Array.isArray(rawValue)) return "多选题答案格式不正确";

  const values = [...new Set(rawValue)];
  const validKeys = question.options.map((item) => item.key);
  if (values.some((value) => !validKeys.includes(value))) {
    return "选项中包含无效内容";
  }

  if (
    question.exact_choices !== null &&
    values.length !== question.exact_choices
  ) {
    return "本题必须选择" + question.exact_choices + "项";
  }
  if (
    question.min_choices !== null &&
    values.length < question.min_choices
  ) {
    return "本题至少选择" + question.min_choices + "项";
  }
  if (
    question.max_choices !== null &&
    values.length > question.max_choices
  ) {
    return "本题最多选择" + question.max_choices + "项";
  }
}
```

文本题按照 `min_length` 和 `max_length` 校验：

```javascript
if (question.type === "text") {
  if (typeof rawValue !== "string") return "答案格式不正确";

  const value = rawValue.trim();
  if (value.length < question.min_length) {
    return "至少需要填写" + question.min_length + "个字";
  }
  if (value.length > question.max_length) {
    return "最多只能填写" + question.max_length + "个字";
  }
}
```

数字题先转换成数值，再检查有限数、整数和上下界：

```javascript
const value = Number(rawValue);
if (!Number.isFinite(value)) return "请填写有效的数字";

if (question.integer_only && !Number.isInteger(value)) {
  return "本题只能填写整数";
}

if (question.min_value !== null && value < question.min_value) {
  return "不能小于" + question.min_value;
}

if (question.max_value !== null && value > question.max_value) {
  return "不能大于" + question.max_value;
}
```

**验证**：四类题目配置保存和回显正常；必答、长度、范围、整数及选择数量不合法时均返回错误。

### 2.4 M4 填写提交与条件跳转

**时间：2026-10-11 10:00**

需求是实现数据驱动的条件跳转，支持单选题、多选题和数字题，并由后端重新计算填写路径，丢弃跳过题目的答案。

AI 最初输出的跳转逻辑只针对单选题写死题号：

```javascript
let next = order + 1;
if (question.type === "single" && answer === "A") {
  next = 4;
}
```

用户将跳转规则改为可配置的 `jump_rules` 数据，实现通用规则匹配：

```javascript
function matchRule(question, rule, answer) {
  if (answer === undefined || answer === null) return false;
  const condition = rule.condition || {};

  if (question.type === "single") {
    return answer === condition.option;
  }

  if (question.type === "multiple") {
    if (!Array.isArray(answer)) return false;
    return answer.includes(condition.option);
  }

  if (question.type === "number") {
    const value = Number(answer);
    if (!Number.isFinite(value)) return false;
    if (condition.op === "eq") return value === condition.value;
    if (condition.op === "ne") return value !== condition.value;
    if (condition.op === "gt") return value > condition.value;
    if (condition.op === "gte") return value >= condition.value;
    if (condition.op === "lt") return value < condition.value;
    if (condition.op === "lte") return value <= condition.value;
    if (condition.op === "between") {
      return value >= condition.value && value <= condition.value2;
    }
  }

  return false;
}
```

未命中规则时按题号顺序继续，命中时返回规则中的 `target_order`：

```javascript
function findNextOrder(question, answer, questionCount) {
  for (const rule of question.jump_rules || []) {
    if (matchRule(question, rule, answer)) return rule.target_order;
  }
  if (question.order < questionCount) return question.order + 1;
  return null;
}
```

后端从第 1 题开始计算实际路径，并使用 `visited` 防止重复访问：

```javascript
function buildPath(questions, answersByOrder) {
  const byOrder = new Map(questions.map((item) => [item.order, item]));
  const path = [];
  const visited = new Set();
  let order = 1;

  while (order && byOrder.has(order) && !visited.has(order)) {
    const question = byOrder.get(order);
    visited.add(order);
    path.push(question);

    const answer = answersByOrder.get(String(order));
    order = findNextOrder(question, answer, questions.length);
  }

  return path;
}
```

提交接口先重算路径，只校验并保存实际经过的题目：

```javascript
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
```

用户移除了单选题硬编码，设计了 `jump_rules` 数据结构，完成后端路径重算，并在返回修改答案时截断后续旧路径。

**验证**：单选题、多选题和数字条件跳转均能保存正确题号；前端篡改请求并提交跳过题答案时，后端不会保存这些答案。

### 2.5 M4/M6 局域网分享链接

**时间：2026-10-11 15:30**

本地演示时完成了登录、编辑、发布、填写、提交和统计流程。将分享链接复制到同一局域网内的手机后，发现手机无法访问问卷。

AI 定位到分享逻辑直接读取浏览器当前地址，本机打开时得到 `http://localhost:3000`，复制到其他设备后仍然指向手机自身。

用户新增 `src/network.js` 和 `GET /api/app-info`，返回可分享的局域网地址：

```javascript
app.get("/api/app-info", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    share_origin: getShareOrigin(req, {
      publicOrigin,
      fallbackPort: config.port
    })
  });
});
```

地址选择逻辑优先使用局域网 IPv4，并降低虚拟网卡优先级：

```javascript
function interfaceScore(name, address) {
  let score = 0;
  if (/vmware|virtualbox|vmnet|vethernet|hyper-v|docker|wsl/i.test(name)) {
    score -= 100;
  }
  if (/wlan|wi-?fi|wireless|ethernet|以太网|无线/i.test(name)) {
    score += 50;
  }
  if (isPrivateIPv4(address)) score += 20;
  if (address.startsWith("169.254.")) score -= 50;
  return score;
}
```

**验证**：手机和电脑处于同一局域网时可以打开分享链接并填写问卷；接口测试确认返回地址不包含 `localhost` 或 `127.0.0.1`。

### 2.6 M5 统计结果

**时间：2026-10-12 09:20**

需求是实现单选题计数、多选题选项次数、文本明细和数字平均值、最小值、最大值；跳转跳过的题目不计入该题回答人数。

AI 最初对完整多选答案数组进行分组，会把选项组合当作统计键：

```javascript
{
  $group: {
    _id: "$answers.value",
    count: { $sum: 1 }
  }
}
```

用户改为先展开答卷中的答案，再展开多选题的答案数组，最后按单个选项统计：

```javascript
const counts = await responses
  .aggregate([
    { $match: { survey_id: survey._id } },
    { $unwind: "$answers" },
    { $match: { "answers.question_id": question._id } },
    { $unwind: "$answers.value" },
    { $group: { _id: "$answers.value", count: { $sum: 1 } } }
  ])
  .toArray();
```

数字题通过 MongoDB 聚合计算平均值、最小值和最大值：

```javascript
{
  $group: {
    _id: null,
    count: { $sum: 1 },
    average: { $avg: "$answers.value" },
    min: { $min: "$answers.value" },
    max: { $max: "$answers.value" }
  }
}
```

统计百分比使用实际回答该题的人数作为分母，不使用问卷总答卷数。

**验证**：13 项接口测试全部通过；统计页面数据与原始答卷一致。

### 2.7 M6 公网部署

**时间：2026-10-15 21:00**

用户希望公网访问系统并进行演示。

AI 说明该项目为全栈项目，包含 Express 后端和 MongoDB，不能只上传静态网页，并给出 Cloudflare Tunnel 临时公网访问方案。

用户启动隧道后验证了公网环境下登录、问卷编辑、条件跳转、填写、提交和统计流程，并将访问要求写入部署说明。

### 2.8 M6 文档与报告

**时间：2026-10-18 20:10**

需求是生成项目报告、AI 使用日志、API 文档和系统说明初稿。

AI 输出了报告大纲、接口文档和系统文档初稿。初稿中数据库设计权衡说明不充分，系统缺陷描述不完整。

用户补充了集合划分、题目存储方式、跳转实现、聚合统计、测试结果和系统不足，并插入实际页面截图。报告补充了以下缺陷：

- 缺少 `survey_versions` 发布版本快照。
- 限填一次采用先查询再插入，存在极端并发重复提交风险。
- 匿名填写仍要求登录。
- 缺少数据库迁移脚本和专门的并发测试。

### 2.9 M0-M7 规划对照

**时间：2026-10-21 11:30**

用户要求对照《开发规划.md》检查当前系统差距，识别待改进点。

AI 对照 M0-M7 逐项比较后给出差距清单：

1. 未实现 `survey_versions` 发布快照集合。
2. 未使用 Mongoose、Zod、Vitest、Supertest 和 Docker Compose。
3. 匿名填写当前仍然需要登录。
4. 缺少并发提交专项测试。
5. 缺少数据库迁移脚本和健康检查接口。

用户记录了全部差距，并明确当前采用“发布后锁定题目编辑”的方式保证已有答卷和题目一致。第二阶段将基于现有结构增量增加版本快照、迁移脚本和兼容测试。

## 3. 与《开发规划》的对照

| 规划项 | 当前状态 | 说明 |
| --- | --- | --- |
| M0 基础工程 | 部分完成 | 可启动并连接 MongoDB；缺少 Docker Compose、独立健康检查、数据库迁移脚本和完整结构化日志 |
| M1 账号系统 | 完成 | 注册、登录、退出、scrypt 密码摘要、MongoDB Session 和用户数据隔离均已实现 |
| M2 问卷管理 | 功能完成，版本快照未实现 | 创建、编辑、发布、关闭、截止时间、匿名、重复填写和分享链接已实现；使用发布后锁定题目保证答卷一致性，没有 `survey_versions` |
| M3 题目编辑 | 完成 | 单选、多选、文本和数字题；必答、长度、范围、整数及数量限制全部生效 |
| M4 填写与提交 | 主流程完成 | 数据驱动跳转、后端路径重算和前后端双重校验已完成；缺少高并发提交压力测试 |
| M5 统计结果 | 完成 | MongoDB 聚合实现选项计数、回答人数、文本明细、数字平均值、最小值和最大值 |
| M6 测试与交付 | 基本完成 | 13 项接口测试通过；报告、API 文档、部署说明和截图齐全；缺少版本兼容测试和并发测试 |
| M7 第二阶段增量改造 | 未开始 | 模块化单体架构支持增量扩展，尚未实现发布快照和数据迁移脚本 |

### 技术栈选择

1. 数据库驱动使用原生 MongoDB Driver，不使用 Mongoose。
2. 前端使用原生 HTML、CSS 和 JavaScript，不使用 EJS 与 Bootstrap。
3. 密码哈希使用 `scrypt`，不使用 bcrypt。
4. 参数校验使用项目内的手写校验函数，不使用 Zod。
5. 测试使用 `node:test`，不使用 Vitest 与 Supertest。
6. 当前没有 Docker Compose 本地启动方案。

## 4. AI 生成内容中的问题与修正

### 4.1 分享链接使用 localhost

初始分享逻辑直接读取浏览器地址，在本机打开时会生成：

```javascript
const shareUrl = location.origin + "/survey/" + publicId;
```

用户改为调用 `/api/app-info` 获取可分享地址：

```javascript
const info = await fetch("/api/app-info").then((response) => response.json());
const shareUrl = info.share_origin + "/survey/" + publicId;
```

局域网和公网环境下分享链接均可正常访问。

### 4.2 缺少发布版本快照

当前项目没有 `survey_versions` 集合，而是通过发布后禁止修改题目来保证题目和答卷一致。该方案可以保护第一阶段已有数据，但不能支持“修改已发布问卷并保留旧版本”的能力。

### 4.3 匿名填写与重复提交限制

当前匿名填写仍然要求登录，只在答卷中隐藏填写人信息。重复填写限制使用用户编号和问卷编号生成 `respondent_key`：

```javascript
function respondentKey(userId, surveyId) {
  return crypto
    .createHmac("sha256", "survey-respondent-key")
    .update(String(userId) + ":" + String(surveyId))
    .digest("hex");
}
```

### 4.4 并发重复提交风险

当前逻辑先查询是否填写过，再插入答卷。两个并发请求可能同时通过查询，因此第二阶段需要为 `{ survey_id, respondent_key }` 增加唯一索引，并将唯一索引冲突转换为 409 响应。

### 4.5 跳转引擎需要数据驱动

AI 初稿只处理单选题硬编码跳转。用户设计 `jump_rules` 规则结构，支持选项和数字条件，并在提交接口中通过 `buildPath` 重新计算路径。

### 4.6 多选题统计管道错误

AI 初稿只对完整答案数组分组。用户增加两次 `$unwind`，先展开答卷答案，再展开多选值数组，使每个选项可以单独计数。

### 4.7 接口测试丢失 Cookie

测试客户端需要保存登录接口返回的 `Set-Cookie`，并在后续请求中发送 `Cookie` 头：

```javascript
const setCookies = response.headers.getSetCookie();
if (setCookies.length) {
  cookie = setCookies.map((item) => item.split(";")[0]).join("; ");
}
```

修正后注册、登录和权限测试可以共用同一个登录会话。

## 5. 实际验证记录

| 验证项 | 实际结果 |
| --- | --- |
| 接口自动化测试 | 2026-10-12 执行 `npm test`，13 项测试全部通过，0 失败 |
| 局域网访问 | 通过 `localhost` 请求 `/api/app-info` 返回 `http://192.168.3.13:3000`；同局域网手机可填写问卷 |
| 公网隧道验证 | Cloudflare 临时公网域名下，登录、编辑问卷、条件跳转、提交答卷和统计均可用 |
| 完整页面流程 | 使用 `demo` 账号新建问卷、编辑题目、配置跳转并发布；使用 `xiaoming` 账号按多条路径填写；统计结果与原始答卷一致 |
| 权限与状态 | 非创建者不能管理问卷；关闭和过期问卷不能继续填写 |
| 数据保存 | 用户、问卷、题目、答卷和 Session 均保存在 MongoDB 中 |

## 6. AI 使用总结

AI 主要帮助生成项目骨架、路由模板、数据库操作样例、前端页面初稿、聚合管道示例、测试初稿和文档初稿。AI 初版主要覆盖主流程，边界条件和业务约束需要继续检查，例如跳转只处理单选题、多选统计管道不正确、测试请求未保存 Cookie。

用户的重点工作是：

1. 依据开发规划确定 MongoDB 集合拆分方案，题目使用独立集合。
2. 设计 `jump_rules` 数据驱动跳转模型，实现后端路径重算。
3. 完善必答、长度、范围、整数和多选数量校验。
4. 修复多选题统计聚合。
5. 设计 `respondent_key`，解决匿名答卷的重复填写限制。
6. 修复 localhost 分享链接，实现局域网地址接口。
7. 编写接口测试并完成页面回归。
8. 识别系统与开发规划的差距，记录 `survey_versions`、迁移脚本和并发约束等第二阶段任务。

## 7. 第二阶段 AI 使用记录

| 时间 | 阶段 | 用户请求 | AI 完成的内容 | 调整与验证 |
| --- | --- | --- | --- | --- |
| 2026-10-29 | 第二阶段需求分析 | 用户提供《大作业一：需求变更.docx》，要求完成第二阶段 | 读取全部 8 项需求，对照第一阶段代码确定题目根、不可变版本和问卷快照方案 | 保留原 `questions` 集合，新增 `question_roots`、`question_versions`，没有推倒重写 |
| 2026-10-29 | 题库与共享 | 实现常用题保存、共享和从题库选题 | 新增题库 API、题目库页面、共享用户名功能和问卷编辑器选题入口 | 被共享用户可以选题，非创建者不能修改原题目根 |
| 2026-10-29 | 版本历史 | 实现修改历史、来源关系和版本恢复 | 每次修改生成新版本，记录 `previous_version_id` 和 `derived_from_version_id`；恢复操作生成新的当前版本 | 测试覆盖 v1、v2、恢复后 v3，旧版本不删除 |
| 2026-10-29 | 问卷隔离 | 保证修改题目不影响已发布问卷 | 问卷继续保存所选版本的题目快照；题库更新只改变当前版本引用 | 测试确认 v2 创建后，引用 v1 的问卷保持原题干和原版本 |
| 2026-10-29 | 使用情况与统计 | 查看题目被哪些问卷使用，并跨问卷统计 | 按 `library_root_id` 查询问卷使用情况；按答卷中的题目快照汇总当前用户多份问卷 | 测试覆盖共享、使用列表、数字题跨问卷平均值和旧功能回归 |
| 2026-10-29 | 兼容迁移 | 不破坏第一阶段数据 | 新增幂等迁移脚本，并在应用启动时自动关联旧题目 | 当前演示数据中的 12 道旧题全部建立题目根和 v1 版本 |
| 2026-10-29 | 测试与文档 | 完成第二阶段提交材料 | 更新系统说明、数据库设计、关键逻辑、API、测试说明和第二阶段实现说明 | `npm test` 共 14 组测试通过，0 失败 |

### 7.1 第二阶段 AI 使用总结

AI 帮助完成需求拆解、数据模型设计、接口和页面初版、迁移逻辑、测试用例及文档整理。
人工核对的重点是：

1. 问卷必须保存版本快照，不能直接引用可变题库文档。
2. 同一题目根下的版本保持题型不变，避免跨版本统计口径混乱。
3. 共享用户可以选题但不能修改原题目。
4. 恢复旧版本应生成新版本，不能删除后续历史。
5. 跨问卷统计只统计当前用户自己的问卷，避免暴露其他用户答卷。
