# WorkBuddy 网关后台（React + shadcn/ui）

该目录是网关面板前端源码。仓库根目录的 `dashboard.html` 是由它打包出来的单文件产物，
网关后端只读这一个文件，所以源码与产物要一起维护。

## 技术栈

- React 19 + TypeScript + Vite 8
- Tailwind CSS v4 + shadcn/ui（radix-nova 预设，Radix 基础组件、Lucide 图标）
- motion（动效）、Recharts（图表）、Sonner（提示）、next-themes（明暗主题）、zustand
- `vite-plugin-singlefile`：把 JS / CSS / 字体全部内联进一个 HTML

后端只按固定路径读一个文件、也不提供 `/assets/*` 路由，所以必须打成单文件产物。

## 构建

```powershell
npm install
npm run build
```

产物：`dist/index.html`（约 1.3 MB，单文件，无外部资源引用）。

## 部署（只替换前端）

```powershell
Copy-Item -Force '.\dist\index.html' '..\dashboard.html'
```

仓库根的 `docker-compose.override.yml` 已经把 `./dashboard.html` 单文件挂载到
容器的 `/app/dashboard.html`，后端每次请求都从磁盘读取，保存后刷新页面即可生效。
若浏览器/容器仍看到旧页面，在仓库根执行一次 `docker compose up -d` 让挂载重新建立。

注意：不要用编辑器的「原子重命名保存」改动被挂载的这一个文件（会换 inode），
整文件覆盖即可。

## 回滚

```powershell
cd ..
git checkout -- dashboard.html
```

## 约定

- 只改前端：后端 Python 源码、`accounts/`、`usage/`、`settings.json` 一律不动。
- 数据全部走原有接口（`/settings`、`/accounts/*`、`/tasks`、`/pricing`、`/proxy/*` 等），
  不新增后端依赖。
- 视觉：左侧边栏导航 + 等宽字体 + 毛玻璃面板 + 克制动效，支持浅色/深色与三语界面。

## 本地验证

改完前端后，把 `dist/index.html` 覆盖到仓库根的 `dashboard.html`，刷新面板逐页
确认：登录、各页无控制台报错、窄屏（≈390px）无横向溢出、明暗主题与三语切换正常。
