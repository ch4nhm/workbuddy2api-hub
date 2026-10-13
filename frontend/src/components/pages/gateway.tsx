import { useState } from "react";
import { toast } from "sonner";
import { motion } from "motion/react";
import {
  ActivityIcon,
  ArrowUpRightIcon,
  CheckIcon,
  ClipboardIcon,
  Clock3Icon,
  CpuIcon,
  GaugeIcon,
  NetworkIcon,
  RadioTowerIcon,
  RouteIcon,
  TriangleAlertIcon,
  ZapIcon,
} from "lucide-react";
import type { DashboardController } from "@/hooks/use-dashboard";
import { REALM_LABEL, compact, fmt, formatTime, isAccountActive, ms, pct, relativeTime } from "@/lib/format";
import { copyText } from "@/lib/clipboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MetricCard, PageFrame, PageHeader, RealmBadge, SectionCard, StatusBadge } from "@/components/shared";

function gatewayBaseUrl(): string {
  try {
    return new URL("/v1", window.location.origin).toString().replace(/\/$/, "");
  } catch {
    return "/v1";
  }
}

function capabilityList(model: {
  capabilities?: { vision?: boolean; tool_calls?: boolean; reasoning?: boolean };
  supports_vision?: boolean;
  supports_tool_calls?: boolean;
  supports_reasoning?: boolean;
}): string[] {
  const rows: string[] = [];
  if (model.capabilities?.vision || model.supports_vision) rows.push("视觉");
  if (model.capabilities?.tool_calls || model.supports_tool_calls) rows.push("工具");
  if (model.capabilities?.reasoning || model.supports_reasoning) rows.push("推理");
  return rows;
}

export function GatewayPage({ dashboard }: { dashboard: DashboardController }) {
  const { state } = dashboard;
  const [copied, setCopied] = useState(false);
  const usage = state.usage;
  const recent = state.usageRecent?.rows || [];
  const activeAccounts = state.accounts.filter((account) => isAccountActive(account)).length;
  const accountsReady = usage?.account?.accounts_ready ?? activeAccounts;
  const accountsTotal = usage?.account?.accounts ?? state.accounts.length;
  const requestCount = Number(usage?.requests || 0);
  const errorRate = requestCount > 0 ? (Number(usage?.errors || 0) / requestCount) * 100 : 0;
  const cacheHit = Number(usage?.cache_hit_pct || 0);
  const successRate = Math.max(0, 100 - errorRate);
  const baseUrl = gatewayBaseUrl();

  async function copyGatewayUrl() {
    try {
      await copyText(baseUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      toast.success("网关地址已复制");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <PageFrame>
      <PageHeader
        title="网关总览"
        description="当前上游、账号池、模型目录与最近请求的实时状态。"
        icon={GaugeIcon}
        actions={
          <>
            <StatusBadge
              active={Boolean(state.ready)}
              activeText="网关在线"
              inactiveText="等待连接"
            />
            <Badge variant="outline" className="gap-1.5">
              <RadioTowerIcon />
              最后刷新 {relativeTime(state.lastUpdated)}
            </Badge>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="今日请求"
          value={fmt(requestCount)}
          detail={`成功率 ${pct(successRate)} · 错误 ${fmt(usage?.errors || 0)}`}
          icon={ActivityIcon}
        />
        <MetricCard
          label="Token 消耗"
          value={compact(usage?.total_tokens || 0)}
          detail={`缓存命中 ${pct(cacheHit)}`}
          icon={ZapIcon}
          tone="success"
        />
        <MetricCard
          label="Credit"
          value={fmt(usage?.credit || 0, 1)}
          detail={`估算成本 ¥${fmt(usage?.cost_cny || 0, 3)}`}
          icon={CpuIcon}
          tone="warning"
        />
        <MetricCard
          label="账号就绪"
          value={`${accountsReady}/${accountsTotal}`}
          detail={`${state.proxySlots.length} 个出口 · ${accountsTotal - accountsReady} 个待处理`}
          icon={NetworkIcon}
          tone={accountsTotal > 0 && accountsReady < accountsTotal ? "destructive" : "default"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="上游状态"
          description="默认网关路由与后台排程器的当前状态。"
          action={<RealmBadge realm={state.activeRealm} />}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="glass-panel rounded-lg p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">默认上游</div>
                <RouteIcon />
              </div>
              <div className="mt-2 text-lg font-semibold">{REALM_LABEL[state.activeRealm]}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                面板范围 {REALM_LABEL[state.viewRealm]}
              </div>
            </div>

            <div className="glass-panel rounded-lg p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">排程器</div>
                <Clock3Icon />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge
                  active={Boolean(state.scheduler?.enabled)}
                  activeText="运行中"
                  inactiveText="已暂停"
                />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                下次运行 {state.scheduler?.next_run_time || "—"}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/25 p-3 font-mono text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">BASE URL</span>
              <span className="truncate">{baseUrl}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">API KEY</span>
              <span className="truncate">{state.settings?.api_key_masked || "—"}</span>
            </div>
            <Button size="sm" variant="outline" className="w-fit" onClick={() => void copyGatewayUrl()}>
              {copied ? <CheckIcon data-icon="inline-start" /> : <ClipboardIcon data-icon="inline-start" />}
              {copied ? "已复制" : "复制网关地址"}
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="运行摘要"
          description="来自实时用量与排程巡检的聚合结果。"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">输入 / 输出 Token</span>
              <span className="font-mono text-sm">
                {compact(usage?.prompt_tokens || 0)} / {compact(usage?.completion_tokens || 0)}
              </span>
            </div>
            <Progress value={Number(cacheHit)} />
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>缓存复用率</span>
              <span className="font-mono text-foreground">{pct(cacheHit)}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border/70 p-3">
                <div className="text-xs text-muted-foreground">最近巡检</div>
                <div className="mt-1 font-mono text-sm">
                  {state.scheduler?.last_run_time || "—"}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 p-3">
                <div className="text-xs text-muted-foreground">模型目录</div>
                <div className="mt-1 font-mono text-sm">{state.models.length} 个模型</div>
              </div>
            </div>
            {state.scheduler?.mode ? (
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                {state.scheduler.mode}
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="最近请求"
          description="最近完成的模型调用与资源消耗。"
          action={
            <Badge variant="secondary" className="gap-1.5">
              <ArrowUpRightIcon />
              {recent.length} 条
            </Badge>
          }
        >
          {recent.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>模型</TableHead>
                  <TableHead>账号</TableHead>
                  <TableHead className="text-right">Token</TableHead>
                  <TableHead className="text-right">耗时</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.slice(0, 8).map((row) => (
                  <TableRow key={`${row.at}-${row.model}-${row.account}`}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatTime(row.iso)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{row.model}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.stream ? "流式" : "非流式"} · {row.reasoning_effort || "默认"}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {state.accounts.find((account) => account.uid === row.account)?.nickname ||
                        row.account.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {compact(row.total_tokens)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {ms(row.elapsed_ms)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        active={row.outcome === "completed"}
                        activeText="完成"
                        inactiveText={row.outcome === "client_aborted" ? "客户端中止" : "异常"}
                        warning={row.outcome !== "completed"}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
              <TriangleAlertIcon className="text-muted-foreground" />
              <div className="text-sm font-medium">还没有请求记录</div>
              <div className="text-xs text-muted-foreground">
                网关收到第一条调用后，这里会显示实时明细。
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="模型目录"
          description="按当前面板范围从网关实时读取。"
          action={<Badge variant="outline">{state.models.length}</Badge>}
        >
          <div className="flex max-h-[420px] flex-col gap-2 overflow-auto pr-1">
            {state.models.map((model, index) => {
              const caps = capabilityList(model);
              return (
                <motion.div
                  key={model.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * 0.015, 0.2), duration: 0.18 }}
                  className="flex min-w-0 items-start justify-between gap-3 rounded-lg border border-border/70 bg-background/70 p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{model.name || model.id}</div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                      {model.id}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {caps.slice(0, 3).map((cap) => (
                      <Badge key={cap} variant="secondary" className="text-[10px]">
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </motion.div>
              );
            })}
            {!state.models.length ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
                <CpuIcon className="text-muted-foreground" />
                <div className="text-sm font-medium">模型目录为空</div>
                <div className="text-xs text-muted-foreground">切换上游范围后再试。</div>
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="今日活动"
          description="签到、活跃、旅行等后台动作的执行结果。"
          action={<Badge variant="outline">{state.activity?.total || 0} 条</Badge>}
        >
          <div className="flex flex-col gap-2">
            {(state.activity?.rows || []).slice(0, 8).map((row, index) => (
              <div
                key={`${row.ts}-${row.uid}-${row.task}-${index}`}
                className="flex items-start gap-3 rounded-lg border border-border/70 p-2.5"
              >
                <span className={row.ok ? "mt-1 text-success" : "mt-1 text-destructive"}>
                  {row.ok ? <CheckIcon /> : <TriangleAlertIcon />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {row.nickname || row.uid.slice(0, 8)}
                    </span>
                    <RealmBadge realm={row.realm} />
                    <Badge variant="secondary" className="text-[10px]">
                      {row.task}
                    </Badge>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {row.message || "无附加信息"}
                  </div>
                </div>
                <time className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {formatTime(row.ts)}
                </time>
              </div>
            ))}
            {!state.activity?.rows?.length ? (
              <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
                今天还没有活动记录。
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title="出口与稳定"
          description="代理槽位、冷却与错误概览。"
        >
          {state.proxySlots.length ? (
            <div className="flex flex-col gap-2">
              {state.proxySlots.map((slot) => (
                <div
                  key={slot.slot}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{slot.slot}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {slot.exit_ip || slot.url || "未上报出口 IP"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">{slot.bound_accounts || 0} 账号</Badge>
                    <StatusBadge
                      active={slot.enabled !== false && slot.status !== "error"}
                      activeText={slot.latency_ms ? `${slot.latency_ms}ms` : "可用"}
                      inactiveText="异常"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-center">
              <NetworkIcon className="text-muted-foreground" />
              <div className="text-sm font-medium">未配置独立出口</div>
              <div className="text-xs text-muted-foreground">
                账号当前直接走上游网络，不经过代理槽位。
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </PageFrame>
  );
}
