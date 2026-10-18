# 参与贡献

感谢关注 **dsh-remielle-pet（蕾米埃尔桌宠）**！Issue、文档修订与代码 PR 都欢迎。

## 反馈问题

- Bug 请使用 [Bug 反馈模板](.github/ISSUE_TEMPLATE/bug_report.yml)，并提供 DSH 版本、运行平台、复现步骤与相关日志。
- 状态检测问题请先过滤控制台日志 `[DSH-REMIELLE-PET]`，再附上触发场景。
- 提交前请先阅读 README 的「常见问题」与 [`debug.md`](debug.md)，避免重复排查。

## 开发环境

- Node.js 22+（本仓库只使用 Node 内置模块，无需安装依赖）。
- 修改行为前先阅读 [`development.md`](development.md)，并按 `spec/` 下的规格文档先更新 spec。
- 本地验证：

  ```bash
  npm run check   # client.js / lib/index.js 语法检查
  npm test        # 身份、路由、配置迁移与展示元数据回归测试
  ```

- 改动插件后需**完全退出并重启 DSH** 才能加载新代码；手动验证清单见 `development.md` 的「重启后测试」。

## 提交规范

- 提交信息使用简洁的英文祈使句，例如 `Fix diagnostics TypeError on startup`。
- 一个 PR 聚焦一件事，不要夹带无关的格式化或依赖升级。
- 行为变更需要同步更新 `spec/`、`README.md` 与 `devlog.md`；发版时再由维护者整理 `CHANGELOG.md`。
- 新增或调整展示元数据（`locale/`、`icon.png`、`package.json` 的 `exports`/`files`）时，请同步更新 `spec/display-metadata.md` 与对应测试。

## 安全

- 不要提交密钥、Token、密码、证书、真实用户数据或内部服务地址。
- 自定义 GIF 仅保存在本机 localStorage，不会上传到任何服务器。

## 许可

提交的代码以仓库的 [MIT 许可证](LICENSE) 发布。
