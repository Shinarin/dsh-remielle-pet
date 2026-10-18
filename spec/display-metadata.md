# Spec: 插件展示元数据（display-metadata）

> 依据：DSH 官方 `cordis-plugin-development` skill 的「Display metadata and icon」检查清单、
> 官方 `plugin-market-index` 展示字段规则，以及 DSH 官方 CONTRIBUTING 的插件生态约定。
> 本 spec 只描述仓库/包对外的展示信息，不改变运行时的状态检测与交互行为。

## 1. 产品规则

1. **可发现**：仓库必须带有 GitHub 话题 `dsh-plugin`（DSH 官方 CONTRIBUTING 要求），
   并辅以 `dsh`、`deepseek-harness`、`cordis`、`desktop-pet` 等描述性话题，便于生态检索。
2. **可展示**：作为包根插件，DSH 插件管理页/设置页应显示：
   - `meta.title`：插件标题（英文 `Remielle Pet`，中文 `蕾米埃尔桌宠`）；
   - `meta.description`：一句话能力描述；
   - 插件图标：使用 `icon.png`（256×256，透明底，源自仓库内置 idle GIF 首帧）。
3. **可发布**：`package.json` 必须声明官方要求的展示字段，使官方插件市场索引生成器
   （`apps/plugin-market-generator`）可以读取：
   - `description`、`author`、`homepage`、`repository`、`bugs`、`keywords`；
   - `dsh.bundle.patch` 指向的 `cordis.patch.yml` 与包内版本标签 `vX.Y.Z` 对齐；
   - `exports` 暴露 `./locale/*.json` 与 `./icon`，`files` 包含所有运行时与展示资源。
4. **本地化**：`locale/en.json` 为必需（格式要求 `en`）；`locale/zh.json` 提供中文标题/描述，
   与 README 的中文定位一致。
5. **许可证**：仓库根目录提供 `LICENSE`（MIT），与 `package.json` 的 `license` 字段及
   README 的许可证说明一致。
6. **社区规范**：提供 Issue/PR 模板、贡献指南与 CI（`npm test` / `npm run check`），
   降低反馈成本并保证改动的可验证性。

## 2. 状态所有者

- **展示文案**：`locale/en.json`、`locale/zh.json` 是唯一所有者；不得在 `package.json`
  写第二份标题/描述（`description` 仅作为缺少 locale 时的回退，保持与 locale 语义一致）。
- **图标**：`icon.png` 是唯一文件；`package.json` 的 `exports["./icon"]` 指向它。
- **包元数据**：`package.json` 是 `author` / `homepage` / `repository` / `bugs` /
  `keywords` / `exports` / `files` 的唯一所有者。
- **版本一致性**：`package.json` 的 `version` 与 Git 标签 `vX.Y.Z`、GitHub Release 对齐；
  版本发布由维护者执行，CI 不修改版本。
- **仓库话题 / 描述**：GitHub 仓库设置（About）是唯一所有者，与 README 首段语义一致。

## 3. 接口

- `package.json`
  - `exports`：`"."`、`"./client"`、`"./package.json"`、`"./locale/*.json"`、`"./icon"`。
  - `files`：`lib`、`client.js`、`cordis.patch.yml`、`default-gifs`、`locale`、`icon.png`、
    `README.md`、`LICENSE`。
  - `dsh.bundle.patch`：`./cordis.patch.yml`。
- `locale/en.json`、`locale/zh.json`
  ```json
  { "meta": { "title": "...", "description": "..." } }
  ```
- `icon.png`：PNG，256×256，≤ 256 KiB，位于包根目录。
- `LICENSE`：MIT 文本。
- 仓库 GitHub 设置：topics 含 `dsh-plugin`；description 与 README 首段一致。

## 4. 失败语义

- locale 文件缺失或 JSON 非法：DSH 回退到 `package.json` 的 `name` / `description`，
  并产生诊断信息；插件仍可加载。`test/display.test.mjs` 必须拦截该回归。
- 图标缺失或超过 256 KiB：DSH 使用面板默认图标；测试同样拦截。
- `files` 遗漏资源：仅影响 npm tarball 发布，不影响本地 link 安装；测试校验清单完整性。
- 图标/文案属于展示信息，任何问题都不得影响插件运行时与身份契约。

## 5. 验收场景

1. `npm test` 全绿：展示元数据断言（locale 中英文、icon 尺寸/字节上限、exports/files、
   author/homepage/repository/bugs/keywords）与既有的身份/路由/配置迁移断言同时通过。
2. `npm run check` 通过：`client.js`、`lib/index.js` 语法检查无误。
3. 在 DSH 插件管理页/设置页中，插件行显示「蕾米埃尔桌宠 / Remielle Pet」与自定义图标，
   不出现展示元数据诊断；英文环境显示 `Remielle Pet`。
4. 使用官方 `plugin-market-generator` 从本仓库生成索引时，条目包含
   `author`、`homepage`、`repository`、`description`、`keywords`、`icon` 与 `v1.1.x` 版本。
5. GitHub 仓库 About：话题包含 `dsh-plugin`，描述与 README 首段一致。
6. `LICENSE` 存在且为 MIT，README 的 License 段落与之一致。
