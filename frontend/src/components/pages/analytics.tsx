import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  ActivityIcon,
  AlertTriangleIcon,
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BarChart3Icon,
  ChevronRightIcon,
  CoinsIcon,
  DatabaseIcon,
  GaugeIcon,
  GripVerticalIcon,
  LineChartIcon,
  Maximize2Icon,
  Minimize2Icon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  TimerResetIcon,
  ZapIcon,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import type { AnalyticsRange, DashboardController } from "@/hooks/use-dashboard";
import type { AnalyticsAccount, AnalyticsResponse, TimeseriesResponse, UsageTotals } from "@/lib/types";
import { compact, fmt, ms, pct } from "@/lib/format";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, PageFrame, PageHeader, RealmBadge, SectionCard } from "@/components/shared";

type AnalyticsScope = "window" | "all";
type AnalyticsDimension = "all" | "model" | "account";
type ModuleId =
  | "performance"
  | "request-trend"
  | "token-trend"
  | "model-usage"
  | "account-usage"
  | "cache-detail";

type TrendPoint = TimeseriesResponse["series"][number] & { label: string };
type ModelPoint = { model: string; tokens: number; requests: number; cost: number };

const ORDER_STORE = "wb-analytics-bento-order-v1";
const DEFAULT_ORDER: ModuleId[] = [
  "performance",
  "request-trend",
  "token-trend",
  "model-usage",
  "account-usage",
  "cache-detail",
];

const MODULE_META: Record<
  ModuleId,
  {
    title: string;
    description: string;
    className: string;
    icon: ComponentType<{ className?: string }>;
    expandable?: boolean;
  }
> = {
  performance: {
    title: "性能概览",
    description: "成功率、首字延迟、输出速度与缓存命中。",
    className: "xl:col-span-12",
    icon: GaugeIcon,
  },
  "request-trend": {
    title: "请求趋势",
    description: "按统计桶聚合的请求量与错误量。",
    className: "xl:col-span-6",
    icon: ActivityIcon,
    expandable: true,
  },
  "token-trend": {
    title: "Token 用量",
    description: "总 Token 与上下文缓存命中的趋势。",
    className: "xl:col-span-6",
    icon: ZapIcon,
    expandable: true,
  },
  "model-usage": {
    title: "模型用量",
    description: "所选区间内 Token 消耗最高的模型。",
    className: "xl:col-span-5",
    icon: BarChart3Icon,
    expandable: true,
  },
  "account-usage": {
    title: "账号用量",
    description: "按账号拆分的请求、Token 与成本。",
    className: "xl:col-span-7",
    icon: CoinsIcon,
  },
  "cache-detail": {
    title: "上下文缓存",
    description: "缓存复用率越高，等价的输入成本越低。",
    className: "xl:col-span-12",
    icon: DatabaseIcon,
  },
};

const RANGE_LABEL: Record<AnalyticsRange, string> = {
  today: "今日",
  "7d": "近 7 天",
  "30d": "近 30 天",
  all: "全部",
};

const RANGE_OPTIONS: AnalyticsRange[] = ["today", "7d", "30d", "all"];

const DIMENSION_OPTIONS: { value: AnalyticsDimension; label: string }[] = [
  { value: "all", label: "全部维度" },
  { value: "model", label: "模型名称" },
  { value: "account", label: "账号名称" },
];

const requestConfig = {
  requests: { label: "请求", color: "var(--chart-1)" },
  errors: { label: "错误", color: "var(--destructive)" },
} satisfies ChartConfig;

const tokenConfig = {
  total_tokens: { label: "总 Token", color: "var(--chart-2)" },
  cached_tokens: { label: "缓存 Token", color: "var(--chart-4)" },
} satisfies ChartConfig;

const modelConfig = {
  tokens: { label: "Token", color: "var(--chart-1)" },
} satisfies ChartConfig;

function loadModuleOrder(): ModuleId[] {
  try {
    const stored = JSON.parse(localStorage.getItem(ORDER_STORE) || "[]") as unknown;
    if (!Array.isArray(stored)) return DEFAULT_ORDER;
    const valid = stored.filter(
      (item): item is ModuleId =>
        typeof item === "string" && DEFAULT_ORDER.includes(item as ModuleId),
    );
    const unique = [...new Set(valid)];
    return [...unique, ...DEFAULT_ORDER.filter((item) => !unique.includes(item))];
  } catch {
    return DEFAULT_ORDER;
  }
}

function moveModule(order: ModuleId[], moving: ModuleId, target: ModuleId): ModuleId[] {
  const from = order.indexOf(moving);
  const to = order.indexOf(target);
  if (from < 0 || to < 0 || from === to) return order;
  const next = [...order];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function timeLabel(at: number, range: AnalyticsRange): string {
  const date = new Date(at * 1000);
  if (Number.isNaN(date.getTime())) return String(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (range === "today") return hm;
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${hm}`;
}

function modelRows(analytics?: AnalyticsResponse): ModelPoint[] {
  if (!analytics) return [];
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

function scopeSummary(
  analytics: AnalyticsResponse | undefined,
  scope: AnalyticsScope,
): UsageTotals | undefined {
  if (!analytics) return undefined;
  return scope === "window" ? analytics.summary.window : analytics.summary.all_time;
}

function DeltaMark({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined) return null;
  if (previous === 0) {
    return current > 0 ? <Badge variant="secondary">新增</Badge> : null;
  }
  const delta = ((current - previous) / previous) * 100;
  const positive = delta >= 0;
  const Icon = positive ? ArrowUpRightIcon : ArrowDownRightIcon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-mono text-[10px] tabular-nums",
        positive ? "text-success" : "text-destructive",
      )}
    >
      <Icon />
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

function ComparisonMetric({
  label,
  value,
  current,
  previous,
}: {
  label: string;
  value: string;
  current: number;
  previous?: number;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-muted/35 px-2.5 py-2">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-end justify-between gap-2">
        <span className="truncate font-mono text-xs font-medium tabular-nums">{value}</span>
        <DeltaMark current={current} previous={previous} />
      </div>
    </div>
  );
}

function MetricComparisonTooltip({
  active,
  payload,
  points,
}: {
  active?: boolean;
  payload?: Array<{ payload?: TrendPoint }>;
  points: TrendPoint[];
}) {
  const point = payload?.find((item) => item.payload)?.payload;
  if (!active || !point) return null;

  const index = points.findIndex((item) => item.label === point.label && item.at === point.at);
  const previous = index > 0 ? points[index - 1] : undefined;
  const success = point.requests > 0 ? ((point.requests - point.errors) / point.requests) * 100 : 0;
  const previousSuccess =
    previous && previous.requests > 0
      ? ((previous.requests - previous.errors) / previous.requests) * 100
      : undefined;
  const cache = point.total_tokens > 0 ? (point.cached_tokens / point.total_tokens) * 100 : 0;
  const previousCache =
    previous && previous.total_tokens > 0
      ? (previous.cached_tokens / previous.total_tokens) * 100
      : undefined;

  return (
    <div className="w-72 rounded-xl border border-border/60 bg-popover/95 p-3 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs font-medium">{point.label}</span>
        <Badge variant="outline">时间桶</Badge>
      </div>
      <Separator className="my-2.5" />
      <div className="grid grid-cols-2 gap-2">
        <ComparisonMetric
          label="请求"
          value={fmt(point.requests)}
          current={point.requests}
          previous={previous?.requests}
        />
        <ComparisonMetric
          label="成功率"
          value={pct(success)}
          current={success}
          previous={previousSuccess}
        />
        <ComparisonMetric
          label="总 Token"
          value={compact(point.total_tokens)}
          current={point.total_tokens}
          previous={previous?.total_tokens}
        />
        <ComparisonMetric
          label="缓存率"
          value={pct(cache)}
          current={cache}
          previous={previousCache}
        />
        <ComparisonMetric
          label="积分"
          value={fmt(point.credit, 1)}
          current={point.credit}
          previous={previous?.credit}
        />
        <ComparisonMetric
          label="估算成本"
          value={`¥${fmt(point.cost_cny || 0, 3)}`}
          current={point.cost_cny || 0}
          previous={previous?.cost_cny}
        />
      </div>
    </div>
  );
}

function ModelComparisonTooltip({
  active,
  payload,
  models,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ModelPoint }>;
  models: ModelPoint[];
}) {
  const point = payload?.find((item) => item.payload)?.payload;
  if (!active || !point) return null;
  const rank = models.findIndex((item) => item.model === point.model) + 1;
  const topTokens = models[0]?.tokens || 0;
  const share = topTokens > 0 ? (point.tokens / models.reduce((sum, item) => sum + item.tokens, 0)) * 100 : 0;
  const averageCost = point.requests > 0 ? point.cost / point.requests : 0;

  return (
    <div className="w-64 rounded-xl border border-border/60 bg-popover/95 p-3 shadow-2xl backdrop-blur-xl">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="truncate font-mono text-xs font-medium">{point.model}</span>
        <Badge variant="outline">#{rank}</Badge>
      </div>
      <Separator className="my-2.5" />
      <div className="grid grid-cols-2 gap-2">
        <ComparisonMetric label="Token" value={compact(point.tokens)} current={point.tokens} />
        <ComparisonMetric label="请求" value={fmt(point.requests)} current={point.requests} />
        <ComparisonMetric label="Token 占比" value={pct(share)} current={share} />
        <ComparisonMetric label="单次成本" value={`¥${fmt(averageCost, 4)}`} current={averageCost} />
      </div>
    </div>
  );
}

function ModuleActions({
  module,
  expanded,
  dragging,
  allowDrag,
  onDragStart,
  onDragEnd,
  onMove,
  onToggle,
}: {
  module: ModuleId;
  expanded: boolean;
  dragging: boolean;
  allowDrag: boolean;
  onDragStart: (event: DragEvent<HTMLElement>, module: ModuleId) => void;
  onDragEnd: () => void;
  onMove: (module: ModuleId, direction: -1 | 1) => void;
  onToggle: (module: ModuleId) => void;
}) {
  const meta = MODULE_META[module];

  return (
    <div className="flex items-center gap-1">
      {allowDrag ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              draggable
              className={cn("cursor-grab active:cursor-grabbing", dragging && "bg-accent")}
              aria-label={`拖动${meta.title}模块`}
              onDragStart={(event) => onDragStart(event, module)}
              onDragEnd={onDragEnd}
              onDragOver={(event) => event.preventDefault()}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(event.key)) return;
                event.preventDefault();
                onMove(
                  module,
                  event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1,
                );
              }}
            >
              <GripVerticalIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>拖动或使用方向键调整位置</TooltipContent>
        </Tooltip>
      ) : null}
      {meta.expandable ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={expanded ? `收起${meta.title}` : `放大${meta.title}`}
              onClick={() => onToggle(module)}
            >
              {expanded ? <Minimize2Icon /> : <Maximize2Icon />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{expanded ? "恢复网格" : "原地放大"}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

function MiniTrend({ values, labels }: { values: number[]; labels?: string[] }) {
  const samples = values.slice(-18);
  const max = Math.max(...samples, 1);
  return (
    <div className="flex h-8 items-end gap-0.5">
      {samples.map((value, index) => (
        <span
          key={`${labels?.[index] || index}-${value}`}
          className="min-h-1 flex-1 rounded-sm bg-primary/35"
          style={{ height: `${Math.max(8, (value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

// 筛选切换时的轻量图表骨架，保持模块高度避免整页跳动。
const SKELETON_BARS = [42, 66, 50, 82, 58, 92, 64, 76, 54, 88, 70, 96, 60, 80];

function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex w-full items-end gap-1.5", className)} aria-hidden>
      {SKELETON_BARS.map((height, index) => (
        <Skeleton
          key={index}
          className="flex-1 rounded-sm"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-2.5 w-24" />
          </div>
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="size-4 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function readParam(key: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(key);
  } catch {
    return null;
  }
}

function initialScope(): AnalyticsScope {
  return readParam("scope") === "all" ? "all" : "window";
}

function initialDimension(): AnalyticsDimension {
  const fromUrl = readParam("dimension");
  return fromUrl === "model" || fromUrl === "account" ? fromUrl : "all";
}

export function AnalyticsPage({ dashboard }: { dashboard: DashboardController }) {
  const {
    state,
    analyticsRange,
    setAnalyticsRange,
    setViewRealm,
    refreshAll,
  } = dashboard;
  const analytics = state.analytics;
  const series = state.timeseries?.series || [];
  const perf = state.perf;
  const models = useMemo(() => modelRows(analytics), [analytics]);
  const [scope, setScope] = useState<AnalyticsScope>(initialScope);
  const [dimension, setDimension] = useState<AnalyticsDimension>(initialDimension);
  const [query, setQuery] = useState(() => readParam("q") || "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [moduleOrder, setModuleOrder] = useState<ModuleId[]>(loadModuleOrder);
  const [dragging, setDragging] = useState<ModuleId | null>(null);
  const [overModule, setOverModule] = useState<ModuleId | null>(null);
  const [expandedModule, setExpandedModule] = useState<ModuleId | null>(null);
  const [selectedAccountUid, setSelectedAccountUid] = useState<string | null>(null);
  const [filterPending, setFilterPending] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const overRef = useRef<ModuleId | null>(null);
  const draggingRef = useRef<ModuleId | null>(null);
  const stickyBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(ORDER_STORE, JSON.stringify(moduleOrder));
    } catch {
      // Layout persistence is optional.
    }
  }, [moduleOrder]);

  const chartSeries = useMemo<TrendPoint[]>(
    () => series.map((point) => ({ ...point, label: timeLabel(point.at, analyticsRange) })),
    [series, analyticsRange],
  );
  const summary = scopeSummary(analytics, scope);
  const requests = Number(summary?.requests || 0);
  const errors = Number(summary?.errors || 0);
  const successRate = requests > 0 ? ((requests - errors) / requests) * 100 : 0;
  const accountCount = analytics?.accounts?.length || 0;
  const selectedAccount =
    analytics?.accounts.find((account) => account.uid === selectedAccountUid) || null;

  const sortedAccounts = useMemo(
    () =>
      [...(analytics?.accounts || [])].sort((a, b) => {
        const aValue = scope === "window" ? a.window.total_tokens : a.all_time.total_tokens;
        const bValue = scope === "window" ? b.window.total_tokens : b.all_time.total_tokens;
        return Number(bValue || 0) - Number(aValue || 0);
      }),
    [analytics?.accounts, scope],
  );

  // 关键词搜索 300ms 防抖，避免每次按键都触发过滤与重渲染。
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  // 筛选条件写入 URL 参数，刷新或分享链接都能还原当前视图。
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "analytics");
    url.searchParams.set("range", analyticsRange);
    url.searchParams.set("view", state.viewRealm);
    url.searchParams.set("scope", scope);
    if (dimension === "all") url.searchParams.delete("dimension");
    else url.searchParams.set("dimension", dimension);
    if (debouncedQuery) url.searchParams.set("q", debouncedQuery);
    else url.searchParams.delete("q");
    history.replaceState(null, "", url.toString());
  }, [analyticsRange, state.viewRealm, scope, dimension, debouncedQuery]);

  // KPI / 筛选栏吸顶侦测：滚动到顶部时切换 is-sticky，用于强化吸顶视觉。
  useEffect(() => {
    const bar = stickyBarRef.current;
    if (!bar) return;
    let scroller: HTMLElement | null = bar.parentElement;
    while (scroller && scroller !== document.body) {
      const overflowY = getComputedStyle(scroller).overflowY;
      if ((overflowY === "auto" || overflowY === "scroll") && scroller.scrollHeight > scroller.clientHeight) {
        break;
      }
      scroller = scroller.parentElement;
    }
    const target: HTMLElement | Window = scroller ?? window;
    let raf = 0;
    const update = () => {
      raf = 0;
      const top = target === window ? 0 : (target as HTMLElement).getBoundingClientRect().top;
      setIsSticky(bar.getBoundingClientRect().top <= top + 1);
    };
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };
    update();
    target.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const normalizedQuery = debouncedQuery.toLowerCase();
  const filteredModels = useMemo(() => {
    if (dimension === "account" || !normalizedQuery) return models;
    return models.filter((model) => model.model.toLowerCase().includes(normalizedQuery));
  }, [models, dimension, normalizedQuery]);
  const filteredAccounts = useMemo(() => {
    if (dimension === "model" || !normalizedQuery) return sortedAccounts;
    return sortedAccounts.filter(
      (account) =>
        account.nickname.toLowerCase().includes(normalizedQuery) ||
        account.uid.toLowerCase().includes(normalizedQuery),
    );
  }, [sortedAccounts, dimension, normalizedQuery]);
  const topModels = filteredModels.slice(0, 8);
  const modelCount = filteredModels.length;
  const visibleAccountCount = filteredAccounts.length;
  const loading = filterPending || !analytics;

  const moveByKeyboard = useCallback((module: ModuleId, direction: -1 | 1) => {
    setModuleOrder((current) => {
      const index = current.indexOf(module);
      const target = current[index + direction];
      return target ? moveModule(current, module, target) : current;
    });
  }, []);

  const handleDragStart = useCallback(
    (event: DragEvent<HTMLElement>, module: ModuleId) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", module);
      draggingRef.current = module;
      setDragging(module);
      overRef.current = null;
    },
    [],
  );

  const handleDragEnter = useCallback(
    (target: ModuleId) => {
      const moving = draggingRef.current;
      if (!moving || moving === target || overRef.current === target) return;
      overRef.current = target;
      setOverModule(target);
      setModuleOrder((current) => moveModule(current, moving, target));
    },
    [],
  );

  const finishDrag = useCallback(() => {
    draggingRef.current = null;
    setDragging(null);
    setOverModule(null);
    overRef.current = null;
  }, []);

  const toggleExpanded = useCallback((module: ModuleId) => {
    setExpandedModule((current) => (current === module ? null : module));
  }, []);

  const changeRange = useCallback(
    async (value: string) => {
      if (!value || value === analyticsRange) return;
      setFilterPending(true);
      try {
        await setAnalyticsRange(value as AnalyticsRange);
      } finally {
        setFilterPending(false);
      }
    },
    [analyticsRange, setAnalyticsRange],
  );

  const changeRealm = useCallback(
    async (value: string) => {
      if (!value || value === state.viewRealm) return;
      setFilterPending(true);
      try {
        await setViewRealm(value as "cn" | "intl");
      } finally {
        setFilterPending(false);
      }
    },
    [setViewRealm, state.viewRealm],
  );

  // 首次挂载时按 URL 的 range 参数还原区间，其余情况保持既有的本地默认值。
  useEffect(() => {
    const fromUrl = readParam("range");
    if (!fromUrl || fromUrl === analyticsRange) return;
    if (!RANGE_OPTIONS.includes(fromUrl as AnalyticsRange)) return;
    void changeRange(fromUrl);
    // 只在挂载时对齐一次 URL 与本地状态。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bento 拖拽：从模块标题区（CardHeader）长按拖动，释放后自动吸附让位。
  const dragProps = (module: ModuleId, allowDrag = true) => ({
    draggable: Boolean(allowDrag),
    dragging: dragging === module,
    onDragStart: (event: DragEvent<HTMLElement>) => handleDragStart(event, module),
    onDragEnd: finishDrag,
    onDragOver: (event: DragEvent<HTMLElement>) => event.preventDefault(),
  });

  const chartInteraction = (module: ModuleId) => {
    if (!MODULE_META[module].expandable) return {};
    return {
      role: "button" as const,
      tabIndex: 0,
      "aria-label": expandedModule === module ? `收起${MODULE_META[module].title}` : `放大${MODULE_META[module].title}`,
      onClick: () => toggleExpanded(module),
      onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggleExpanded(module);
      },
    };
  };

  const actions = (module: ModuleId, expanded = false, allowDrag = true) => (
    <ModuleActions
      module={module}
      expanded={expanded}
      dragging={dragging === module}
      allowDrag={allowDrag}
      onDragStart={handleDragStart}
      onDragEnd={finishDrag}
      onMove={moveByKeyboard}
      onToggle={toggleExpanded}
    />
  );

  const renderPerformance = () => (
    <SectionCard
      title={MODULE_META.performance.title}
      description={MODULE_META.performance.description}
      action={actions("performance", false, !expandedModule)}
      {...dragProps("performance", !expandedModule)}
      capped={false}
      className="h-full"
    >
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="text-xs text-muted-foreground">成功调用</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums">{fmt(perf?.success || 0)}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            采样 {fmt(perf?.sampled || 0)} · 中止 {fmt(perf?.client_aborted || 0)}
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="text-xs text-muted-foreground">成功率</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {pct(perf?.success_rate_pct || 0)}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">失败 {fmt(perf?.errors || 0)} 次</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="text-xs text-muted-foreground">首字延迟 P90</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums">{ms(perf?.ttft_ms?.p90)}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            中位 {ms(perf?.ttft_ms?.p50)} · 平均 {ms(perf?.ttft_ms?.avg)}
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="text-xs text-muted-foreground">输出速度</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {fmt(perf?.tokens_per_sec?.avg || 0, 1)} tok/s
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            缓存命中 {pct(perf?.cache_hit_pct?.avg || 0)}
          </div>
        </div>
      </div>
    </SectionCard>
  );

  const renderRequestTrend = (expanded: boolean) => (
    <SectionCard
      title={MODULE_META["request-trend"].title}
      description={MODULE_META["request-trend"].description}
      action={
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-chart-1" />请求
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-destructive" />错误
            </span>
          </div>
          {actions("request-trend", expanded, !expandedModule)}
        </div>
      }
      {...dragProps("request-trend", !expandedModule)}
      capped={false}
      className="h-full"
    >
      {loading ? (
        <ChartSkeleton className={expanded ? "h-[430px]" : "h-[280px]"} />
      ) : chartSeries.length ? (
        <div
          {...chartInteraction("request-trend")}
          className={cn("rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40", !expanded && "cursor-zoom-in")}
        >
          <ChartContainer
            config={requestConfig}
            className={cn("aspect-auto w-full", expanded ? "h-[430px]" : "h-[280px]")}
          >
            <AreaChart data={chartSeries} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="fillRequests" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-requests)" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="var(--color-requests)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="fillErrors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-errors)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-errors)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} />
              <YAxis tickLine={false} axisLine={false} width={34} tickFormatter={(value) => compact(value)} />
              <ChartTooltip
                cursor={false}
                offset={16}
                content={<MetricComparisonTooltip points={chartSeries} />}
              />
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
        </div>
      ) : (
        <EmptyState title="暂无请求数据" description="所选区间内还没有请求记录。" icon={ActivityIcon} />
      )}
    </SectionCard>
  );

  const renderTokenTrend = (expanded: boolean) => (
    <SectionCard
      title={MODULE_META["token-trend"].title}
      description={MODULE_META["token-trend"].description}
      action={
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-chart-2" />总 Token
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-chart-4" />缓存
            </span>
          </div>
          {actions("token-trend", expanded, !expandedModule)}
        </div>
      }
      {...dragProps("token-trend", !expandedModule)}
      capped={false}
      className="h-full"
    >
      {loading ? (
        <ChartSkeleton className={expanded ? "h-[430px]" : "h-[280px]"} />
      ) : chartSeries.length ? (
        <div
          {...chartInteraction("token-trend")}
          className={cn("rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40", !expanded && "cursor-zoom-in")}
        >
          <ChartContainer
            config={tokenConfig}
            className={cn("aspect-auto w-full", expanded ? "h-[430px]" : "h-[280px]")}
          >
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
              <ChartTooltip
                cursor={false}
                offset={16}
                content={<MetricComparisonTooltip points={chartSeries} />}
              />
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
        </div>
      ) : (
        <EmptyState title="暂无 Token 数据" description="所选区间内还没有 Token 消耗。" icon={ZapIcon} />
      )}
    </SectionCard>
  );

  const renderModelUsage = (expanded: boolean) => (
    <SectionCard
      title={MODULE_META["model-usage"].title}
      description={MODULE_META["model-usage"].description}
      action={
        <div className="flex items-center gap-2">
          <Badge variant="outline">{modelCount} 个模型</Badge>
          {actions("model-usage", expanded, !expandedModule)}
        </div>
      }
      {...dragProps("model-usage", !expandedModule)}
      capped={false}
      className="h-full"
    >
      {loading ? (
        <ChartSkeleton className={expanded ? "h-[430px]" : "h-[320px]"} />
      ) : topModels.length ? (
        <div
          {...chartInteraction("model-usage")}
          className={cn("rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40", !expanded && "cursor-zoom-in")}
        >
          <ChartContainer
            config={modelConfig}
            className={cn("aspect-auto w-full", expanded ? "h-[430px]" : "h-[320px]")}
          >
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
              <ChartTooltip
                cursor={false}
                offset={16}
                content={<ModelComparisonTooltip models={topModels} />}
              />
              <Bar dataKey="tokens" radius={[0, 4, 4, 0]} fill="var(--color-tokens)">
                {topModels.map((entry, index) => (
                  <Cell key={entry.model} fill={`var(--chart-${(index % 5) + 1})`} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      ) : (
        <EmptyState title="暂无模型数据" description="所选区间内还没有模型调用记录。" icon={BarChart3Icon} />
      )}
    </SectionCard>
  );

  const renderAccounts = () => (
    <SectionCard
      title={MODULE_META["account-usage"].title}
      description={MODULE_META["account-usage"].description}
      action={
        <div className="flex items-center gap-2">
          <Badge variant="outline">{visibleAccountCount} 个账号</Badge>
          {actions("account-usage", false, !expandedModule)}
        </div>
      }
      {...dragProps("account-usage", !expandedModule)}
      capped={false}
      className="h-full"
    >
      {loading ? (
        <TableSkeleton rows={7} />
      ) : filteredAccounts.length ? (
        <div className={cn("overflow-auto", expandedModule ? "max-h-[430px]" : "max-h-[340px]")}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>账号</TableHead>
                <TableHead className="text-right">请求</TableHead>
                <TableHead className="text-right">Token</TableHead>
                <TableHead className="text-right">积分</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.slice(0, 25).map((account) => {
                const usage = scope === "window" ? account.window : account.all_time;
                return (
                  <TableRow
                    key={account.uid}
                    role="button"
                    tabIndex={0}
                    aria-label={`查看${account.nickname}的用量详情`}
                    className="cursor-pointer outline-none focus-visible:bg-accent/60"
                    onClick={() => setSelectedAccountUid(account.uid)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      setSelectedAccountUid(account.uid);
                    }}
                  >
                    <TableCell className="max-w-48">
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
                      {fmt(usage.requests)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {compact(usage.total_tokens)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono text-xs">{fmt(usage.credit || 0, 1)}</div>
                      {usage.cost_cny != null ? (
                        <div className="font-mono text-[10px] text-muted-foreground">
                          ¥{fmt(usage.cost_cny, 3)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <ChevronRightIcon className="text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          title="暂无账号数据"
          description={
            normalizedQuery
              ? "没有账号匹配当前关键词，试试更换筛选词。"
              : "所选区间内还没有账号产生用量。"
          }
          icon={GaugeIcon}
        />
      )}
    </SectionCard>
  );

  const renderCache = () => (
    <SectionCard
      title={MODULE_META["cache-detail"].title}
      description={MODULE_META["cache-detail"].description}
      action={
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={cn("gap-1", (summary?.cache_hit_pct || 0) > 0 && "text-success")}>
            <CoinsIcon />
            {pct(summary?.cache_hit_pct || 0)}
          </Badge>
          {actions("cache-detail", false, !expandedModule)}
        </div>
      }
      {...dragProps("cache-detail", !expandedModule)}
      capped={false}
      className="h-full"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>缓存 Token</span>
            <span className="font-mono text-foreground">{compact(summary?.cached_tokens || 0)}</span>
          </div>
          <Progress value={Number(summary?.cache_hit_pct || 0)} />
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>推理 Token</span>
            <span className="font-mono text-foreground">{compact(summary?.reasoning_tokens || 0)}</span>
          </div>
          <Progress value={Number(summary?.reasoning_ratio || 0)} />
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="text-xs text-muted-foreground">墙钟耗时 P90</div>
          <div className="mt-1 font-mono text-sm">{ms(perf?.wall_ms?.p90)}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
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
  );

  const renderModule = (module: ModuleId, expanded = false) => {
    switch (module) {
      case "performance":
        return renderPerformance();
      case "request-trend":
        return renderRequestTrend(expanded);
      case "token-trend":
        return renderTokenTrend(expanded);
      case "model-usage":
        return renderModelUsage(expanded);
      case "account-usage":
        return renderAccounts();
      case "cache-detail":
        return renderCache();
    }
  };

  const thumbnailContent = (module: ModuleId) => {
    switch (module) {
      case "performance":
        return { value: pct(perf?.success_rate_pct || 0), detail: `${ms(perf?.ttft_ms?.p90)} · ${fmt(perf?.tokens_per_sec?.avg || 0, 1)} tok/s` };
      case "request-trend":
        return {
          value: compact(requests),
          detail: `错误 ${fmt(errors)}`,
          values: chartSeries.map((point) => point.requests),
          labels: chartSeries.map((point) => point.label),
        };
      case "token-trend":
        return {
          value: compact(summary?.total_tokens || 0),
          detail: `缓存 ${pct(summary?.cache_hit_pct || 0)}`,
          values: chartSeries.map((point) => point.total_tokens),
          labels: chartSeries.map((point) => point.label),
        };
      case "model-usage":
        return { value: `${modelCount} 个模型`, detail: topModels[0]?.model || "暂无模型数据" };
      case "account-usage":
        return { value: `${visibleAccountCount} 个账号`, detail: `请求 ${compact(requests)}` };
      case "cache-detail":
        return {
          value: pct(summary?.cache_hit_pct || 0),
          detail: `${compact(summary?.cached_tokens || 0)} 缓存 Token`,
        };
    }
  };

  const resetLayout = () => {
    setModuleOrder(DEFAULT_ORDER);
    setExpandedModule(null);
  };

  const refresh = async () => {
    setFilterPending(true);
    try {
      await refreshAll();
    } finally {
      setFilterPending(false);
    }
  };

  const stickyMetrics = [
    { label: `${RANGE_LABEL[analyticsRange]}请求`, value: compact(requests), detail: `错误 ${fmt(errors)}` },
    { label: "成功率", value: pct(successRate), detail: `成功 ${fmt(requests - errors)}` },
    {
      label: "Token",
      value: compact(summary?.total_tokens || 0),
      detail: `缓存 ${pct(summary?.cache_hit_pct || 0)}`,
    },
    {
      label: "积分",
      value: fmt(summary?.credit || 0, 1),
      detail: `¥${fmt(summary?.cost_cny || 0, 3)}`,
    },
    {
      label: "覆盖账号",
      value: fmt(visibleAccountCount),
      detail: normalizedQuery ? `共 ${accountCount} 个` : `${modelCount} 个模型`,
    },
  ];

  return (
    <PageFrame>
      <PageHeader
        title="用量分析"
        description="按时间窗聚合的请求、Token、成本与性能指标，全部来自网关实时统计。"
        icon={LineChartIcon}
        actions={<Badge variant="outline">{state.viewRealm === "cn" ? "国内版" : "国际版"}</Badge>}
      />

      <div
        ref={stickyBarRef}
        className={cn(
          "analytics-filterbar sticky top-0 z-30 -mx-3 border-b border-border/60 bg-content/85 px-3 py-2 backdrop-blur-xl sm:-mx-4 lg:-mx-5",
          isSticky && "is-sticky",
        )}
      >
        <div className="glass-panel overflow-hidden rounded-xl border border-border/60">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <div className="mr-1 flex items-center gap-2 text-xs font-medium">
              <SlidersHorizontalIcon className="text-primary" />
              全局筛选
            </div>
            <ToggleGroup
              type="single"
              size="sm"
              spacing={2}
              value={analyticsRange}
              onValueChange={(value) => void changeRange(value)}
              aria-label="分析时间范围"
            >
              {RANGE_OPTIONS.map((range) => (
                <ToggleGroupItem key={range} value={range} className="px-2 text-xs">
                  {RANGE_LABEL[range]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <ToggleGroup
              type="single"
              size="sm"
              spacing={2}
              value={state.viewRealm}
              onValueChange={(value) => void changeRealm(value)}
              aria-label="分析数据区域"
            >
              <ToggleGroupItem value="cn" className="px-2 text-xs">国内版</ToggleGroupItem>
              <ToggleGroupItem value="intl" className="px-2 text-xs">国际版</ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              type="single"
              size="sm"
              spacing={2}
              value={scope}
              onValueChange={(value) => value && setScope(value as AnalyticsScope)}
              aria-label="汇总口径"
            >
              <ToggleGroupItem value="window" className="px-2 text-xs">窗口</ToggleGroupItem>
              <ToggleGroupItem value="all" className="px-2 text-xs">全部</ToggleGroupItem>
            </ToggleGroup>
            <Select value={dimension} onValueChange={(value) => setDimension(value as AnalyticsDimension)}>
              <SelectTrigger size="sm" className="w-32" aria-label="筛选维度">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {DIMENSION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <InputGroup className="w-full sm:w-56">
              <InputGroupInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索模型或账号"
                aria-label="关键词搜索"
              />
              <InputGroupAddon align="inline-end">
                <SearchIcon />
              </InputGroupAddon>
            </InputGroup>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={resetLayout}>
                <RotateCcwIcon data-icon="inline-start" />
                重置布局
              </Button>
              <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={filterPending}>
                {filterPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <RefreshCwIcon data-icon="inline-start" />
                )}
                刷新
              </Button>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-2 p-2 md:grid-cols-5">
            {stickyMetrics.map((metric) => (
              <div key={metric.label} className="min-w-0 rounded-lg border border-border/50 bg-card/70 px-3 py-2">
                <div className="truncate text-[10px] text-muted-foreground">{metric.label}</div>
                <div className="mt-0.5 flex items-baseline justify-between gap-2">
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      key={`${metric.label}-${metric.value}`}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.16 }}
                      className="truncate font-mono text-sm font-semibold tabular-nums"
                    >
                      {metric.value}
                    </motion.span>
                  </AnimatePresence>
                  <span className="truncate text-[10px] text-muted-foreground">{metric.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <LayoutGroup>
        {expandedModule ? (
          <motion.div layout className="flex flex-col gap-3">
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.22 }}
            >
              {renderModule(expandedModule, true)}
            </motion.div>
            <div className="flex flex-col gap-2">
              <div className="px-1 text-xs font-medium text-muted-foreground">其他模块</div>
              <div className="scroll-fade-x flex gap-2 overflow-x-auto pb-1">
                {moduleOrder
                  .filter((module) => module !== expandedModule)
                  .map((module) => {
                    const meta = MODULE_META[module];
                    const Icon = meta.icon;
                    const content = thumbnailContent(module);
                    const canExpand = Boolean(meta.expandable);
                    return (
                      <motion.div
                        key={module}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-[220px] shrink-0 sm:w-[240px]"
                      >
                        <Button
                          type="button"
                          variant="outline"
                          className="h-auto min-h-24 w-full justify-start overflow-hidden px-3 py-3 text-left transition-colors duration-200 ease-out"
                          onClick={() => (canExpand ? setExpandedModule(module) : setExpandedModule(null))}
                        >
                          <Icon data-icon="inline-start" />
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-medium">{meta.title}</span>
                              <span className="truncate font-mono text-xs tabular-nums">{content.value}</span>
                            </span>
                            <span className="truncate text-[10px] font-normal text-muted-foreground">{content.detail}</span>
                            {content.values?.length ? (
                              <MiniTrend values={content.values} labels={content.labels} />
                            ) : null}
                          </span>
                        </Button>
                      </motion.div>
                    );
                  })}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 items-stretch gap-3 [grid-auto-flow:dense] xl:grid-cols-12"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {moduleOrder.map((module) => {
                const meta = MODULE_META[module];
                return (
                  <motion.div
                    key={module}
                    layout
                    initial={{ opacity: 0, scale: 0.985 }}
                    animate={{
                      opacity: 1,
                      scale: dragging === module ? 1.012 : 1,
                      y: dragging === module ? -3 : 0,
                    }}
                    exit={{ opacity: 0, scale: 0.985 }}
                    transition={{ duration: 0.2, layout: { duration: 0.24, type: "spring", bounce: 0.12 } }}
                    onDragEnter={() => handleDragEnter(module)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={finishDrag}
                    className={cn(
                      "relative min-w-0 transition-shadow duration-200 ease-out",
                      meta.className,
                      dragging === module && "z-20 shadow-2xl",
                      overModule === module && dragging !== module && "ring-2 ring-primary/30",
                    )}
                  >
                    {renderModule(module)}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </LayoutGroup>

      {selectedAccount ? (
        <AccountDetailSheet
          account={selectedAccount}
          scope={scope}
          onOpenChange={(open) => {
            if (!open) setSelectedAccountUid(null);
          }}
        />
      ) : null}
    </PageFrame>
  );
}

function AccountDetailSheet({
  account,
  scope,
  onOpenChange,
}: {
  account: AnalyticsAccount;
  scope: AnalyticsScope;
  onOpenChange: (open: boolean) => void;
}) {
  const usage = scope === "window" ? account.window : account.all_time;
  const modelSource = scope === "window" ? account.window_models : account.all_models;
  const accountModels = Object.entries(modelSource || {})
    .map(([model, value]) => ({
      model,
      tokens: Number(value.tokens || 0),
      requests: Number(value.requests || 0),
      cost: Number(value.cost_cny || 0),
    }))
    .sort((a, b) => b.tokens - a.tokens);
  const maxModelTokens = accountModels[0]?.tokens || 1;
  const creditSize = Number(account.credits?.size || 0);
  const creditUsed = Number(account.credits?.used || 0);
  const creditPercent = creditSize > 0 ? Math.min(100, (creditUsed / creditSize) * 100) : 0;

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-hidden sm:max-w-xl">
        <SheetHeader className="border-b border-border/60 px-4 py-4 pr-12">
          <div className="flex items-start gap-3">
            <div className="glass-panel flex size-10 shrink-0 items-center justify-center rounded-lg text-primary">
              <CoinsIcon />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <SheetTitle className="truncate">{account.nickname}</SheetTitle>
                <RealmBadge realm={account.realm} />
              </div>
              <SheetDescription className="mt-1 truncate font-mono">{account.uid}</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <DetailMetric label="请求" value={fmt(usage.requests)} />
            <DetailMetric label="Token" value={compact(usage.total_tokens)} />
            <DetailMetric label="积分" value={fmt(usage.credit || 0, 1)} />
            <DetailMetric label="成本" value={`¥${fmt(usage.cost_cny || 0, 3)}`} />
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">缓存命中率</div>
                <div className="mt-1 font-mono text-lg font-semibold">{pct(usage.cache_hit_pct || 0)}</div>
              </div>
              <Badge variant="secondary">{compact(usage.cached_tokens)} 缓存 Token</Badge>
            </div>
            <Progress className="mt-3" value={Number(usage.cache_hit_pct || 0)} />
          </div>

          {account.credits ? (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">积分额度</div>
                <Badge variant={account.credits.is_paid_user ? "default" : "outline"}>
                  {account.credits.is_paid_user ? "付费" : "基础"}
                </Badge>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="font-mono text-xl font-semibold">{fmt(account.credits.remain, 1)}</div>
                <div className="text-xs text-muted-foreground">已用 {fmt(account.credits.used, 1)} / {fmt(creditSize, 1)}</div>
              </div>
              <Progress className="mt-3" value={creditPercent} />
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">模型用量</div>
              <Badge variant="outline">{accountModels.length} 个</Badge>
            </div>
            {accountModels.length ? (
              <div className="flex flex-col gap-2">
                {accountModels.slice(0, 8).map((model) => (
                  <div key={model.model} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-xs font-medium">{model.model}</div>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          {fmt(model.requests)} 请求 · ¥{fmt(model.cost, 3)}
                        </div>
                      </div>
                      <div className="font-mono text-xs tabular-nums">{compact(model.tokens)}</div>
                    </div>
                    <Progress className="mt-2" value={(model.tokens / maxModelTokens) * 100} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="暂无模型数据" description="该账号在所选口径内没有模型调用。" icon={BarChart3Icon} />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
