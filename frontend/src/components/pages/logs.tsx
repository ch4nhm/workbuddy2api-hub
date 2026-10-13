import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLineIcon,
  RefreshCwIcon,
  ScrollTextIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import type { DashboardController } from "@/hooks/use-dashboard";
import type { LogRow } from "@/lib/types";
import { performAction } from "@/lib/action";
import { cn } from "cn";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState, PageFrame, PageHeader, SectionCard } from "@/components/shared";

type LevelFilter = "all" | "info" | "warn" | "error";

const LEVEL_OPTIONS: Array<{ value: LevelFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "info", label: "信息" },
  { value: "warn", label: "警告" },
  { value: "error", label: "错误" },
];

function levelGroup(level: string): Exclude<LevelFilter, "all"> {
  const value = (level || "").toUpperCase();
  if (value.startsWith("ERR") || value.startsWith("CRIT") || value.startsWith("FATAL")) return "error";
  if (value.startsWith("WARN")) return "warn";
  return "info";
}

function levelClass(level: string): string {
  switch (levelGroup(level)) {
    case "error":
      return "text-destructive";
    case "warn":
      return "text-warning";
    default:
      return "text-muted-foreground";
  }
}

export function LogsPage({ dashboard }: { dashboard: DashboardController }) {
  const { state } = dashboard;
  const [level, setLevel] = useState<LevelFilter>("all");
  const [tag, setTag] = useState("all");
  const [query, setQuery] = useState("");
  const [auto, setAuto] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);

  const logs = state.logs?.logs || [];

  const tags = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((row) => row.tag && set.add(row.tag));
    return [...set].sort();
  }, [logs]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return logs
      .filter((row) => level === "all" || levelGroup(row.level) === level)
      .filter((row) => tag === "all" || row.tag === tag)
      .filter((row) => !needle || row.msg.toLowerCase().includes(needle) || row.tag.toLowerCase().includes(needle))
      .slice()
      .sort((a, b) => a.id - b.id);
  }, [logs, level, tag, query]);

  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void dashboard.loadLogs(300).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [auto, dashboard]);

  async function refresh() {
    setRefreshing(true);
    try {
      await dashboard.loadLogs(300);
    } finally {
      setRefreshing(false);
    }
  }

  async function clear() {
    setClearing(true);
    try {
      await performAction("/logs/clear", {}, "日志已清空");
      await dashboard.loadLogs(300);
    } catch {
      // performAction already surfaced the failure toast.
    } finally {
      setClearing(false);
    }
  }

  const counts = useMemo(() => {
    const base = { info: 0, warn: 0, error: 0 };
    logs.forEach((row) => {
      base[levelGroup(row.level)] += 1;
    });
    return base;
  }, [logs]);

  return (
    <PageFrame>
      <PageHeader
        title="运行日志"
        description="网关按时间顺序记录的事件流，支持级别、来源与关键字过滤。"
        icon={ScrollTextIcon}
        actions={
          <>
            <div className="glass-panel flex items-center gap-2 rounded-lg px-2.5 py-1.5">
              <span className="text-xs text-muted-foreground">自动刷新</span>
              <Switch size="sm" checked={auto} onCheckedChange={setAuto} />
            </div>
            <Button variant="outline" size="sm" disabled={refreshing} onClick={() => void refresh()}>
              {refreshing ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              刷新
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={clearing}>
                  <Trash2Icon data-icon="inline-start" />
                  清空
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>清空运行日志？</AlertDialogTitle>
                  <AlertDialogDescription>
                    将清空当前日志缓冲区。用量统计、账号与设置数据不受影响，但已清空的日志无法恢复。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={(event) => {
                      event.preventDefault();
                      void clear();
                    }}
                  >
                    确认清空
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1.5">
          <ArrowDownToLineIcon />
          共 {state.logs?.total ?? logs.length} 条
        </Badge>
        <Badge variant="outline" className="text-muted-foreground">
          信息 {counts.info}
        </Badge>
        <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
          警告 {counts.warn}
        </Badge>
        <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
          错误 {counts.error}
        </Badge>
      </div>

      <SectionCard
        title="事件流"
        description="最新事件排在最下方，自动刷新开启时每 5 秒同步一次。"
        capped={false}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ToggleGroup
              type="single"
              size="sm"
              spacing={2}
              value={level}
              onValueChange={(value) => value && setLevel(value as LevelFilter)}
              aria-label="日志级别"
            >
              {LEVEL_OPTIONS.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value} className="px-2 text-xs">
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger size="sm" className="w-32">
                <SelectValue placeholder="来源" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">全部来源</SelectItem>
                  {tags.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        }
      >
        <InputGroup className="mb-3">
          <InputGroupAddon align="inline-start">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索日志内容或来源…"
          />
        </InputGroup>

        {filtered.length ? (
          <div className="log-terminal max-h-[calc(100svh-22rem)] min-h-72 overflow-auto rounded-lg border border-border/70 p-3 font-mono text-xs leading-relaxed">
            {filtered.map((row: LogRow) => (
              <div
                key={row.id}
                className="group flex gap-3 rounded px-2 py-0.5 transition-colors hover:bg-muted/50"
              >
                <span className="shrink-0 text-muted-foreground/70">{row.time || row.ts}</span>
                <span className={cn("w-12 shrink-0 font-semibold uppercase", levelClass(row.level))}>
                  {row.level}
                </span>
                <span className="shrink-0 text-primary/80">[{row.tag}]</span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-foreground/90">
                  {row.msg}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="没有匹配的日志"
            description="调整级别、来源或搜索关键词；也可以先刷新日志缓冲区。"
            icon={ScrollTextIcon}
            action={
              <Button variant="outline" onClick={() => void refresh()}>
                <RefreshCwIcon data-icon="inline-start" />
                刷新日志
              </Button>
            }
          />
        )}
      </SectionCard>
    </PageFrame>
  );
}
