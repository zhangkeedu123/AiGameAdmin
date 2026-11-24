# AiGameAdmin · 碎片复原师运营管理

使用 Umi Max 和 Ant Design Pro 的 ProLayout、PageContainer、ProTable、ProForm，配合 Ant Design 基础组件。后台通过 AiGameApi 的管理员会话鉴权。

## 启动

1. 按 AiGameApi 的 README 初始化 PostgreSQL，配置 .env，并创建管理员。先启动 API。
2. 在 AiGameAdmin 执行 npm install 和 npm run dev，打开终端显示的地址（默认 http://127.0.0.1:8001）。开发默认代理至 http://127.0.0.1:8000。若 API 用其他端口，启动前设置环境变量 AIGAME_API_TARGET。
3. 本机 HTTP 调试使用 AiGameApi 的 COOKIE_SECURE=false。线上使用 HTTPS 和 COOKIE_SECURE=true。
4. 执行 npm run build 生成 dist。生产环境把 /admin/*、/api/* 和 /health 转发至 API，其他请求由管理员前端提供，页面路径启用 SPA 回退。浏览器和管理接口须同源。

## 管理流程

- **瓷器关卡**：上传 PNG、JPEG 或 WebP，填写名称、3–64 片和旋转开关。API 生成 400×450 压缩 PNG、切片区域和裂边，保存为草稿。透明 PNG 保留透明度，透明区域较多时建议使用透明底瓷器图。可点缩略图预览后发布。
- **删除与下架**：草稿可删除并清理图集。已发布关卡通过下架移出在线列表，保留已有进度、历史和图集地址。
- **玩家**：按昵称查找，查看来源、登录与关卡进度。可创建玩家、维护平台资料并签发或撤销联调令牌。令牌签发后仅显示一次。
- **排行榜**：按服务端记录的已通关数排名，支持按微信、抖音筛选。小游戏原有本机每日榜继续保存在设备上。

## 对接小游戏

在 AiGame 根目录将 `appids.example.json` 复制为 `appids.local.json`，将 `apiUrl` 填为 `http://127.0.0.1:8000`，再执行 `node scripts/preview.js`。首页出现「线上关卡」，可试玩已发布的关卡。

微信、抖音真机使用 HTTPS 根地址，例如将 `appids.local.json` 的 `apiUrl` 改为 `https://game-api.example.com` 后执行 `node scripts/build.js` 和 `node scripts/check.js`。在宿主平台配置请求和图片所需的合法域名，并到官方真机验证。未配置 API 地址的包仍可玩本地关卡。

在「玩家管理」签发令牌后，在游戏的「线上关卡」选择「绑定令牌」完成联调登录。已绑定的玩家通关时会上报到后台，并按已发布关卡顺序进行服务器通关统计。在线关卡的桌面进度保存在本机，重新打开已完成的关卡可重试同步。本项目沿用已签发的玩家令牌，正式微信、抖音账号授权需配置相应平台服务。

## 接口

旧服务端 HTML 后台已由本项目替代。管理 API 保持 /admin 前缀，会话使用 HttpOnly Cookie，写入使用 X-CSRF-Token。小游戏 API 使用 /api/v1，公开读取已发布关卡，玩家打卡和成绩同步使用 Bearer 令牌。
