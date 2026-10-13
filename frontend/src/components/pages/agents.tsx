import {
  BotIcon,
  BoxesIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  WorkflowIcon,
} from "lucide-react";
import type { DashboardController } from "@/hooks/use-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageFrame, PageHeader } from "@/components/shared";

const CAPABILITIES = [
  {
    icon: WorkflowIcon,
    title: "任务编排",
    description: "把多步上游操作串联成可复用的执行流程。",
  },
  {
    icon: BoxesIcon,
    title: "能力扩展",
    description: "按需挂载检索、工具调用与批处理能力。",
  },
  {
    icon: ShieldCheckIcon,
    title: "安全托管",
    description: "代理凭证与密钥由网关统一托管，不落地到前端。",
  },
];

export function AgentsPage({ dashboard }: { dashboard: DashboardController }) {
  const { state } = dashboard;
  const enabled = state.agentsAvailable;

  return (
    <PageFrame>
      <PageHeader
        title="智能代理"
        description="网关侧的代理执行能力。当前上游尚未开放该模块。"
        icon={BotIcon}
        actions={
          <>
            <Badge
              variant="outline"
              className={enabled ? "border-success/30 bg-success/10 text-success" : "text-muted-foreground"}
            >
              {enabled ? "已启用" : "未启用"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => void dashboard.loadAgents()}>
              <RefreshCwIcon data-icon="inline-start" />
              重新检测
            </Button>
          </>
        }
      />

      {enabled ? (
        <Card>
          <CardHeader>
            <CardTitle>代理运行面板</CardTitle>
            <CardDescription>上游已开放代理能力，运行明细将在此展示。</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            当前没有正在进行或历史记录的代理任务。
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="智能代理尚未启用"
          description="上游接口 /agents/available 返回未开放。启用后此处会显示代理任务、执行历史与可挂载能力，无需修改任何本地数据。"
          icon={BotIcon}
          action={
            <Button variant="outline" onClick={() => void dashboard.loadAgents()}>
              <RefreshCwIcon data-icon="inline-start" />
              重新检测状态
            </Button>
          }
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CAPABILITIES.map((capability) => {
          const Icon = capability.icon;
          return (
            <Card key={capability.title} size="sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-muted-foreground">
                    <Icon />
                  </div>
                  <CardTitle className="text-sm">{capability.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{capability.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageFrame>
  );
}
