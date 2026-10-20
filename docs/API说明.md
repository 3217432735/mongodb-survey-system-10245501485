# API 说明

## 1. 基本约定

- 接口前缀：`/api`
- 请求和响应格式：JSON
- 登录状态：session cookie，名字为 `connect.sid`
- 未登录访问需要登录的接口，返回 `401 {"error":"请先登录"}`
- 参数错误返回 `400`，无权访问返回 `404`，状态冲突返回 `409`

## 2. 账号接口

| 方法 | 路径 | 登录 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/app-info` | 否 | 获取当前可分享的问卷地址前缀 |
| POST | `/api/auth/register` | 否 | 注册并自动登录 |
| POST | `/api/auth/login` | 否 | 登录 |
| POST | `/api/auth/logout` | 是 | 退出 |
| GET | `/api/auth/me` | 否 | 获取当前用户，未登录返回 null |

注册请求：

```json
{
  "username": "xiaoming",
  "password": "123456"
}
```

注册成功返回 201：

```json
{
  "user": {
    "id": "66f000000000000000000002",
    "username": "xiaoming",
    "created_at": "2026-10-18T02:00:00.000Z"
  }
}
```

登录失败统一返回“用户名或密码错误”，不区分是用户名不存在还是密码错。

`/api/app-info` 用于生成问卷公开链接。电脑通过 `localhost` 访问时，它会返回局域网地址，
例如：

```json
{
  "share_origin": "http://192.168.3.13:3000"
}
```

如果通过公网隧道或域名访问，则返回对应域名。也可以在环境变量里设置 `PUBLIC_ORIGIN`
强制使用固定地址。

## 3. 问卷管理接口

以下接口都需要登录，并且只能操作自己的问卷。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/surveys` | 当前用户的问卷列表，带答卷数 |
| POST | `/api/surveys` | 新建问卷 |
| GET | `/api/surveys/:id` | 问卷详情和题目列表 |
| PATCH | `/api/surveys/:id` | 修改草稿的基本信息 |
| POST | `/api/surveys/:id/publish` | 发布 |
| POST | `/api/surveys/:id/close` | 关闭 |
| DELETE | `/api/surveys/:id` | 删除草稿 |
| GET | `/api/surveys/:id/stats` | 统计结果 |

新建问卷请求：

```json
{
  "title": "校园生活小调查",
  "description": "大概两分钟。",
  "allow_anonymous": true,
  "allow_multiple": true,
  "deadline": "2026-11-02T10:00:00.000Z"
}
```

返回 201，`survey.public_id` 是公开链接编号。

问卷列表返回中的一项：

```json
{
  "id": "66f100000000000000000001",
  "public_id": "campus26",
  "title": "校园生活小调查",
  "status": "published",
  "deadline": "2026-11-02T02:37:00.000Z",
  "allow_anonymous": true,
  "allow_multiple": true,
  "question_count": 6,
  "response_count": 7,
  "created_at": "2026-10-12T02:00:00.000Z"
}
```

## 4. 题目接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/surveys/:id/questions` | 添加题目 |
| PATCH | `/api/surveys/:id/questions/:questionId` | 修改题目 |
| DELETE | `/api/surveys/:id/questions/:questionId` | 删除最后一题 |

只有草稿状态可以添加、修改和删除题目。

单选题请求：

```json
{
  "title": "你平时主要在哪里吃饭？",
  "type": "single",
  "required": true,
  "options": ["食堂", "外卖", "自己做"],
  "jump_rules": [
    { "condition": { "option": "A" }, "target_order": 4 },
    { "condition": { "option": "B" }, "target_order": 2 }
  ]
}
```

多选题请求：

```json
{
  "title": "你喜欢哪些校园活动？",
  "type": "multiple",
  "required": true,
  "options": ["运动会", "讲座", "社团活动", "志愿活动"],
  "min_choices": 2,
  "max_choices": 3,
  "jump_rules": [
    { "condition": { "option": "D" }, "target_order": 6 }
  ]
}
```

文本题请求：

```json
{
  "title": "说说你的建议",
  "type": "text",
  "required": false,
  "min_length": 5,
  "max_length": 100
}
```

数字题请求：

```json
{
  "title": "你平均每天运动多少分钟？",
  "type": "number",
  "required": true,
  "min_value": 0,
  "max_value": 300,
  "integer_only": true,
  "jump_rules": [
    { "condition": { "op": "gte", "value": 30 }, "target_order": 6 }
  ]
}
```

跳转目标必须大于当前题号，且不能超过题目总数。修改题目时要传完整字段，不是只传改动的字段。

## 5. 填写接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/fill/:publicId` | 获取可填写的问卷 |
| POST | `/api/fill/:publicId` | 提交答卷 |
| GET | `/survey/:publicId` | 浏览器公开链接，跳转到填写页 |

获取问卷只返回公开内容：

```json
{
  "survey": {
    "public_id": "campus26",
    "title": "校园生活小调查",
    "description": "大概两分钟。",
    "allow_anonymous": true,
    "allow_multiple": true,
    "deadline": "2026-11-02T02:37:00.000Z"
  },
  "already_submitted": false,
  "questions": [
    {
      "id": "66f200000000000000000101",
      "order": 1,
      "type": "single",
      "title": "你平时主要在哪里吃饭？",
      "required": true,
      "options": [
        { "key": "A", "text": "食堂" },
        { "key": "B", "text": "外卖" },
        { "key": "C", "text": "自己做" }
      ],
      "jump_rules": [
        { "condition": { "option": "A", "match": "any" }, "target_order": 4 }
      ]
    }
  ]
}
```

提交请求：

```json
{
  "anonymous": true,
  "answers": [
    { "question_order": 1, "value": "A" },
    { "question_order": 4, "value": 20 },
    { "question_order": 6, "value": 8 }
  ]
}
```

提交成功返回 201：

```json
{
  "ok": true,
  "response_id": "66f300000000000000000001",
  "message": "已匿名提交"
}
```

提交时后端会重新根据答案计算路径，只校验和保存路径上的题目。跳过的题目即使前端误传了答案也会被忽略。

## 6. 统计接口

`GET /api/surveys/:id/stats` 只允许问卷创建者访问。

返回结构：

```json
{
  "survey": {
    "id": "66f100000000000000000001",
    "title": "校园生活小调查",
    "status": "published",
    "public_id": "campus26"
  },
  "total_responses": 7,
  "questions": [
    {
      "id": "66f200000000000000000101",
      "order": 1,
      "title": "你平时主要在哪里吃饭？",
      "type": "single",
      "answered_count": 7,
      "options": [
        { "key": "A", "text": "食堂", "count": 3, "percent": 42.9 },
        { "key": "B", "text": "外卖", "count": 3, "percent": 42.9 },
        { "key": "C", "text": "自己做", "count": 1, "percent": 14.3 }
      ]
    },
    {
      "id": "66f200000000000000000104",
      "order": 4,
      "title": "你平均每天运动多少分钟？",
      "type": "number",
      "answered_count": 6,
      "average": 37.5,
      "min": 20,
      "max": 60
    }
  ]
}
```

单选题用 `$group` 按答案分组；多选题先展开 answers，再展开 value 数组；数字题用 `$avg`、`$min`、`$max`；文本题返回填写内容和提交时间。

## 7. 常见错误

| 状态码 | 示例 | 原因 |
| --- | --- | --- |
| 400 | 请填写有效的数字 | 答案校验不通过 |
| 401 | 请先登录 | 没有登录 |
| 403 | 问卷已经关闭 | 问卷关闭或截止 |
| 404 | 问卷不存在或无权访问 | 编号错误或不是自己的问卷 |
| 409 | 你已经填写过这份问卷 | 限填一次 |
| 500 | 服务器内部错误 | 未处理的异常 |

