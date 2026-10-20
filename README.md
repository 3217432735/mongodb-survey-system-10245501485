# 基于 MongoDB 的在线问卷系统

当代数据管理系统大作业一（第一阶段）

姓名：银启行　学号：10245501485

这是一个用 Node.js、Express 和 MongoDB 写的简化版在线问卷系统。主要功能是注册登录、创建问卷、添加题目、发布链接、填写问卷和查看统计。界面是普通的网页，没有使用前端框架。

## 已实现的功能

- 用户注册、登录、退出，密码使用 scrypt 加盐保存
- 每个用户只能看到自己创建的问卷
- 问卷标题、说明、截止时间、匿名设置、重复填写设置
- 单选、多选、文本填空、数字填空四种题型
- 必答、多选最少/最多/必须选择数量、文本长度、数字范围和整数校验
- 根据单选题、多选题、数字题的结果跳转到后面的题目
- 问卷发布、关闭，公开链接 `/survey/:publicId`
- 匿名填写和每人限填一次
- 按题目统计选项次数、回答人数、数字平均值和文本答案
- 接口测试覆盖注册、权限、校验、跳转、提交和统计

## 运行方法

需要先启动 MongoDB。默认连接 `mongodb://127.0.0.1:27017`，数据库名是 `survey_system`。

```powershell
cd survey-mongodb
npm install
npm run seed
npm start
```

打开 <http://localhost:3000>。

管理页里的“填写链接”会自动使用电脑当前的局域网 IP。例如电脑访问 `localhost` 时，
复制出来的链接仍然会是 `http://192.168.x.x:3000/survey/...`，可以直接发给同一局域网内的手机。

演示数据里的账号：

| 账号 | 密码 | 用途 |
| --- | --- | --- |
| demo | demo123 | 查看问卷管理、编辑和统计 |
| xiaoming | 123456 | 填写问卷 |

如果不想用演示数据，跳过 `npm run seed`，直接打开注册页注册一个新账号即可。

环境变量可以写在 `.env` 里，项目没有安装 dotenv，运行时请先在 PowerShell 里设置，或者直接修改 `src/config.js` 的默认值：

```powershell
$env:MONGODB_URI="mongodb://127.0.0.1:27017"
$env:MONGODB_DB="survey_system"
$env:PORT="3000"
# 可选，使用固定公网域名或隧道时设置
$env:PUBLIC_ORIGIN="https://your-domain.example"
```

## 测试

```powershell
npm test
```

测试会自己新建一个带时间戳的测试数据库，跑完后删除，不会改动 `survey_system` 里的数据。

## 目录说明

| 目录或文件 | 说明 |
| --- | --- |
| `app.js` | Express 入口，创建数据库连接、session 和路由 |
| `src/routes/` | 账号、问卷管理、填写三组接口 |
| `src/validation.js` | 题目结构、答案校验 |
| `src/jump.js` | 跳转规则匹配和路径计算 |
| `src/stats.js` | 用聚合管道做统计 |
| `public/` | 登录、问卷列表、编辑、填写、统计页面 |
| `test/api.test.js` | 接口自动测试 |
| `scripts/seed-demo.js` | 写入演示账号和问卷 |
| `scripts/screenshots.js` | 生成报告用的页面截图 |
| `docs/` | 系统说明、数据库设计、API、测试和 AI 使用记录 |
| `report/` | 项目完成报告 |

## 几个实现上的说明

1. 题目单独放在 `questions` 集合里，没有全部塞进 `surveys` 文档。这样添加题目、修改某一题和按题统计都更方便。
2. 跳转规则保存在题目的 `jump_rules` 数组里，没有写死在代码里。前端负责按规则显示下一题，后端提交时会重新算一遍路径。
3. 问卷发布后不能修改题目，保证已经收到的答案还能和原题目对应。
4. 匿名答卷不保存 `respondent_id` 和用户名。如果问卷限制每人填一次，会保存一个由用户编号和问卷编号算出的 HMAC 值，只用来判重，不能直接看出是谁。
5. 统计结果是在查询时用 MongoDB 聚合管道实时计算的，没有另外存一份统计表。
6. `/api/app-info` 会根据当前网络接口生成可分享地址。从 `localhost` 打开时自动替换成局域网 IP；
   从公网隧道打开时保留隧道域名。

## 临时公网访问

本机安装 Cloudflare Tunnel 后，可以运行：

```powershell
cloudflared tunnel --url http://localhost:3000
```

得到的 `https://xxxx.trycloudflare.com` 可以让任意网络中的用户访问。电脑和两个进程必须保持运行。
长期部署到 Render/Railway 和 MongoDB Atlas 的步骤见 `docs/上线部署说明.md`。

## 提交文件

- `report/大作业一第一阶段-项目报告.docx`：项目报告
- `docs/`：系统说明、数据库设计、API 说明、测试用例、AI 使用日志
- 代码：整个 `survey-mongodb` 目录

