# Agent Toolbox 2

**一个围绕研究任务组织的桌面工作区。**

React + TypeScript 界面、独立 Node.js 工作区服务、Electron 桌面外壳。当前版本为 Windows 科研工作台预览；先验证布局和交互，再逐步迁移旧工具箱能力。

![科研工作台](docs/screenshots/workspace-dark.png)

## 当前可以体验

- 多资料库：按领域、交叉方向或研究问题组织论文。
- 联网检索：通过 OpenAlex 获取题录、摘要、主题及引用记录，按发表日期从新到旧排列，排除未来出版日期。
- 两种视图：表格比较文献；关系图支持拖动节点、平移和缩放。实线来自题录中的引用记录，虚线来自主题词重合。
- 阅读记录：点击次数从绿逐渐转红；收藏、未读／阅读中／已读状态、自动保存的阅读笔记。
- 工作区交互：可折叠侧栏、可调整宽度的详情面板、深浅主题、Ctrl K 检索、Markdown 阅读清单导出。

首次启动内置 8 篇 **明确标注的示例文献**，便于离线体验。示例集不是最新论文榜单，引用次数也不作演示性估算；点击检索后显示实际数据源返回的记录。

额度中枢和绘图同步目前仅标记为后续模块，未接入原账号、旧字体、API Key 或 iPad 配对。预览版不代表完整工具箱迁移已完成。

![论文关系图](docs/screenshots/graph-dark.png)

## Windows 直接打开

本地构建输出：`release/Agent-Toolbox-2-Preview-0.1.0-win-x64.exe`。

这是便携式桌面程序，双击即可打开；使用者无需额外安装 Node.js。GitHub Actions 的 Windows 构建会上传 EXE 到工作流 artifacts。源码仓库不存放打包后的大体积二进制。

数据单独保存在 `%APPDATA%/AgentToolbox2Preview/workspace.json`。关闭并重开程序后，资料库、笔记、点击次数和界面偏好会恢复。便携式 EXE 使用独立的用户数据目录，不会把笔记写回程序文件。

## 开发与构建

需要 Node.js 24 和 npm。

```sh
npm ci
npm run dev        # Vite + Electron 开发预览
npm run build      # TypeScript 检查、前端构建、后台编译
npm test           # 独立目录中的后台集成测试
npm run test:ui    # 原生 Electron 页面检查，使用临时工作区
npm run dist:win   # Windows x64 便携 EXE
```

`npm run test:ui` 会用示例内容生成 README 中的截图，不读取个人资料库。后台测试使用临时目录，验证认证、状态持久化、检索失败保留数据及恢复备份。

## 项目结构

```text
src/          React 工作台、表格、图谱与详情面板
shared/       UI 与后台共享的类型定义
backend/      Node HTTP 服务、题录检索、独立文件存储
electron/     窗口、受限 preload 桥接、后台进程生命周期
scripts/      构建、开发与页面检查
test/         后台集成测试
```

前端通过有限的 preload 方法调用应用功能，不直接访问文件系统。Node 服务仅绑定本机随机端口，并使用每次启动重新生成的令牌；令牌不暴露给页面。窗口与文献数据服务分离，为后续替换桌面外壳保留边界。

联网检索取决于 OpenAlex 的收录、网络和服务限流；出版时间用于排序，不等同于论文质量或创新性判断。检索失败时保留上次文献，数据源缺失的摘要会如实显示为未提供。
