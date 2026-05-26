# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
npm start          # 启动服务 (node server.js)
npm run dev        # 开发模式 (同 start)
```

无测试、lint、构建命令。项目为纯 Node.js + 前端原生 JS，无需编译。

## 架构概览

### 异步任务轮询的双模式

整个系统的核心设计：生成任务通过第三方 API 异步处理，轮询可以在前端或后端执行。

- **`progressMode: "true"`** (推荐，所有视频/图片均支持)：后端提交任务后立即返回 `{ taskId }`，前端 `pollGenerationTask()` 每 5 秒轮询 `/api/dashscope-task-status` 或 `/api/volcengine-task-status`。视频无限轮询 (`VIDEO_PROGRESS_MAX_POLL_ATTEMPTS=0`)，图片最多 90 次。
- **后端阻塞轮询** (仅图片)：后端提交后内部循环轮询直到完成，前端等待单个请求返回。超时受 `GENERATION_REQUEST_TIMEOUT_MS` (450s) 控制。

`handleGenerationResult()` (app.js) 是统一入口，根据是否有 `taskId` 自动选择模式。

### 凭证解析链

每个 API 调用的凭证按优先级解析：

1. 前端输入（用户填写的 API Key 或 `AK:SK`）
2. `.env` 环境变量（`DASHSCOPE_API_KEY`, `GEMINI_API_KEY`, `VOLCENGINE_ACCESS_KEY` 等）
3. 兜底：空字符串，后端返回 400

Volcengine 特殊处理：前端以 `AK:SK` 格式输入，`parseVolcengineCredentials()` 解析后用于签名。`getApiKey()` 函数统一处理 DashScope 和 Gemini 的凭证回退。

### Provider 分发模式

路由处理器通过 `provider` 字段 switch，调用 provider 特定函数。没有抽象层或策略模式：

| Provider | 图片生成 | 视频生成 | 状态查询 |
|----------|---------|---------|---------|
| DashScope | 直接调 `fetchWithTimeout` 到阿里云 API | 同左 | `GET /api/v1/tasks/{taskId}` |
| Volcengine | `generateWithVolcengine()` | `jimeng-video` 路由 → taskId 立即返回 | `fetchVolcengineTaskResult()` → HMAC 签名 POST |
| Gemini | `generateWithGemini()` | 不支持 | 同步返回，无需轮询 |

### Volcengine HMAC-SHA256 签名 (`utils.js`)

`volcengineSign()` 实现完整的火山引擎 API 签名流程：
1. `canonicalQuery` — 按字母序排列查询参数
2. `sha256Hex(body)` — body 哈希
3. `credentialScope` — `{shortDate}/{region}/{service}/request`
4. `stringToSign` — `HMAC-SHA256\n{xDate}\n{credentialScope}\n{bodyHash}`
5. 派生签名密钥：`kDate → kRegion → kService → kSigning`
6. 对 `stringToSign` 做 HMAC-SHA256 得到最终签名

`fetchVolcengineTaskResult()` 和 `generateWithVolcengine()` 都依赖此签名方法。

### 上传文件生命周期

1. Multer `memoryStorage` 接收文件
2. `saveUploadedImageAsPublicUrl()` 写入 `public/uploads/`（生成随机文件名保留扩展名）
3. 通过 `PUBLIC_BASE_URL` 或 `buildBaseUrl(req)` 构造公开 HTTP URL
4. 传递给 Volcengine（只接受 HTTP(S) URL，不接受 data: URL）
5. `scheduleUploadedFileCleanup()` 在设置的时间（默认 5 分钟）后自动删除临时文件

### SQLite 任务记录

使用 `node:sqlite` (Node.js 内置，同步 API)。两个表：
- `video_tasks` — 视频生成历史 (主键 `task_id`)
- `image_tasks` — 图片生成历史 (主键 `id`)

只在任务记录和展示时使用，不参与生成流程。`upsert` 语句通过 `COALESCE` 实现非空字段部分更新（不完全覆盖已有数据）。

### 前端状态管理 (app.js)

原生 JavaScript，无框架。状态管理方式：
- **模块级变量**：`foregroundRecoveryNeeded`, `activeTaskContext`, `videoTaskRecords` 等
- **DOM 即状态**：按钮 disabled、select.value、d-none 类名 = UI 状态
- **localStorage**：API Key 缓存、模型选择记忆

关键机制：
- **前台恢复**：`visibilitychange` + `pageshow` 事件 → `recoverForegroundState()` 刷新 UI 状态 → `pollActiveTaskOnce()` 立即查询活跃任务
- **网络容错**：轮询循环中连续 3 次 `TypeError` (fetch failed) 才放弃，间隔 2 秒重试
- **Blob 下载**：`setupDownloadLink()` fetch → blob → createObjectURL → 程序化点击下载，失败降级 `window.open`

### 配置系统 (`config.js`)

单一配置来源。所有常量通过 `process.env` + 默认值定义，包括：
- 超时时间（ms）
- API 端点 URL
- 模型列表和别名映射 (`VOLCENGINE_MODEL_ALIASES`, `VIDEO_MODELS`)
- 同步/异步模型分类 (`SYNC_MODELS`)
- 尺寸白名单 (`ALLOWED_SIZES_BY_MODEL`)

新增模型或 provider 参数时，从 config.js 开始修改。

## 重要约定

- `lib/config.js` 是所有常量和 env 映射的唯一入口，不要在路由或 utils 中硬编码字符串
- `fetchWithTimeout(url, options, timeoutMs)` 是后端 HTTP 请求的唯一出口（内部用 `AbortController` 实现超时）
- 前端 `fetch()` 调用无超时设置，所有超时控制在后端
- Volcengine 图片 URL 必须是公开可访问的 HTTP(S) 地址，不支持 data: URL
- `node:sqlite` 是同步 API，所有数据库操作即时完成
