# AiGameAdmin · 碎片复原师运营管理

使用 Umi Max 和 Ant Design Pro 的 ProLayout、PageContainer、ProTable、ProForm，配合 Ant Design 基础组件。后台通过 AiGameApi 的管理员会话鉴权。

## 启动

1. 按 AiGameApi 的 README 初始化 PostgreSQL，配置 .env，并创建管理员。先启动 API。
2. 在 AiGameAdmin 执行 npm install 和 npm run dev，打开终端显示的地址（默认 http://127.0.0.1:8001）。开发默认代理至 http://127.0.0.1:8000。若 API 用其他端口，启动前设置环境变量 AIGAME_API_TARGET。
3. 本机 HTTP 调试使用 AiGameApi 的 COOKIE_SECURE=false。线上使用 HTTPS 和 COOKIE_SECURE=true。
4. 执行 npm run build 生成 dist。生产环境把 /admin/*、/api/* 和 /health 转发至 API，其他请求由管理员前端提供，页面路径启用 SPA 回退。浏览器和管理接口须同源。

## 管理流程

- **瓷器关卡**：上传 PNG、JPEG 或 WebP，填写分类、关卡编号、拼合片数、旋转片数和干扰片数。API 保存原图，并生成 400×450 压缩图集与随机棱角碎片。可用「碎片预览」检查完整图和碎片。修改时可使用已保存原图或上传新图重新生成。
- **删除与下架**：草稿可删除并清理图集。已发布关卡通过下架移出在线列表，保留已有进度、历史和图集地址，稍后可重新上架。
- **瓷器兑换**：玩家集齐 30 件线上每日藏品后可申请一份实物。管理者在「收货信息与物流」查看姓名、手机及地址，填写物流公司和单号，并将状态更新为待处理、备货中、已发货或已签收。订单会标记来自藏品兑换还是月榜冠军。
- **玩家**：按昵称查找，查看来源、登录与关卡进度。可创建玩家、维护平台资料并签发或撤销联调令牌。令牌签发后仅显示一次。
- **闯关月榜**：按月份和平台查看，先比最高通关编号，再比最短用时。北京时间月末结算，跨平台总榜冠军可申请一件实物瓷器。

## 对接小游戏

在 AiGame 根目录将 `appids.example.json` 复制为 `appids.local.json`，将 `apiUrl` 填为 `http://127.0.0.1:8000`，再执行 `node scripts/preview.js`。从首页选择普通、困难或极难，试玩后台在对应分类上架的关卡。

微信、抖音真机使用 HTTPS 根地址，例如将 `appids.local.json` 的 `apiUrl` 改为 `https://game-api.example.com` 后执行 `node scripts/build.js` 和 `node scripts/check.js`。在宿主平台配置请求和图片所需的合法域名，并到官方真机验证。要为每日挑战供题，在「瓷器关卡」选择「每日一瓷」分类并上架。

游戏按设备识别玩家，局内桌面保存在设备，通关提交服务端用于解锁和月榜。当前关游玩期间会提前请求下一关配置和图集。

## 接口

旧服务端 HTML 后台已由本项目替代。管理 API 保持 /admin 前缀，会话使用 HttpOnly Cookie，写入使用 X-CSRF-Token。小游戏 API 使用 /api/v1，公开读取已发布关卡，玩家打卡和成绩同步使用 Bearer 令牌。
