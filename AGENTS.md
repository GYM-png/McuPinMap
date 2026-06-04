# AGENTS.md

本文件是 McuPinFunc 项目给 Codex/子代理使用的协作规范。后续自动化修改、审查、调试和提交都应优先遵守这里的约定。

## 项目定位

McuPinFunc 是一个 VS Code 插件，用于查询 MCU GPIO Alternate Function，并辅助规划引脚功能分配。

产品方向：
- Pin Map 优先。
- 先逻辑视图，后真实封装视图。
- VSIX 不应随包发布芯片 CSV 数据，插件保持轻量。
- 官方维护的芯片 CSV 源数据放在外部 GitHub 数据仓库，普通用户通过插件按需下载目标芯片数据。
- 用户也可以导入本地 CSV；导入流程必须复用同一套校验、解析和归一化逻辑。
- 数据包需要可扩展、可校验、可独立于插件版本更新。
- 当前支持 LQFP 和 BGA pinout 数据。

核心能力：
- 选择芯片。
- 查询某个 IO 支持哪些功能。
- 搜索某个外设功能可用在哪些 IO。
- 逻辑 Pin Map 按 GPIO port 分组展示。
- 分配 alternate function。
- 检测同 pin 占用和同外设信号重复分配冲突。
- 导出 JSON / Markdown。

## 技术栈

运行与语言：
- TypeScript。
- Node.js / npm。
- VS Code Extension API。

扩展端：
- Extension Host 负责 VS Code 命令、Webview 创建、数据加载、持久化和导出。
- 入口为 `src/extension/extension.ts`。
- 编译输出为 `dist/extension/extension.js`。

Webview：
- React。
- Vite。
- Zustand。
- CSS。
- Webview 源码位于 `src/webview/`。

共享逻辑：
- `src/shared/` 存放纯 TypeScript 逻辑。
- CSV 校验、CSV 解析、数据归一化、索引、搜索、冲突检测、assignment 操作都应优先放在 `src/shared/`，便于 Vitest 单测覆盖。

数据处理：
- `csv-parse` 解析 CSV。
- 搜索逻辑使用 `src/shared/` 中的索引与匹配规则。
- `scripts/validate-data-pack.ts` 校验 CSV 数据源；默认仍可用于仓库内 legacy/dev/test fixture，后续应支持外部数据根目录。
- `scripts/build-data-pack.ts` 将 CSV 数据生成运行时 JSON；后续 remote-data 构建应输出到外部数据仓库。

测试：
- Vitest。
- 测试文件位于 `test/`。
- Extension Host 人工调试通过 `.vscode/launch.json`。

## 目录规范

主要目录：

```text
data/chips/                 legacy/dev/test fixture 数据；不再作为发布内置数据源
generated/chips/            本地构建生成的运行时 chip JSON，不提交、不打包
external-data/mcupinfunc-data/
                            外部数据仓库的本地 checkout；不提交到主仓库
scripts/                    数据校验和构建脚本
src/extension/              VS Code Extension Host
src/shared/                 可单测的共享核心逻辑
src/webview/                React Webview
test/                       Vitest 测试
docs/superpowers/           设计文档和实施计划
```

不要提交：
- `node_modules/`
- `dist/`
- `data/`
- `generated/`
- `external-data/`
- `.vscode-test/`
- `*.vsix`

本地工具目录：
- `.codegraph/` 和 `.cursor/` 可能由本地工具生成。除非用户明确要求，不要提交、删除或修改。

## 数据包规范

目标发布架构：
- VSIX 不发布 `data/**`、`generated/**` 或 `external-data/**`。
- 所有 curated chip CSV 源数据维护在外部 GitHub 数据仓库 `GYM-png/mcupinfunc-data`。
- 主仓库中的本地 checkout 路径为 `external-data/mcupinfunc-data/`，该目录必须被 `.gitignore` 忽略。
- 运行时芯片数据计划按用户选择下载，并缓存到 VS Code `ExtensionContext.globalStorageUri` 下。
- 用户导入本地 CSV 时，仍必须通过共享 validator/parser/normalizer 后再写入本地芯片库。
- `data/chips/` 如保留在本仓库，只能作为 legacy/dev/test fixture 数据，不能作为发布内置数据源，不能被 VSIX 打包。
- 运行时应通过本地用户芯片库、远程下载或本地 CSV 导入获取芯片数据；不要重新引入对扩展安装目录内置数据文件的发布依赖。

芯片数据路径：

```text
external-data/mcupinfunc-data/chips/<vendor>/<family>/<part-number>/source/
```

示例：

```text
external-data/mcupinfunc-data/chips/gigadevice/gd32f4/gd32f407/source/
```

GPIO AF CSV 命名：

```text
<PART_NUMBER>_GPIO_AF.csv
```

示例：

```text
GD32F407_GPIO_AF.csv
```

LQFP pinout CSV 命名：

```text
<PART_NUMBER>_<PACKAGE>_PINOUT.csv
```

示例：

```text
GD32F407_LQFP100_PINOUT.csv
GD32F407_LQFP144_PINOUT.csv
```

BGA pinout CSV 命名：

```text
<PART_NUMBER>_<PACKAGE>_PINOUT.csv
```

示例：

```text
GD32F470_BGA100_PINOUT.csv
GD32F470_BGA176_PINOUT.csv
```

Manifest：
- 旧 fixture manifest 文件为 `data/chips/manifest.json`，只用于 legacy/dev/test 场景。
- 外部数据仓库的远程索引计划使用仓库根目录的 `index.json`。
- 新增芯片必须同步更新对应数据仓库索引或可生成索引的源信息。
- 新增 package pinout CSV 必须添加到对应 chip 的 `packages` 列表。
- `packages[].name` 支持 `LQFP<number>` 和 `BGA<number>`。
- 索引或 manifest 引用的文件必须存在，并能通过对应数据校验命令。

GPIO AF CSV 格式：

```csv
PinName,AF0,AF1,AF2,AF3,AF4,AF5,AF6,AF7,AF8,AF9,AF10,AF11,AF12,AF13,AF14,AF15
```

规则：
- 第一列必须为 `PinName`。
- `AF0` 到 `AF15` 必须完整且顺序固定。
- 同一单元格多个功能用 `/` 分隔。
- 不允许重复 `PinName`。

LQFP pinout CSV 格式：

```csv
PadNumber,PinName,PinType
```

规则：
- `PadNumber` 必须覆盖 `1..totalPads`。
- `PadNumber` 不允许重复。
- `PinName` 必填。
- `PinType` 必填。
- `PinType` 只允许：`gpio`、`power`、`ground`、`reset`、`clock`、`boot`、`nc`。
- 不使用 `Side` / `Position` 字段。LQFP 后续渲染时应由 pad number 和 total pads 推导边与位置。

BGA pinout CSV 格式：

```csv
BallName,PinName,PinType
```

规则：
- `BallName` 必须使用 BGA 球位名称，例如 `A1`、`B12`、`AA10`。
- `BallName` 不允许重复。
- `PinName` 必填。
- `PinType` 必填。
- `PinType` 只允许：`gpio`、`power`、`ground`、`reset`、`clock`、`boot`、`nc`。

## 生成数据规范

当前 legacy/dev/test fixture 构建命令：

```powershell
npm run build:data
```

生成：

```text
generated/chips/<chip-id-lowercase>.json
```

当前示例：

```text
generated/chips/gd32f407.json
```

生成数据应包含：
- `Chip.id`
- `Chip.displayName`
- `Chip.vendor`
- `Chip.family`
- `Chip.pins`
- `Chip.packages`

LQFP package layout 规则：
- `packageName` 来自 manifest 的 package name。
- `packageType` 固定为 `LQFP`。
- `totalPads` 从 `LQFP<number>` 推导。
- `orientation` 默认为 `pin1-top-left`。
- `pins` 按 `padNumber` 升序排列。

BGA package layout 规则：
- `packageName` 来自索引或 manifest 的 package name。
- `packageType` 固定为 `BGA`。
- `pins` 使用 `ballName` 表示球位，渲染时由球位名称推导矩阵行列。

计划中的 remote-data 构建：
- `npm run validate:remote-data`：校验 `external-data/mcupinfunc-data/` 下的数据源。
- `npm run build:remote-data`：生成外部数据仓库的 per-chip `chip.json` 和根 `index.json`。
- `npm run build:extension-only`：只构建 extension/webview，不依赖内置芯片数据。
- 以上命令在对应实现任务完成前只是计划目标，不应在当前代码尚未提供脚本时写入自动化流程。

## 开发命令

安装依赖：

```powershell
npm install
```

运行单测：

```powershell
npm test
```

校验 legacy/dev/test fixture 数据包：

```powershell
npm run validate:data
```

生成 legacy/dev/test fixture 数据：

```powershell
npm run build:data
```

当前完整构建：

```powershell
npm run build
```

当前完整构建会依次执行：
- `validate:data`
- `build:data`
- `build:extension`
- `build:webview`

轻量 VSIX / 远程数据架构命令：
- `npm run build:extension-only`：只构建插件，不构建或读取内置数据。
- `npm run validate:remote-data`：校验外部数据仓库。
- `npm run build:remote-data`：生成外部数据仓库的远程索引和 chip JSON。
- `npm run package:light`：打包不含 chip CSV/JSON 数据的 VSIX。

## VS Code 插件调试规范

调试配置位于：

```text
.vscode/launch.json
.vscode/tasks.json
```

可用调试入口：
- `Run Extension`：启动 Extension Development Host。
- `Run Extension and Open Pin Map`：启动 Extension Development Host，并尝试自动执行 `mcupinfunc.openPinMap`。

推荐手动测试流程：
1. 打开项目根目录。
2. 在 Run and Debug 面板选择 `Run Extension and Open Pin Map`。
3. 按 `F5`。
4. 等待 `npm run build` 完成。
5. 在 Extension Development Host 中确认 Pin Map 打开。

如果自动命令未打开面板：
- 在 Extension Development Host 中按 `Ctrl+Shift+P`。
- 执行 `McuPinFunc: Open Pin Map`。

## 编码规范

TypeScript：
- 保持 `strict` 兼容。
- 优先使用显式 domain type，避免使用 `any`。
- 新增核心逻辑时优先放入 `src/shared/` 并写单测。
- Extension Host 代码只处理 VS Code 集成，不承载复杂业务逻辑。
- Webview 组件只处理展示和用户交互，不重复实现数据规则。

React：
- 保持现有 React + Zustand 模式。
- 不引入新的 UI 框架，除非用户明确要求。
- Pin Map 优先；逻辑 Pin Map 和封装视图都应沿用现有交互模型，不做无关的大规模重构。

CSV / 数据：
- 校验器应尽早发现错误。
- 解析器也应具备防御性，不要静默生成脏数据。
- 新增 CSV 规则必须配套测试。
- 新增 curated CSV 源数据应进入外部数据仓库，不应提交到主仓库 `data/`。
- VSIX 打包必须排除 `data/**`、`generated/**` 和 `external-data/**`。

样式：
- 维护现有 Webview 视觉风格。
- 不做无关的大规模 UI 重构。

## 测试规范

新增或修改以下逻辑时必须加测试：
- CSV validator。
- CSV parser。
- manifest 规则。
- data pack build。
- search index。
- assignment store。
- conflict engine。
- export renderer。

推荐验证顺序：

```powershell
npm test
npm run build
```

数据变更至少运行：

```powershell
npm run validate:data
npm run build:data
```

远程数据架构实现完成后，外部数据仓库变更至少运行计划命令：

```powershell
npm run validate:remote-data
npm run build:remote-data
```

轻量插件打包相关变更至少验证计划命令：

```powershell
npm run build:extension-only
npm run package:light
```

在这些脚本实现前，不要把上述计划命令作为当前必过验证项。

调试配置变更至少验证：

```powershell
node -e "JSON.parse(require('fs').readFileSync('.vscode/launch.json','utf8')); JSON.parse(require('fs').readFileSync('.vscode/tasks.json','utf8'))"
npm run build
```

## Git 规范

提交风格：
- 使用简短、明确的英文提交信息。
- 推荐 Conventional Commits 风格：
  - `feat: ...`
  - `fix: ...`
  - `docs: ...`
  - `test: ...`
  - `chore: ...`

提交原则：
- 每个提交聚焦一个目的。
- 不把无关本地工具文件混入提交。
- 不提交构建产物：`dist/`、`generated/`。
- 不提交依赖目录：`node_modules/`。
- 不提交本地主仓库数据 checkout：`external-data/`。
- 不提交发布用大体量 curated CSV 数据到主仓库 `data/`；应提交到外部数据仓库。
- 修改数据包时，同步提交 manifest、CSV、校验/解析逻辑和测试。
- 修改 VS Code 调试体验时，同步提交 `.vscode/launch.json` / `.vscode/tasks.json`。

工作区规则：
- 提交前运行 `git status --short`。
- 提交前确认只 stage 当前任务相关文件。
- 不要执行 `git reset --hard`、`git checkout --` 等会丢失用户改动的命令，除非用户明确要求。
- 遇到未跟踪的 `.codegraph/`、`.cursor/`，默认视为本地工具状态，忽略即可。

## Codex / 子代理协作规范

执行复杂实现计划时使用 Subagent-Driven Development：
1. 实现代理完成单个任务。
2. 规格复核代理检查是否满足需求。
3. 质量复核代理检查鲁棒性、边界和测试。
4. 有问题则修复并复核。
5. 通过后再进入下一个任务。

不要跳过：
- 数据校验。
- 单测。
- 构建验证。
- 复核中的修复闭环。

完成前必须有当前证据：
- 涉及代码逻辑时，`npm test` 通过。
- 当前内置/fixture 构建路径变更时，`npm run build` 通过。
- 轻量 VSIX / 远程数据架构实现完成后，使用 `npm run build:extension-only` 和对应 remote-data 验证命令。
- `git status --short` 中没有未处理的任务相关改动。

## CodeGraph

如果本地 `.codegraph/` 已初始化，可以优先用 CodeGraph 查询结构性问题，例如符号定义、调用链、影响范围。

如果 `.codegraph/` 不存在：
- 不要因为缺少 CodeGraph 阻塞普通开发。
- 可以使用 `rg`、文件读取和测试作为 fallback。
- 不要提交 `.codegraph/`，除非用户明确要求。
