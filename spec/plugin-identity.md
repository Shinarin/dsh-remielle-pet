# Spec: 插件身份（plugin-identity）

## 1. 产品规则

- 本插件在 DSH 中的所有**身份标识必须全局唯一**，包括：
  1. npm 包名；
  2. Cordis bundle entry id（`cordis.patch.yml` 的 `id` / `name`）；
  3. 客户端 loader id（`window.__ModuleLoader__.load({ id })`）；
  4. 客户端 bundle 路由（由包名推导的 `/plugins/<包名>/client.js`）；
  5. HTTP 路由前缀；
  6. `settings.section` 的槽 id。
- 统一标识为 **`dsh-remielle-pet`**，HTTP 前缀为 **`/plugins/dsh-remielle-pet`**。
- 禁止再占用通用命名：不得使用 `dsh-pet` 作为包名/entry id/loader id，不得注册 `/pet/*` 这类通用路由。
- 持久化兼容：
  - localStorage 继续使用历史 key `dsh-pet:*`（`dsh-pet:position` / `dsh-pet:config` /
    `dsh-pet:visible` / `dsh-pet:gif:*`）。这些 key 承载用户位置、设置与自定义 GIF，
    重命名会造成数据丢失或配额翻倍；它们不是 DSH 身份面，不参与插件冲突。
  - 服务端配置迁移到 `$DSH_HOME/plugins/dsh-remielle-pet/config.json`；旧路径
    `$DSH_HOME/plugins/dsh-pet/config.json` 只读一次用于迁移，旧文件保留。
- 与其他桌宠插件的 UI 重叠（尤其是原生置顶窗口）属于操作系统窗口层限制，不在本 spec 的
  修复范围；由 README 的共存说明告知用户。

## 2. 状态所有者

- **身份常量**由四个文件共同持有，必须一致，并由 `test/identity.test.mjs` 锁定：
  - `package.json`：包名 `dsh-remielle-pet`
  - `cordis.patch.yml`：entry `id` / `name` = `dsh-remielle-pet`
  - `client.js`：loader id、`settings.section` id、`API_BASE`
  - `lib/index.js`：`export const name`、`ROUTE_BASE`、配置路径
- **服务端配置状态**：`lib/index.js` 的 `userConfig` 是唯一内存所有者；新路径是唯一持久化
  目标；旧路径只在启动时读一次。
- **客户端设置状态**：仍由 `client.js` 单写 localStorage，key 不变。
- 不存在第二套缓存或旁路写入。

## 3. 接口

- `GET  /plugins/dsh-remielle-pet/state` — 当前状态（固定 `idle`，客户端自行检测）
- `GET  /plugins/dsh-remielle-pet/config` — 读取配置
- `POST /plugins/dsh-remielle-pet/config` — 保存配置
- `GET  /plugins/dsh-remielle-pet/default-gif/{idle,thinking,answering,approval}` — 内置 GIF
- 不再注册任何 `/pet/*` 路由。
- 模块导出不变：`export const name = "dsh-remielle-pet"`、`export const inject = ["webServer"]`、
  `export function apply(ctx, config)`。
- 客户端导出的 loader id / `exports.name` 均为 `dsh-remielle-pet`；`settings.section` id 为
  `dsh-remielle-pet`。

## 4. 失败语义

- 新配置路径不可写：继续使用内存中的配置，记录 `warn`，不影响插件加载。
- 旧配置存在、新配置不存在：读取旧配置并尝试写新路径；写失败仅 `warn`，不阻塞启动。
- 迁移不删除旧文件，回滚时旧版本仍可读。
- 旧客户端（缓存）请求 `/pet/*` 会得到 404；刷新/重启后客户端随插件更新，恢复正常。

## 5. 验收场景

1. 全新安装：`GET /plugins/dsh-remielle-pet/config` 返回默认值；首次保存时创建
   `plugins/dsh-remielle-pet/config.json`。
2. 仅有旧配置：启动后 `GET /config` 返回旧值；新路径写入相同内容；旧文件保留。
3. 客户端：loader id、`settings.section` id、`API_BASE` 均为新值；不再发起 `/pet/*` 请求。
4. 与另一身份不同的桌宠插件同时启用：两份 bundle entry 共存，启动无
   `duplicate exact route` / `duplicate graph entry` 错误。
5. 用户既有位置、大小、自定义 GIF 在升级后仍生效（localStorage key 未变）。
6. 身份回归：`test/identity.test.mjs` 全绿；源码中不存在活跃的 `dsh-pet` 身份注册
   （仅允许历史存储 key 与迁移路径）。
