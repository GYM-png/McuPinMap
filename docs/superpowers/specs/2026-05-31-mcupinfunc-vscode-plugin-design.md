# McuPinFunc VS Code 插件设计文档

日期：2026-05-31

## 1. 背景与目标

McuPinFunc 的目标是基于类似 `GPIO_AF_CSVs/GD32F407_GPIO_AF.csv` 的 GPIO Alternate Function CSV，做一款面向 MCU 引脚配置的 VS Code 插件。插件默认内置经过规范化和校验的芯片 CSV 数据包，用户安装后即可选择目标芯片查询，不需要自己编写、下载或维护 CSV。用户可以快速查看某个 IO 支持哪些复用功能，也可以从某个外设功能反查可用 IO，并在一个 Pin Map 工作台中进行配置规划和冲突检查。

首版产品定位为“芯片配置型”工具，而不是单纯的 CSV 查询器或代码补全插件。MVP 采用逻辑 Pin Map：按端口 `PA/PB/PC...` 分组展示引脚，先不依赖真实封装脚位顺序。数据模型预留 `package/layout` 扩展，后续优先支持 LQFP 真实封装视图。

## 2. MVP 范围

MVP 必须包含：

- 随插件内置至少一个芯片数据包，例如 `GD32F407_GPIO_AF.csv`。
- 从内置芯片目录加载 GPIO AF CSV，用户无需手动提供 CSV。
- 将 `PinName, AF0...AF15` 宽表标准化为结构化索引。
- 提供芯片选择列表，列表来源于内置数据包 manifest。
- 支持 pin 查询，例如 `PA9` 查出所有 AF 功能。
- 支持功能和外设查询，例如 `USART0_TX`、`USART0` 查出候选引脚。
- 提供 VS Code Webview 的 Pin Map 工作台。
- 逻辑视图按端口分组展示引脚。
- 支持外设筛选、高亮候选引脚。
- 支持点击引脚查看 AF 列表。
- 支持将某个功能分配到某个引脚。
- 检测同一引脚被多个功能占用的冲突。
- 保存当前配置集合。
- 导出配置结果为 JSON 或 Markdown。

MVP 不包含：

- 真实 LQFP 封装图。
- 自动生成完整 GD32 SDK 初始化代码。
- 解析用户 C/C++ 工程并做代码级联动。
- 完整电气规则检查，例如电压域、5V tolerant、默认启动脚限制。
- 跨芯片系列的复杂兼容性迁移。
- 让普通用户手动编写或下载 CSV。工作区自定义 CSV 只作为高级导入能力，不作为主流程。

## 3. 用户体验设计

主界面为 Pin Map 工作台，承载在 VS Code Webview 中。

左侧为控制区：

- 芯片选择，例如 `GD32F407`。
- 搜索框，支持输入 pin、完整功能名、外设名和信号名。
- 视图切换，首版提供 `Logical View`，`Package View` 作为禁用或预告入口。
- 外设分类过滤，例如 USART、SPI/I2S、I2C、TIMER、SDIO、ENET、DCI。
- 当前配置集合，展示已分配的外设信号和冲突状态。

中间为 Pin Map 区：

- 以端口为卡片分组，例如 `Port A`、`Port B`。
- 每个端口中显示对应 pin，例如 `PA0...PA15`。
- pin 使用颜色表达状态：空闲、搜索命中、候选、已分配、冲突。
- 点击 pin 后，右侧详情区显示该 pin 的所有 AF 功能。

右侧为详情和操作区：

- 显示当前选中 pin。
- 展示该 pin 的所有 AF 功能，包含 AF 编号、外设、信号和原始功能名。
- 显示功能可用状态、冲突状态和推荐提示。
- 提供 `Assign`、`Unassign`、`Resolve Conflict`、`Export` 等操作入口。

## 4. 技术栈

插件主体：

- TypeScript。
- VS Code Extension API。
- pnpm 或 npm 作为包管理器。
- esbuild 或 tsup 打包 extension host 代码。

Webview 前端：

- React。
- Vite。
- CSS Grid 与 SVG/CSS 组合绘制逻辑 Pin Map。
- Zustand 或 React reducer 管理 UI 状态。

数据处理：

- Papa Parse 或 csv-parse 解析 CSV。
- 构建期校验内置 CSV，并生成标准 JSON 索引产物。
- 运行期优先读取内置 JSON 索引；仅在高级导入场景解析用户 CSV。
- Fuse.js 或轻量自研搜索索引支持模糊搜索和前缀搜索。

测试：

- Vitest 测试 CSV 解析、索引构建、搜索和冲突规则。
- `@vscode/test-electron` 测试插件命令和 Webview 打开流程。
- Playwright 可作为后续 Webview UI 回归测试工具。

## 5. 数据模型

标准化后的核心实体如下。

```ts
type Chip = {
  id: string;
  displayName: string;
  family?: string;
  pins: Pin[];
  packages?: PackageLayout[];
};

type Pin = {
  name: string;
  port: string;
  number: number;
  functions: PinFunction[];
};

type PinFunction = {
  af: string;
  raw: string;
  peripheral: string;
  signal: string;
  aliases: string[];
};

type PackageLayout = {
  packageName: string;
  packageType: "LQFP";
  totalPads: number;
  orientation?: "pin1-top-left";
  pins: PackagePin[];
};

type PackagePin = {
  pinName: string;
  padNumber: number;
  pinType?: "gpio" | "power" | "ground" | "reset" | "clock" | "boot" | "nc";
};

type Assignment = {
  id: string;
  chipId: string;
  pinName: string;
  functionRaw: string;
  af: string;
  peripheral: string;
  signal: string;
};
```

CSV 解析规则：

- `PinName` 映射为 `Pin.name`。
- `AF0...AF15` 中非空单元格生成 `PinFunction`。
- 单元格中使用 `/` 分隔的多个功能拆分为多个 `PinFunction`，但保留原始单元格内容用于追溯。
- `USART0_TX` 解析为 `peripheral=USART0`、`signal=TX`。
- `TIMER1_CH0` 解析为 `peripheral=TIMER1`、`signal=CH0`。
- 对 `EVENTOUT` 这类无下划线功能，`peripheral` 与 `raw` 相同，`signal` 为空或 `EVENTOUT`。
- 对异常拼写或粘连项保留 `raw`，解析器给出 warning，不阻断加载。

## 6. CSV 数据包规范

内置 CSV 是插件的数据资产，必须有稳定命名、稳定格式和自动校验。

目录结构：

```text
data/
  chips/
    manifest.json
    gigadevice/
      gd32f4/
        gd32f407/
          GD32F407_GPIO_AF.csv
          GD32F407_LQFP144_PINOUT.csv
          GD32F407_LQFP100_PINOUT.csv
        gd32f405/
          GD32F405_GPIO_AF.csv
          GD32F405_LQFP144_PINOUT.csv
```

文件命名规则：

- GPIO AF CSV 文件名使用 `<PART_NUMBER>_GPIO_AF.csv`。
- 封装 pinout CSV 文件名使用 `<PART_NUMBER>_<PACKAGE>_PINOUT.csv`。
- `<PART_NUMBER>` 使用具体芯片型号大写，不包含封装后缀，例如 `GD32F407`、`GD32F405`。
- `<PACKAGE>` 使用封装类型和 pin 数。当前只规划 LQFP，例如 `LQFP144`、`LQFP100`。
- 文件名中的芯片型号必须与 manifest 中的 `id` 一致。
- 不建议只使用 `<SERIES_NAME>_GPIO_AF.csv` 作为主数据文件名，除非已经确认该系列下所有目标芯片的 GPIO AF 完全一致。即使 AF 数据可复用，也应由 manifest 显式声明多个芯片共用同一数据源。
- 目录名使用小写 slug，例如 `gigadevice/gd32f4/gd32f407/`；CSV 文件名保留官方芯片型号大写，便于人工识别。

GPIO AF CSV 格式规则：

- 第一列必须为 `PinName`。
- 后续列必须为 `AF0` 到 `AF15`，列名必须完整且顺序固定。
- 每行表示一个 pin，例如 `PA0`。
- 空单元格表示该 pin 在该 AF 编号下没有功能。
- 同一 AF 单元格中多个功能使用 `/` 分隔，例如 `SPI1_SCK/I2S1_CK`。
- 功能名使用芯片手册命名，保持大写和下划线风格，例如 `USART0_TX`。
- CSV 必须使用 UTF-8 编码。
- CSV 不写注释行；元数据统一写入 `manifest.json`。

LQFP pinout CSV 格式规则：

- 文件用于真实 LQFP 封装图渲染，记录封装脚号与芯片 pin 名的对应关系。
- 第一列必须为 `PadNumber`，表示封装脚号，例如 `1`、`2`、`144`。
- 第二列必须为 `PinName`，表示芯片 pin 名，例如 `PA9`、`VSS`、`VDD`、`NRST`、`BOOT0`、`NC`。
- 可选列 `PinType` 表示 pin 类型，例如 `gpio`、`power`、`ground`、`reset`、`clock`、`boot`、`nc`。
- `Side` 和 `Position` 不作为 MVP 字段。LQFP 的边和边上顺序由 `PadNumber` 和总脚数自动推导。
- pinout CSV 必须包含封装上的所有 pad，不只包含 GPIO。这样渲染真实封装图时可以显示电源、地、复位、时钟和 NC。
- `PinName` 与 GPIO AF CSV 中存在交集即可；非 GPIO pin 不要求出现在 GPIO AF CSV 中。

LQFP pinout CSV 示例：

```csv
PadNumber,PinName,PinType
1,PE2,gpio
2,PE3,gpio
3,VSS,ground
4,VDD,power
5,PA9,gpio
```

LQFP 渲染推导规则：

- 从 manifest 的 package 名称读取总脚数，例如 `LQFP144` 得到 `144`。
- 校验 `PadNumber` 必须覆盖 `1..144`。
- 每条边 pin 数为 `totalPins / 4`，例如 LQFP144 每边 36 个。
- 默认按逆时针或顺时针方向渲染时，方向规则必须在渲染器中固定，并在 UI 上标注 `Pin 1` 位置。
- 如果后续发现某些 LQFP 图需要特殊方向校准，再增加可选 `orientation` 元数据，而不是让每行 CSV 都维护 `Side/Position`。

Manifest 格式：

```json
{
  "schemaVersion": 1,
  "dataVersion": "2026.05.31",
  "chips": [
    {
      "id": "GD32F407",
      "vendor": "GigaDevice",
      "family": "GD32F4",
      "displayName": "GD32F407",
      "gpioAfCsv": "gigadevice/gd32f4/gd32f407/GD32F407_GPIO_AF.csv",
      "packages": [
        {
          "name": "LQFP144",
          "pinoutCsv": "gigadevice/gd32f4/gd32f407/GD32F407_LQFP144_PINOUT.csv"
        },
        {
          "name": "LQFP100",
          "pinoutCsv": "gigadevice/gd32f4/gd32f407/GD32F407_LQFP100_PINOUT.csv"
        }
      ],
      "source": "Reference manual / datasheet",
      "status": "stable"
    }
  ]
}
```

数据更新流程：

1. 维护者将新的 CSV 放入 `data/chips/<vendor>/<family>/<part-number>/`。
2. 更新 `data/chips/manifest.json`。
3. CI 运行 CSV 校验脚本，检查路径规则、文件名、列名、pin 名、封装 pad 编号、重复项和 manifest 引用。
4. 构建脚本将 CSV 转换为标准 JSON 索引。
5. 发布新的 VS Code 插件版本。
6. 用户通过 VS Code 扩展更新获得新增芯片，无需手动下载 CSV。

可扩展更新策略：

- MVP 使用“随插件发布”的内置数据包，稳定、离线可用、隐私风险低。
- 后续可增加“远程数据目录”能力，从 GitHub Release 或插件作者维护的数据源拉取 `manifest.json` 和签名数据包。
- 远程更新默认关闭或显式提示用户开启，避免在用户不知情时访问网络。
- 即使支持远程更新，插件仍保留一份内置数据包作为离线兜底。

## 7. 架构设计

整体架构分为四层。

数据层：

- `csv-importer` 负责读取和解析 CSV。
- `data-pack-builder` 负责在构建期校验内置 CSV 并生成 JSON 索引。
- `chip-repository` 负责加载内置芯片 manifest 和标准 JSON 索引。
- `custom-csv-importer` 负责高级用户的本地 CSV 导入，不进入普通用户主流程。
- `normalizer` 负责将宽表转换为标准模型。

索引层：

- `pin-index` 提供 `getFunctionsByPin(pinName)`。
- `function-index` 提供 `findPinsByFunction(functionName)`。
- `peripheral-index` 提供 `findCandidatesByPeripheral(peripheralName)`。
- `search-index` 提供统一搜索入口。

配置规则层：

- `assignment-store` 维护当前配置集合。
- `conflict-engine` 检测同一 pin 多功能占用、同一外设信号重复分配等问题。
- `recommendation-engine` 首版只做简单推荐，例如同一 USART 的 TX/RX 候选组合。

展示层：

- Extension Host 注册命令、加载内置数据包、保存状态、向 Webview 发送数据。
- Webview React App 渲染 Pin Map 工作台。
- Webview 与 Extension Host 通过 `postMessage` 通信。

## 8. 数据流

启动流程：

1. 用户执行命令 `McuPinFunc: Open Pin Map`。
2. Extension Host 创建 Webview。
3. Extension Host 读取内置 `manifest.json`，生成芯片选择列表。
4. 用户选择芯片，Extension Host 加载该芯片的内置 JSON 索引。
5. 索引层恢复 pin、function、peripheral 和 search 索引。
6. Extension Host 将 chip 数据摘要发送给 Webview。
7. Webview 渲染逻辑 Pin Map。

查询流程：

1. 用户输入 `PA9`、`USART0_TX` 或 `USART0`。
2. Webview 发送查询请求或在本地索引中查询。
3. 查询结果高亮到 Pin Map。
4. 右侧显示候选功能和候选引脚。

分配流程：

1. 用户选择 pin 和某个 AF 功能。
2. Webview 提交 assignment。
3. 配置规则层更新配置集合。
4. `conflict-engine` 重新计算冲突。
5. UI 更新 pin 状态、冲突面板和配置集合。

导出流程：

1. 用户点击导出。
2. 插件将当前 `Assignment[]` 转换为 JSON 或 Markdown。
3. 用户选择保存路径或直接写入工作区文件。

## 9. 错误处理

CSV 文件错误：

- 内置 CSV 的格式错误必须在 CI 和构建期阻断，不能发布到用户侧。
- 工作区自定义 CSV 缺少 `PinName` 或 AF 列时，显示阻断错误。
- 工作区自定义 CSV 的某些 AF 单元格无法解析时，保留 raw 并显示 warning。
- 工作区自定义 CSV 为空或无有效 pin 时，显示空状态和修复建议。
- manifest 引用缺失文件时，构建期阻断；运行期显示数据包损坏提示。

数据冲突：

- 同一 pin 分配多个功能时标记为冲突。
- 同一外设信号分配多个 pin 时标记为重复。
- 冲突不阻断用户操作，但导出前提示确认。

Webview 通信错误：

- Extension Host 对未知消息类型返回 error。
- Webview 显示 toast 或错误面板。
- 关键操作失败时保留用户当前选择，不清空状态。

状态持久化错误：

- 保存到 workspaceState 失败时显示警告。
- 导出失败时显示 VS Code error message，并保留可重试入口。

## 10. 测试策略

单元测试：

- 数据目录规则校验。
- CSV 文件名规范校验。
- manifest schema 校验。
- CSV 宽表解析。
- package pinout CSV 解析。
- GPIO AF CSV 与 pinout CSV 的 pin 名交叉校验。
- `/` 分隔功能拆分。
- pin 名解析，例如 `PA9`。
- 外设和信号解析，例如 `USART0_TX`。
- pin/function/peripheral 反向索引。
- 搜索行为。
- 冲突检测规则。

集成测试：

- 打开 Pin Map 命令。
- 加载内置 manifest。
- 选择并加载内置 `GD32F407` 数据。
- Webview 收到 chip 数据。
- 分配一个功能并保存状态。
- 导出 JSON 或 Markdown。

人工验收场景：

- 搜索 `PA9` 可以看到 `USART0_TX` 等功能。
- 搜索 `USART0_TX` 可以看到候选 pin。
- 分配 `PA9 -> USART0_TX` 后，PA9 状态变为已分配。
- 再分配 `PA9 -> SDIO_D2` 后，PA9 状态变为冲突。
- 外设筛选 `USART` 后，只高亮 USART 相关 pin。

## 11. 里程碑

阶段一：插件骨架和数据解析

- 创建 VS Code 插件工程。
- 接入 React Webview。
- 建立 `data/chips/` 内置数据目录和 manifest。
- 制定并校验 `GD32F407_GPIO_AF.csv` 命名与格式。
- 制定并校验 `GD32F407_LQFP144_PINOUT.csv`、`GD32F407_LQFP100_PINOUT.csv` 命名与格式。
- 构建期将 GD32F407 CSV 转为标准 JSON 索引。
- 建立标准数据模型和索引。

阶段二：Pin Map MVP

- 渲染逻辑端口网格。
- 实现搜索和外设过滤。
- 实现 pin 详情面板。
- 实现 assignment 和冲突检测。

阶段三：配置保存和导出

- 保存工作区配置集合。
- 导出 JSON。
- 导出 Markdown 报告。
- 增加基础测试。

阶段四：增强体验

- 增加推荐引脚组合。
- 增加更多内置芯片 CSV，并通过插件版本更新推送给用户。
- 增加高级用户自定义 CSV 导入。
- 增加远程数据目录更新能力。
- 增加真实封装布局数据模型和 Package View。
- 增加 SDK 代码片段导出。

## 12. 决策记录

- 产品方向选择“芯片配置型”，不是纯查询型或代码辅助型。
- 展现方式选择 Pin Map 优先。
- MVP 选择“先逻辑、后封装”：首版以端口分组网格落地，后续接入真实封装布局。
- 技术路线选择 VS Code Extension Host + React Webview + 本地 CSV 索引。
- CSV 默认作为插件内置数据包发布，普通用户不需要手动编写、下载或选择 CSV。
- CSV 命名采用 `<PART_NUMBER>_GPIO_AF.csv`，并通过 manifest 管理芯片列表和元数据。
- 数据目录采用 `data/chips/<vendor>/<family>/<part-number>/`，例如 `data/chips/gigadevice/gd32f4/gd32f407/`。
- 真实封装布局数据采用 `<PART_NUMBER>_<PACKAGE>_PINOUT.csv`，例如 `GD32F407_LQFP144_PINOUT.csv`。
- 不以系列名作为唯一数据主键，除非 manifest 显式声明多个芯片共用同一 AF 数据源。
- 新增芯片数据通过插件版本更新推送；远程数据目录作为后续增强能力。
- 首版导出选择 JSON/Markdown，不直接生成完整 SDK 初始化代码。
