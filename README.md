# 3D Vision Studio

基于 React、Three.js 和 FastAPI 的 3D 可视化拖拽编辑器 MVP。系统参考 Avue Data 的低代码编排模式，提供项目中心、左侧组件库、中部三维场景画布、右侧属性面板和底部时间轴/事件区。

## 项目说明

当前实现覆盖最终需求规格说明书中的核心开发链路：

### 项目中心与多项目管理

- 默认进入项目列表页（`#/`）：项目卡片展示图标、名称、描述、对象数与更新时间
- 内置 4 个实际使用场景示例，开箱即可体验编辑、预览与发布全流程：
  - 🏙️ 智慧园区态势中心：办公研发、道路绿化、低碳停车与园区交通
  - ⚡ 风光储一体化电站：风机、光伏阵列与储能系统发电监控
  - 🏭 智能工厂数字孪生：车间产线、物流输送与设备状态映射
  - 📦 智慧物流园运营中心：仓库月台、车辆调度与吞吐数据
- 点击卡片进入项目编辑器（`#/project/:id`），面包屑可返回项目中心
- 新建项目（名称必填、描述可选）与删除项目（带确认，示例项目不可删除）
- 项目列表支持按名称/描述搜索
- 多项目草稿、发布记录、运行错误相互隔离；旧版单项目 localStorage 数据自动迁移到「智慧园区态势中心」

### 场景编辑器

- 组件库搜索、分类、点击添加和拖拽添加
- 建筑/工业/能源组件：园区建筑、办公楼、厂房、仓库、道路、树木、储罐、冷却塔、管道、输送线、龙门吊、车辆、风机、光伏和传感器
- Three.js 三维画布、网格、坐标轴、节点选择和基础对象渲染
- 画布 Gizmo：对象移动、旋转、缩放，支持 0.5 单位移动吸附和 15 度旋转吸附
- 鼠标拖拽落点：按画布射线计算地面坐标，组件不会再固定出现在默认位置
- 场景树：选择、折叠/展开、点击眼睛图标切换对象可见性和层级展示
- 属性编辑：名称、位置、旋转、缩放、颜色、透明度、文本、数值、可见和锁定；锁定对象不可删除并给出提示
- 运行态预览：隐藏编辑器工具栏，展示只读 3D 场景；标题、副标题与指标卡跟随项目配置（指标为示例数据）
- 发布版本、发布记录（本地模式下持久化到 localStorage，刷新不丢失）、回滚和基础运行错误列表
- 可用的撤销/重做（保留 50 步历史，撤销后保持当前选择）、网格开关、场景 JSON 导出以及 W/E/R 模式快捷键
- 返回项目中心时若有未保存变更，自动补一次保存，避免切换页面丢数据

### 样式与交互

- 参考 shadcn/ui 的设计组织方式：`:root` 语义化设计令牌（背景/边框/主色/圆角/滚动条等），后续换肤只需覆盖变量
- 全局细滚动条：WebKit 圆角拇指 + Firefox `scrollbar-width/scrollbar-color`，透明轨道不挤占版面
- 键盘可达性：统一的 `:focus-visible` 焦点环，鼠标点击不触发
- 对话框/发布抽屉进出场动效、按钮与输入框统一过渡、文本选区配色
- 属性面板数字输入隐藏原生步进箭头
- 尊重系统「减弱动态效果」偏好（`prefers-reduced-motion`）
- 最低支持 1280px 宽桌面屏；编辑器三栏按 `clamp()` 流式收缩，不做移动端适配

V1 为可运行 MVP。GLTF 组件在前端使用占位几何体承载节点流程，真实模型上传和 GLTFLoader 资源管线可在后续迭代接入；后端当前使用内存仓储，便于零配置开发，生产环境按需求规格接入 PostgreSQL、Redis 和本地数据盘。

## 页面与路由

前端使用哈希路由，无需服务端路由配置：

| 路由 | 页面 | 说明 |
|---|---|---|
| `#/` | 项目中心 | 项目列表（默认页）、搜索、新建、删除 |
| `#/project/:id` | 项目编辑器 | 场景编辑、预览、发布、回滚（页内切换） |

## 目录结构

```text
3dvision/
├── src/                         # React + Three.js 前端
│   ├── App.tsx                  # 哈希路由入口（项目中心 / 编辑器）
│   ├── ProjectsPage.tsx         # 项目中心：列表、搜索、新建、删除
│   ├── EditorPage.tsx           # 场景编辑器、预览和发布中心
│   ├── demos.ts                 # 内置示例项目场景与运行态指标配置
│   ├── SceneCanvas.tsx          # Three.js 场景画布
│   ├── api.ts                   # 项目/草稿/发布接口与本地降级
│   ├── types.ts                 # 场景、组件与项目类型
│   └── styles.css               # 深色工作台样式（设计令牌 + 细滚动条 + 自适应）
├── backend/                     # FastAPI 后端
│   ├── main.py                  # MVP API（含项目列表/创建/删除）
│   ├── requirements.txt
│   ├── .dockerignore
│   └── Dockerfile
├── scripts/backup.ps1           # 本地资源备份脚本
├── docker-compose.yml           # 单机部署编排（PostgreSQL/Redis 通过 storage profile 启用）
├── 3D可视化拖拽系统-最终需求规格说明书.md
└── README.md
```

## 环境要求

- Node.js 20 或更高版本
- npm 10 或更高版本
- Python 3.11 或更高版本（启动 FastAPI 时需要）
- Docker Desktop（仅使用 Docker Compose 时需要）
- 支持 WebGL 的现代 Chrome 或 Edge（最低支持 1280px 宽桌面屏）

## 本地运行：仅前端

后端未启动时，前端会自动使用 localStorage 保存项目、草稿和发布版本，并预置 4 个示例项目，可以直接体验完整流程。

```powershell
npm install
npm run dev
```

浏览器打开：`http://localhost:5173`（默认进入项目中心）

## 本地运行：前后端

终端一启动 FastAPI：

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

终端二启动前端：

```powershell
npm install
$env:VITE_API_BASE="/api"
npm run dev
```

不设置 `VITE_API_BASE` 时，前端使用浏览器 localStorage，不会请求未启动的后端；设置为 `/api` 后，Vite 会把 API 请求代理到 `127.0.0.1:8000`（同源代理场景无需额外 CORS 配置）。

后端默认不启用 CORS。仅当前端与 API 跨域部署时，需在启动 API 前设置允许的前端来源：

```powershell
$env:ALLOWED_ORIGINS = "http://localhost:5173"
uvicorn main:app --reload --port 8000
```

API 健康检查：`http://localhost:8000/api/health`

## 生产构建

```powershell
npm run build
npm run preview
```

构建产物位于 `dist/`。生产环境建议由 Nginx 托管 `dist/`，并将 `/api` 反向代理到 FastAPI。

## Docker Compose 部署

在安装 Docker 的服务器上执行：

```bash
docker compose up -d --build
```

默认只启动 FastAPI。PostgreSQL 和 Redis 为后续仓储与队列预留，需要时通过 storage profile 启用：

```bash
docker compose --profile storage up -d
```

说明：当前 API 仍使用内存数据仓储，重启后数据不保留。生产部署前必须替换 `POSTGRES_PASSWORD`（建议配合 `.env` 使用），并使用 Nginx/HTTPS 对外提供同源服务。

## 备份

Windows 开发环境可执行：

```powershell
.\scripts\backup.ps1
```

脚本会压缩 `data/assets` 和 `data/releases`。正式接入 PostgreSQL 后，应额外执行 `pg_dump`，并把备份复制到服务器之外的本地电脑、NAS 或对象存储。

## 关键接口

标注“前端已接入”的接口由页面实际调用；其余为后端可用、前端暂未消费的能力。

| 方法 | 路径 | 说明 | 前端 |
|---|---|---|---|
| GET | `/api/health` | 健康检查 | — |
| GET | `/api/projects` | 项目列表（含示例项目元信息） | ✅ 已接入 |
| POST | `/api/projects` | 创建项目 | ✅ 已接入 |
| DELETE | `/api/projects/{id}` | 删除项目 | ✅ 已接入 |
| GET/PUT | `/api/projects/{id}/draft` | 读取/保存草稿（409 表示版本冲突） | ✅ 已接入 |
| POST | `/api/projects/{id}/releases` | 创建发布版本 | ✅ 已接入 |
| GET | `/api/projects/{id}/releases` | 查询历史版本 | ✅ 已接入 |
| POST | `/api/runtime/errors` | 上报运行错误（按 projectId 归属） | ✅ 已接入 |
| POST | `/api/releases/{id}/rollback` | 回滚版本 | 暂未接入（前端本地回滚） |
| GET | `/api/runtime/{id}` | 获取运行态场景 | 暂未接入（预览使用当前场景） |
| GET | `/api/projects/{id}/errors` | 查询运行错误列表 | 暂未接入 |
| WS | `/api/runtime/{id}/ws` | 实时数据通道（回声占位） | 暂未接入 |

说明：后端已预置 4 个示例项目的元信息（草稿内容为空）；前端打开未保存过草稿的示例项目时，会使用 `src/demos.ts` 中的内置场景作为编辑起点，首次自动保存后即持久化到后端。

## 验证命令

```powershell
npm run build
python -m compileall backend
```

## 代码格式化

仓库已配置保存时自动格式化。使用 VS Code 或 Cursor 打开项目后，安装工作区推荐的
Prettier 和 Black Formatter 扩展；保存 TypeScript、TSX、CSS、JavaScript、JSON 或 Python
文件时会自动使用项目规则格式化。

手动格式化全部前后端代码：

```powershell
npm run format
```

仅检查格式但不修改文件：

```powershell
npm run format:check
```

后端格式化命令通过 `uvx` 运行 Black，因此需要本机安装 `uv`。执行 `npm install` 会安装
项目固定版本的 Prettier。

## 已知限制

- 当前后端使用内存字典，不适合重启后持久化和多进程生产运行。
- 当前 GLTF 组件使用占位几何体，真实模型上传、解析、压缩和本地资源鉴权需要后续实现。
- 预览运行态渲染的是当前编辑场景而非服务端已发布版本；回滚在前端完成后保存为新草稿。
- 底部时间轴与事件面板为占位视图，动画编排和事件规则在后续迭代实现。
- 后端 WebSocket 为回声占位，实时数据推送需要按需求规格接入。
- 认证、RBAC、PostgreSQL 持久化和 Redis 队列需要按照最终需求规格说明书接入生产模块。
- 界面按 1280px 及以上桌面屏设计，未适配移动端。

## 浏览器扩展报错说明

如果控制台出现类似下面的日志：

```text
Immersive Translate ERROR: dynamic-i18n version mismatch
This page uses Chrome's Built-in AI features (LanguageDetector)
```

它们来自 Chrome 扩展或浏览器内置能力（脚本文件通常是 `content_main.js`、`content_guard.js`），不是本项目的 React、Three.js 或 FastAPI 代码。可以在无痕窗口打开项目，或暂时禁用沉浸式翻译扩展后复查。项目自身的控制台应保持无 `error`/`warn`；若仍有错误，请优先检查网络请求和页面截图。
