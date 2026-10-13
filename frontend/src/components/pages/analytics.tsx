import { useMemo } from "react";
import {
  ActivityIcon,
  AlertTriangleIcon,
  BarChart3Icon,
  CoinsIcon,
  GaugeIcon,
  LineChartIcon,
  TimerResetIcon,
  ZapIcon,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import type { AnalyticsRange, DashboardController } from "@/hooks/use-dashboard";
import type { AnalyticsResponse } from "@/lib/types";
import { compact, fmt, ms, pct } from "@/lib/format";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState, MetricCard, PageFrame, PageHeader, RealmBadge, SectionCard } from "@/components/shared";

const RANGE_LABEL: Record<AnalyticsRange, string> = {
  today: "今日",
  "7d": "近 7 天",
  "30d": "近 30 天",
  all: "全部",
};

const RANGE_OPTIONS: AnalyticsRange[] = ["today", "7d", "30d", "all"];

const requestConfig = {
  requests: { label: "请求", color: "var(--chart-1)" },
  errors: { label: "错误", color: "var(--chart-5)" },
} satisfies ChartConfig;

const tokenConfig = {
  total_tokens: { label: "总 Token", color: "var(--chart-2)" },
  cached_tokens: { label: "缓存 Token", color: "var(--chart-4)" },
} satisfies ChartConfig;

const modelConfig = {
  tokens: { label: "Token", color: "var(--chart-1)" },
} satisfies ChartConfig;

function timeLabel(at: number, range: AnalyticsRange): string {
  const date = new Date(at * 1000);
  if (Number.isNaN(date.getTime())) return String(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (range === "today") return hm;
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${hm}`;
}

function modelRows(analytics?: AnalyticsResponse) {
  if (!analytics) return [] as Array<{ model: string; tokens: number; requests: number; cost: number }>;
  const map = new Map<string, { tokens: number; requests: number; cost: number }>();
  const source = analytics.models;
  if (source && Object.keys(source).length) {
    for (const [model, data] of Object.entries(source)) {
      map.set(model, {
        tokens: Number(data.tokens || 0),
        requests: Number(data.requests || 0),
        cost: Number(data.cost_cny || 0),
      });
    }
  } else {
    for (const account of analytics.accounts || []) {
      for (const [model, data] of Object.entries(account.window_models || {})) {
        const current = map.get(model) || { tokens: 0, requests: 0, cost: 0 };
        current.tokens += Number(data.tokens || 0);
        current.requests += Number(data.requests || 0);
        current.cost += Number(data.cost_cny || 0);
        map.set(model, current);
      }
    }
  }
  return [...map.entries()]
    .map(([model, value]) => ({ model, ...value }))
    .sort((a, b) => b.tokens - a.tokens);
}

export function AnalyticsPage({ dashboard }: { dashboard: DashboardController }) {
  const { state, analyticsRange, setAnalyticsRange } = dashboard;
  const analytics = state.analytics;
  const summary = analytics?.summary.window;
  const series = state.timeseries?.series || [];
  const perf = state.perf;
  const models = useMemo(() => modelRows(analytics), [analytics]);

  const chartSeries = useMemo(
    () => series.map((point) => ({ ...point, label: timeLabel(point.at, analyticsRange) })),
    [series, analyticsRange],
  );
  const topModels = models.slice(0, 8);

  const requests = Number(summary?.requests || 0);
  const errors = Number(summary?.errors || 0);
  const successRate = requests > 0 ? ((requests - errors) / requests) * 100 : 0;
  const accountCount = analytics?.accounts?.length || 0;

  return (
    <PageFrame>
      <PageHeader
        title="用量分析"
        description="按时间窗聚合的请求、Token、成本与性能指标，全部来自网关实时统计。"
        icon={LineChartIcon}
        actions={
          <ToggleGroup
            type="single"
            size="sm"
            spacing={2}
            value={analyticsRange}
            onValueChange={(value) => value && setAnalyticsRange(value as AnalyticsRange)}
            aria-label="分析时间范围"
          >
            {RANGE_OPTIONS.map((range) => (
              <ToggleGroupItem key={range} value={range} className="px-2 text-xs">
                {RANGE_LABEL[range]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={`${RANGE_LABEL[analyticsRange]}请求`}
          value={compact(requests)}
          detail={`错误 ${fmt(errors)} · 成功率 ${pct(successRate)}`}
          icon={ActivityIcon}
          tone={successRate >= 99 ? "success" : successRate >= 95 ? "warning" : "destructive"}
        />
        <MetricCard
          label="Token 总量"
          value={compact(summary?.total_tokens || 0)}
          detail={`输入 ${compact(summary?.prompt_tokens || 0)} · 输出 ${compact(summary?.completion_tokens || 0)}`}
          icon={ZapIcon}
          tone="success"
        />
        <MetricCard
          label="积分消耗"
          value={fmt(summary?.credit || 0, 1)}
          detail={`估算成本 ¥${fmt(summary?.cost_cny || 0, 3)}`}
          icon={CoinsIcon}
          tone="warning"
        />
        <MetricCard
          label="覆盖账号"
          value={fmt(accountCount)}
          detail={`模型 ${models.length} 个`}
          icon={GaugeIcon}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="请求趋势"
          description="按统计桶聚合的请求量与错误量。"
          action={
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-chart-1" />请求
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-chart-5" />错误
              </span>
            </div>
          }
        >
          {chartSeries.length ? (
            <ChartContainer config={requestConfig} className="aspect-auto h-[280px] w-full">
              <AreaChart data={chartSeries} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillRequests" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-requests)" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="var(--color-requests)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="fillErrors" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-errors)" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="var(--color-errors)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} />
                <YAxis tickLine={false} axisLine={false} width={34} tickFormatter={(value) => compact(value)} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                <Area
                  dataKey="requests"
                  type="monotone"
                  stroke="var(--color-requests)"
                  strokeWidth={2}
                  fill="url(#fillRequests)"
                />
                <Area
                  dataKey="errors"
                  type="monotone"
                  stroke="var(--color-errors)"
                  strokeWidth={2}
                  fill="url(#fillErrors)"
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <EmptyState title="暂无请求数据" description="所选区间内还没有请求记录。" icon={ActivityIcon} />
          )}
        </SectionCard>

        <SectionCard
          title="Token 用量"
          description="总 Token 与上下文缓存命中的趋势。"
          action={
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-chart-2" />总 Token
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-chart-4" />缓存
              </span>
            </div>
          }
        >
          {chartSeries.length ? (
            <ChartContainer config={tokenConfig} className="aspect-auto h-[280px] w-full">
              <AreaChart data={chartSeries} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillTokens" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-total_tokens)" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="var(--color-total_tokens)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="fillCached" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-cached_tokens)" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="var(--color-cached_tokens)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} />
                <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={(value) => compact(value)} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                <Area
                  dataKey="total_tokens"
                  type="monotone"
                  stroke="var(--color-total_tokens)"
                  strokeWidth={2}
                  fill="url(#fillTokens)"
                />
                <Area
                  dataKey="cached_tokens"
                  type="monotone"
                  stroke="var(--color-cached_tokens)"
                  strokeWidth={2}
                  fill="url(#fillCached)"
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <EmptyState title="暂无 Token 数据" description="所选区间内还没有 Token 消耗。" icon={ZapIcon} />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="成功调用"
          value={fmt(perf?.success || 0)}
          detail={`采样 ${fmt(perf?.sampled || 0)} · 中止 ${fmt(perf?.client_aborted || 0)}`}
          icon={ActivityIcon}
          tone="success"
        />
        <MetricCard
          label="成功率"
          value={pct(perf?.success_rate_pct || 0)}
          detail={`失败 ${fmt(perf?.errors || 0)} 次`}
          icon={BarChart3Icon}
          tone={(perf?.success_rate_pct || 0) >= 99 ? "success" : "warning"}
        />
        <MetricCard
          label="首字延迟 P90"
          value={ms(perf?.ttft_ms?.p90)}
          detail={`中位 ${ms(perf?.ttft_ms?.p50)} · 平均 ${ms(perf?.ttft_ms?.avg)}`}
          icon={TimerResetIcon}
        />
        <MetricCard
          label="输出速度"
          value={`${fmt(perf?.tokens_per_sec?.avg || 0, 1)} tok/s`}
          detail={`缓存命中 ${pct(perf?.cache_hit_pct?.avg || 0)}`}
          icon={ZapIcon}
          tone="success"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard
          title="模型用量"
          description="所选区间内 Token 消耗最高的模型。"
          action={<Badge variant="outline">{models.length} 个模型</Badge>}
        >
          {topModels.length ? (
            <ChartContainer config={modelConfig} className="aspect-auto h-[320px] w-full">
              <BarChart data={topModels} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => compact(value)} />
                <YAxis
                  type="category"
                  dataKey="model"
                  tickLine={false}
                  axisLine={false}
                  width={132}
                  tickFormatter={(value: string) => (value.length > 20 ? `${value.slice(0, 19)}…` : value)}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                <Bar dataKey="tokens" radius={[0, 4, 4, 0]} fill="var(--color-tokens)">
                  {topModels.map((entry, index) => (
                    <Cell key={entry.model} fill={`var(--chart-${(index % 5) + 1})`} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <EmptyState title="暂无模型数据" description="所选区间内还没有模型调用记录。" icon={BarChart3Icon} />
          )}
        </SectionCard>

        <SectionCard
          title="账号用量"
          description="按账号拆分的请求、Token 与成本。"
          action={<Badge variant="outline">{accountCount} 个账号</Badge>}
        >
          {analytics?.accounts?.length ? (
            <div className="max-h-[340px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>账号</TableHead>
                    <TableHead className="text-right">请求</TableHead>
                    <TableHead className="text-right">Token</TableHead>
                    <TableHead className="text-right">积分</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.accounts
                    .slice()
                    .sort((a, b) => Number(b.window.total_tokens || 0) - Number(a.window.total_tokens || 0))
                    .slice(0, 25)
                    .map((account) => (
                      <TableRow key={account.uid}>
                        <TableCell className="max-w-44">
                          <div className="flex items-center gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{account.nickname}</div>
                              <div className="truncate font-mono text-[11px] text-muted-foreground">
                                {account.uid}
                              </div>
                            </div>
                            <RealmBadge realm={account.realm} />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {fmt(account.window.requests)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {compact(account.window.total_tokens)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-mono text-xs">{fmt(account.window.credit || 0, 1)}</div>
                          {account.window.cost_cny != null ? (
                            <div className="font-mono text-[10px] text-muted-foreground">
                              ¥{fmt(account.window.cost_cny, 3)}
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState title="暂无账号数据" description="所选区间内还没有账号产生用量。" icon={GaugeIcon} />
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="上下文缓存"
        description="缓存复用率越高，等价的输入成本越低。"
        action={
          <Badge variant="secondary" className={cn("gap-1", (summary?.cache_hit_pct || 0) > 0 && "text-success")}>
            <CoinsIcon />
            {pct(summary?.cache_hit_pct || 0)}
          </Badge>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>缓存 Token</span>
              <span className="font-mono text-foreground">{compact(summary?.cached_tokens || 0)}</span>
            </div>
            <Progress value={Number(summary?.cache_hit_pct || 0)} />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>推理 Token</span>
              <span className="font-mono text-foreground">{compact(summary?.reasoning_tokens || 0)}</span>
            </div>
            <Progress value={Number(summary?.reasoning_ratio || 0)} />
          </div>
          <div className="rounded-lg border border-border/70 p-3">
            <div className="text-xs text-muted-foreground">墙钟耗时 P90</div>
            <div className="mt-1 font-mono text-sm">{ms(perf?.wall_ms?.p90)}</div>
          </div>
          <div className="rounded-lg border border-border/70 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangleIcon />
              错误 / 中止
            </div>
            <div className="mt-1 font-mono text-sm">
              {fmt(perf?.errors || 0)} / {fmt(perf?.client_aborted || 0)}
            </div>
          </div>
        </div>
      </SectionCard>
    </PageFrame>
  );
}
