# AGENTS.md

本文件是 McuPinFunc 项目给 Codex/子代理使用的协作规范。后续自动化修改、审查、调试和提交都应优先遵守这里的约定。

## 项目定位

McuPinFunc 是一个 VS Code 插件，用于查询 MCU GPIO Alternate Function，并辅助规划引脚功能分配。

产品方向：
- Pin Map 优先。
- 先逻辑视图，后真实封装视图。
- CSV 数据内置在插件中，普通用户不需要手动下载或编写 CSV。
- 数据包需要可扩展、可校验、可随插件版本更新。
- 当前支持 LQFP pinout 数据；暂不考虑 BGA。

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
- `Fuse.js` 做搜索。
- `scripts/validate-data-pack.ts` 校验内置数据。
- `scripts/build-data-pack.ts` 将 CSV 数据生成运行时 JSON。

测试：
- Vitest。
- 测试文件位于 `test/`。
- Extension Host 人工调试通过 `.vscode/launch.json`。

## 目录规范

主要目录：

```text
data/chips/                 内置芯片数据源
generated/chips/            构建生成的运行时 chip JSON，不提交
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
- `generated/`
- `.vscode-test/`
- `*.vsix`

本地工具目录：
- `.codegraph/` 和 `.cursor/` 可能由本地工具生成。除非用户明确要求，不要提交、删除或修改。

## 数据包规范

芯片数据路径：

```text
data/chips/<vendor>/<family>/<part-number>/
```

示例：

```text
data/chips/gigadevice/gd32f4/gd32f407/
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

Manifest：
- 文件为 `data/chips/manifest.json`。
- 新增芯片必须添加 manifest 条目。
- 新增 package pinout CSV 必须添加到对应 chip 的 `packages` 列表。
- `packages[].name` 当前只支持 `LQFP<number>`。
- manifest 引用的文件必须存在，并能通过 `npm run validate:data`。

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

## 生成数据规范

运行：

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

## 开发命令

安装依赖：

```powershell
npm install
```

运行单测：

```powershell
npm test
```

校验数据包：

```powershell
npm run validate:data
```

生成数据：

```powershell
npm run build:data
```

完整构建：

```powershell
npm run build
```

完整构建会依次执行：
- `validate:data`
- `build:data`
- `build:extension`
- `build:webview`

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
- 当前 UI 是逻辑 Pin Map，不要擅自改成真实封装图。

CSV / 数据：
- 校验器应尽早发现错误。
- 解析器也应具备防御性，不要静默生成脏数据。
- 新增 CSV 规则必须配套测试。

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
- `npm test` 通过。
- `npm run build` 通过。
- `git status --short` 中没有未处理的任务相关改动。

## CodeGraph

如果本地 `.codegraph/` 已初始化，可以优先用 CodeGraph 查询结构性问题，例如符号定义、调用链、影响范围。

如果 `.codegraph/` 不存在：
- 不要因为缺少 CodeGraph 阻塞普通开发。
- 可以使用 `rg`、文件读取和测试作为 fallback。
- 不要提交 `.codegraph/`，除非用户明确要求。
