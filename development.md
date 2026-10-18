# dsh-remielle-pet 开发文档

## 项目概述

DSH 桌宠插件（蕾米埃尔），在 DSH（DeepSeek Harness）界面右下角显示浮动宠物 GIF，跟随会话状态自动切换。

插件身份（包名 / bundle entry id / 客户端模块 id / HTTP 前缀）统一为 `dsh-remielle-pet`，
不得再使用 `dsh-pet` 或 `/pet/*`，详见 `spec/plugin-identity.md`。

## 技术栈

- **服务端**：Node.js ES Module，Cordis 框架
- **客户端**：原生 JavaScript（无构建），React 用于设置面板
- **状态检测**：DOM MutationObserver（不依赖特定后端服务）
- **GIF 服务**：HTTP 静态文件路由

## 目录结构

```
dsh-remielle-pet/
├── package.json          # 插件元数据（包名 dsh-remielle-pet），声明 bundle 和 client 注入
├── cordis.patch.yml      # Cordis 层配置：entry id / name = dsh-remielle-pet
├── lib/
│   └── index.js          # 服务端入口：GIF 路由 + 配置持久化 + 旧配置迁移
├── client.js             # 客户端入口：浮动宠物 UI + 设置面板
├── test/
│   └── identity.test.mjs # 身份一致性、路由命名空间、配置迁移回归测试
├── default-gifs/         # 内置默认 GIF（idle/thinking/answering/approval）
├── docs/
│   └── settings.png      # 设置面板截图
├── spec/                 # 行为规格：state-detection.md、overlay-position.md、plugin-identity.md
├── development.md        # 本文件
├── devlog.md             # 开发日志
└── debug.md              # 坑点记录

以下为本地文件，已加入 .gitignore，不入库不 push：
├── AGENTS.md             # Agent 协作约束
├── handoff/              # Agent 进度交接
├── scripts/              # 早期 WebSocket 探测脚本（与 DSH 无关，仅本地参考）
├── tmp/                  # 临时测试/审计产物
└── temp-test.txt         # 临时测试文件
```

## 核心模块职责

### lib/index.js（服务端）

- 身份常量：`PLUGIN_ID = "dsh-remielle-pet"`，`ROUTE_BASE = /plugins/dsh-remielle-pet`。
- 注册 HTTP 路由（**全部在私有命名空间下，不注册 `/pet/*`**）：
  - `GET /plugins/dsh-remielle-pet/state` — 返回当前状态（始终 idle，客户端自行检测）
  - `GET|POST /plugins/dsh-remielle-pet/config` — 读取/保存用户配置到
    `~/.dsh/plugins/dsh-remielle-pet/config.json`
  - `GET /plugins/dsh-remielle-pet/default-gif/{idle,thinking,answering,approval}` — 提供 GIF 文件
- **配置迁移**：启动时优先读新路径；新路径不存在且旧路径
  `~/.dsh/plugins/dsh-pet/config.json` 存在时，读取旧配置并写入新路径（旧文件保留）。

### client.js（客户端）

主要组件：

| 组件 | 职责 |
|------|------|
| `createPetOverlay()` | 创建固定定位的 DOM 浮层（img + hearts + dot + fallback） |
| `DshStateDetector` | MutationObserver + 轮询，检测 DSH UI 状态 |
| `PetController` | 管理 GIF 渲染、拖动、点击交互、状态切换 |
| `SettingsSection` | React 设置面板，调整大小、开关、GIF 自定义 |

身份相关标识（与包名保持一致，见 `spec/plugin-identity.md`）：

- `window.__ModuleLoader__.load({ id: "dsh-remielle-pet" })`
- `settings.section` 的 `id: "dsh-remielle-pet"`
- `API_BASE = "/plugins/dsh-remielle-pet"`
- `window.__DSH_REMIELLE_PET_CONTROLLER__`
- 自定义事件 `dsh-remielle-pet:*`，DOM id / CSS 动画统一 `dsh-remielle-pet-*` 前缀

### 状态检测逻辑

客户端通过 DOM 观察推断 DSH 会话状态。检测依据为 DSH 前端的真实 DOM 契约
（`data-*` 属性 / `aria-label`，详见 `spec/state-detection.md`）：

| 优先级 | 检测条件 | 状态 |
|-------|---------|------|
| 1 | `[data-approval-key]` / `[data-question-key]` / `[data-plan-review-key]` 任一可见（2 秒粘性） | `approval` |
| 2 | `div[data-streaming]`（文本流式）或 `[data-tool][data-state="running"/"preparing"]`（工具执行）任一可见 | `answering`（设置面板标签「编辑中」） |
| 3 | `[data-chat-running]` 可见（session.running 全程存在）；停止按钮仅作旁证（输入框有草稿时消失） | `thinking` |
| 4 | 以上都不满足 | `idle` |

注意：reasoning（深度思考）流式按产品规则归 `thinking`（排除法命中，无需单独检测）；
纯工具调用的 assistant-step 不渲染 `data-streaming`，必须靠 `[data-tool][data-state]` 检测。
DSH 使用 CSS Modules 哈希类名，停止按钮为纯图标按钮（无文本），
输入框为 Lexical contenteditable——基于类名子串、按钮文本、输入框 disabled
的旧检测方式均不可用（见 `debug.md` 第 8、9 条）。

## 运行与构建

### 本地开发

1. 将仓库克隆到本地任意目录
2. 直接修改代码
3. **完全退出并重启 DSH** 使改动生效

### 安装方式

**方式 1：GitHub 地址（推荐）**
```
dsh plugin add github:Shinarin/dsh-remielle-pet
```
> 包名与仓库名均已改为 `dsh-remielle-pet`；旧地址会被 GitHub 重定向。

**方式 2：本地路径**
```
dsh plugin add <本仓库的本地路径>
```

### 测试

```bash
npm test
```

`test/identity.test.mjs` 锁定：包名 / entry id / 客户端 loader id / 设置分区 id 一致；
宿主只注册 `/plugins/dsh-remielle-pet/*` 路由；旧配置迁移到新路径；POST 配置写入新路径。

### 重启后测试

- 发消息给 AI → 观察 GIF 切换（idle → thinking → answering → idle）
- 触发 approval → 观察 approval.gif
- 单击桌宠 → 爱心飘出
- 拖动桌宠 → 位置保存到 localStorage
- 打开设置 → 调整大小 → 桌宠实时变化

## 关键配置

- `dsh-pet:visible` — localStorage，控制显示/隐藏（历史 key，保留以兼容用户数据）
- `dsh-pet:position` — localStorage，保存拖动位置（历史 key）
- `dsh-pet:config` — localStorage，保存设置（大小、提醒等）（历史 key）
- `dsh-pet:gif:{state}` — localStorage，保存自定义 GIF（base64）（历史 key）
- `~/.dsh/plugins/dsh-remielle-pet/config.json` — 服务端持久化配置（新路径）
- `~/.dsh/plugins/dsh-pet/config.json` — 旧版配置，仅启动时读取一次用于迁移

> localStorage 的 `dsh-pet:*` 前缀是**存储命名空间**，不是插件身份，保留以避免用户数据丢失；
> 插件身份统一使用 `dsh-remielle-pet`（见 `spec/plugin-identity.md`）。

## 注意事项

- 客户端 bundle 通过 `window.__ModuleLoader__.load()` 加载，`id` 必须与包名一致
- `console.error` 用于调试日志（生产环境可见），统一前缀 `[DSH-REMIELLE-PET]`
- GIF 通过 blob URL 预加载，避免 Electron 自定义协议问题
- **不要**把包名 / entry id / loader id / HTTP 前缀改回 `dsh-pet` 或 `/pet`，会与其它桌宠插件冲突
