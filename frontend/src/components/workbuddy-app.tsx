import { useEffect, useState, type FormEvent } from "react";
import { useTheme } from "next-themes";
import {
  CheckIcon,
  ChevronDownIcon,
  LanguagesIcon,
  LogOutIcon,
  MonitorCogIcon,
  MoonIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SunIcon,
} from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { AccountsPage } from "@/components/pages/accounts";
import { AgentsPage } from "@/components/pages/agents";
import { AnalyticsPage } from "@/components/pages/analytics";
import { GatewayPage } from "@/components/pages/gateway";
import { LogsPage } from "@/components/pages/logs";
import { SettingsPage } from "@/components/pages/settings";
import { TasksPage } from "@/components/pages/tasks";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDashboard, type DashboardController } from "@/hooks/use-dashboard";
import { useLanguage } from "@/hooks/use-language";
import type { Language } from "@/lib/i18n";
import type { Realm } from "@/lib/types";
import { REALM_LABEL, relativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared";

const PAGE_TITLES = {
  gateway: "网关总览",
  accounts: "账号池",
  tasks: "成长任务",
  analytics: "用量分析",
  agents: "智能代理",
  settings: "系统设置",
  logs: "运行日志",
} as const;

const LANGUAGE_LABEL: Record<Language, string> = {
  zh: "简体中文",
  "zh-Hant": "繁體中文",
  en: "English",
};

function ThemeSync() {
  const { resolvedTheme, theme } = useTheme();
  useEffect(() => {
    const root = document.documentElement;
    const applied = resolvedTheme === "dark" ? "dark" : "light";
    root.dataset.theme = applied;
    root.dataset.themePref = theme || "system";
    root.classList.toggle("dark", applied === "dark");
    root.style.colorScheme = applied;
  }, [resolvedTheme, theme]);
  return null;
}

function AppSkeleton() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function LoginScreen({
  onLogin,
  loading,
  usingDefault,
}: {
  onLogin: (password: string) => Promise<void>;
  loading: boolean;
  usingDefault?: boolean;
}) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    try {
      await onLogin(password);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent,var(--background))]" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-xl border border-border/70 bg-card/90 shadow-2xl backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex min-h-56 flex-col justify-between border-b border-border/60 p-6 lg:border-b-0 lg:border-r lg:p-8">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheckIcon />
            </div>
            <div>
              <div className="text-base font-semibold">WorkBuddy Gateway</div>
              <div className="text-xs text-muted-foreground">Operations Console</div>
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-3">
            <Badge variant="outline" className="w-fit border-success/30 bg-success/10 text-success">
              <span className="status-dot size-1.5 rounded-full bg-success" />
              服务在线
            </Badge>
            <h1 className="max-w-md text-2xl font-semibold tracking-tight">
              一个面板，看清账号、流量、成本与任务状态。
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              所有原有用量数据保持不变。登录后可直接管理网关运行参数，无需迁移或重建数据。
            </p>
          </div>
        </div>
        <form onSubmit={submit} className="flex flex-col justify-center gap-5 p-6 lg:p-8">
          <div className="flex flex-col gap-1">
            <div className="text-lg font-semibold">进入控制台</div>
            <p className="text-sm text-muted-foreground">输入面板密码以继续。</p>
          </div>
          <Field>
            <FieldLabel htmlFor="panel-password">面板密码</FieldLabel>
            <Input
              id="panel-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入面板密码"
              autoFocus
              autoComplete="current-password"
            />
          </Field>
          {usingDefault ? (
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              当前仍在使用默认密码，登录后建议立即修改。
            </div>
          ) : null}
          <Button type="submit" disabled={!password || submitting || loading}>
            <ShieldCheckIcon data-icon="inline-start" />
            {submitting || loading ? "正在验证..." : "登录"}
          </Button>
        </form>
      </div>
    </main>
  );
}

function Toolbar({ dashboard }: { dashboard: DashboardController }) {
  const { state, tab, setTab, setViewRealm, setActiveRealm, refreshAll, logout } = dashboard;
  const { language, setLanguage } = useLanguage();
  const { resolvedTheme, setTheme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [realmChanging, setRealmChanging] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }

  async function changeActiveRealm(realm: Realm) {
    if (realm === state.activeRealm) return;
    setRealmChanging(true);
    try {
      await setActiveRealm(realm);
    } finally {
      setRealmChanging(false);
    }
  }

  return (
    <header className="glass-panel relative z-30 flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2 sm:px-4">
      <SidebarTrigger />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{PAGE_TITLES[tab]}</div>
        <div className="hidden text-[11px] text-muted-foreground sm:block">
          最后刷新 {relativeTime(state.lastUpdated)}
        </div>
      </div>

      <div className="order-last flex w-full items-center gap-2 overflow-x-auto pb-0.5 sm:order-none sm:w-auto sm:pb-0">
        <ToggleGroup
          type="single"
          size="sm"
          spacing={2}
          value={state.viewRealm}
          onValueChange={(value) => value && void setViewRealm(value as Realm)}
          aria-label="数据范围"
        >
          <ToggleGroupItem value="cn" className="px-2 text-xs">国内版</ToggleGroupItem>
          <ToggleGroupItem value="intl" className="px-2 text-xs">国际版</ToggleGroupItem>
        </ToggleGroup>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={realmChanging}>
              上游 {REALM_LABEL[state.activeRealm]}
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>默认上游</DropdownMenuLabel>
              {(["cn", "intl"] as Realm[]).map((realm) => (
                <DropdownMenuItem key={realm} onClick={() => void changeActiveRealm(realm)}>
                  {state.activeRealm === realm ? <CheckIcon /> : <span className="size-4" />}
                  {REALM_LABEL[realm]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label="切换语言">
              <LanguagesIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            <DropdownMenuGroup>
              <DropdownMenuLabel>界面语言</DropdownMenuLabel>
              {(Object.keys(LANGUAGE_LABEL) as Language[]).map((item) => (
                <DropdownMenuItem key={item} onClick={() => setLanguage(item)}>
                  {language === item ? <CheckIcon /> : <span className="size-4" />}
                  {LANGUAGE_LABEL[item]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label="切换主题">
              {resolvedTheme === "dark" ? <MoonIcon /> : <SunIcon />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            <DropdownMenuGroup>
              <DropdownMenuLabel>显示主题</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <MoonIcon />
                深色
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <SunIcon />
                浅色
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <MonitorCogIcon />
                跟随系统
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon-sm" onClick={() => void refresh()} disabled={refreshing}>
            <RefreshCwIcon className={refreshing ? "animate-spin" : undefined} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>刷新数据</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="账户菜单">
            <ShieldCheckIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuLabel>
            <div className="flex items-center justify-between gap-2">
              <span>管理员会话</span>
              <StatusBadge active={state.ready} activeText="已连接" inactiveText="未连接" />
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setTab("settings")}>
              <MonitorCogIcon />
              系统设置
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
              <LogOutIcon />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

export function WorkBuddyApp() {
  const dashboard = useDashboard();
  const { state, login, tab } = dashboard;
  const authenticated = Boolean(state.panelStatus.authenticated || state.ready);
  const needsLogin =
    !state.loading &&
    !authenticated &&
    Boolean(state.panelStatus.panel_password_required);

  if (state.loading && !authenticated) return <AppSkeleton />;
  if (needsLogin) {
    return (
      <LoginScreen
        onLogin={login}
        loading={state.loading}
        usingDefault={state.panelStatus.panel_password_is_default}
      />
    );
  }

  return (
    <>
      <ThemeSync />
      <SidebarProvider defaultOpen>
        <AppSidebar dashboard={dashboard} />
        <SidebarInset className="content-canvas h-svh min-w-0 overflow-hidden md:h-[calc(100svh-1rem)]">
          <Toolbar dashboard={dashboard} />
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
            {tab === "gateway" ? <GatewayPage dashboard={dashboard} /> : null}
            {tab === "accounts" ? <AccountsPage dashboard={dashboard} /> : null}
            {tab === "tasks" ? <TasksPage dashboard={dashboard} /> : null}
            {tab === "analytics" ? <AnalyticsPage dashboard={dashboard} /> : null}
            {tab === "agents" ? <AgentsPage dashboard={dashboard} /> : null}
            {tab === "settings" ? <SettingsPage dashboard={dashboard} /> : null}
            {tab === "logs" ? <LogsPage dashboard={dashboard} /> : null}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
