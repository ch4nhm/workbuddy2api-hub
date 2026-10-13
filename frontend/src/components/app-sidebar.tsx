import {
  ActivityIcon,
  BotIcon,
  ChartNoAxesCombinedIcon,
  CircleGaugeIcon,
  ListChecksIcon,
  ScrollTextIcon,
  Settings2Icon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";
import type { DashboardController, MainTab } from "@/hooks/use-dashboard";
import { REALM_LABEL } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const NAV_ITEMS: Array<{
  id: MainTab;
  label: string;
  description: string;
  icon: typeof CircleGaugeIcon;
}> = [
  { id: "gateway", label: "网关总览", description: "流量与上游", icon: CircleGaugeIcon },
  { id: "accounts", label: "账号池", description: "凭证与额度", icon: UsersIcon },
  { id: "tasks", label: "成长任务", description: "签到与活跃", icon: ListChecksIcon },
  { id: "analytics", label: "用量分析", description: "成本与性能", icon: ChartNoAxesCombinedIcon },
  { id: "agents", label: "智能代理", description: "可用能力", icon: BotIcon },
  { id: "settings", label: "系统设置", description: "策略与参数", icon: Settings2Icon },
  { id: "logs", label: "运行日志", description: "事件与诊断", icon: ScrollTextIcon },
];

export function AppSidebar({ dashboard }: { dashboard: DashboardController }) {
  const { state, tab, setTab } = dashboard;
  const activeAccounts = state.accounts.filter((account) => account.enabled).length;
  const accountLabel = String(state.accounts.length);

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="p-2">
        <div className="flex h-10 items-center gap-2 px-1 group-data-[collapsible=icon]:justify-center">
          <div className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <ShieldCheckIcon />
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border border-sidebar bg-success" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-semibold">WorkBuddy</div>
            <div className="truncate text-[11px] text-muted-foreground">Gateway Console</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>控制台</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={tab === item.id}
                      tooltip={item.label}
                      onClick={() => setTab(item.id)}
                      aria-current={tab === item.id ? "page" : undefined}
                    >
                      <Icon />
                      <span>{item.label}</span>
                      {item.id === "accounts" && state.accounts.length > 0 ? (
                        <Badge variant="secondary" className="ml-auto h-5 px-1.5 group-data-[collapsible=icon]:hidden">
                          {accountLabel}
                        </Badge>
                      ) : null}
                      {item.id === "agents" && state.agentsAvailable ? (
                        <span className="ml-auto size-1.5 rounded-full bg-success group-data-[collapsible=icon]:hidden" />
                      ) : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="glass-panel flex flex-col gap-2 rounded-lg p-2.5 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">账号池</span>
            <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
              {activeAccounts} 可用
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">默认上游</span>
            <span className="font-medium">{REALM_LABEL[state.activeRealm]}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">版本</span>
            <span className="font-medium">{state.settings?.version || "—"}</span>
          </div>
        </div>
        <div className="hidden justify-center group-data-[collapsible=icon]:flex">
          <ActivityIcon className="text-success" />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
