import { useState } from "react";
import { motion } from "motion/react";
import {
  BatteryChargingIcon,
  CalendarCheckIcon,
  CheckCircle2Icon,
  DicesIcon,
  FlameIcon,
  GiftIcon,
  ListChecksIcon,
  MapPinIcon,
  PlayIcon,
  RefreshCwIcon,
  RouteIcon,
  TicketIcon,
  TimerIcon,
  TriangleAlertIcon,
  ZapIcon,
} from "lucide-react";
import type { DashboardController } from "@/hooks/use-dashboard";
import type { GrowthTask } from "@/lib/types";
import { ACTIVITY_TASK_LABEL, ACTIVITY_TRIGGER_LABEL, fmt, formatTime } from "@/lib/format";
import { performAction } from "@/lib/action";
import { cn } from "cn";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  EmptyState,
  MetricCard,
  PageFrame,
  PageHeader,
  RealmBadge,
  SectionCard,
  StatusBadge,
} from "@/components/shared";

interface TravelInfo {
  state?: string;
  reward_credit?: number;
  location?: { name?: string };
  daily_limit_reached?: boolean;
  ends_at?: string;
  started_at?: string;
}

const TASK_STATUS: Record<string, { label: string; active: boolean; warning?: boolean }> = {
  completed: { label: "已完成", active: true },
  claimed: { label: "已领取", active: true },
  accepted: { label: "进行中", active: true, warning: true },
  in_progress: { label: "进行中", active: false },
  not_accepted: { label: "未完成", active: false },
};

const TASK_TYPE_LABEL: Record<string, string> = {
  single: "单次任务",
  auto: "自动任务",
};

const TRAVEL_STATE_LABEL: Record<string, string> = {
  arrived: "已到达",
  traveling: "旅行中",
  idle: "等待出发",
};

function taskStatus(task: GrowthTask) {
  return TASK_STATUS[task.status] || { label: task.status || "未知", active: false };
}

function taskProgress(task: GrowthTask): number {
  const target = Number(task.target) || 0;
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, (Number(task.current) / target) * 100));
}

function TaskCard({ task, index }: { task: GrowthTask; index: number }) {
  const status = taskStatus(task);
  const target = Number(task.target) || 0;
  const showProgress = target > 1;
  const progress = taskProgress(task);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, transition: { duration: 0.16 } }}
      transition={{ delay: Math.min(index * 0.02, 0.24), duration: 0.2, ease: "easeOut" }}
      className="h-full"
    >
      <Card size="sm" className="h-full border-border/60">
        <CardHeader className="gap-2.5">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                status.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
              )}
            >
              {status.active ? (
                <CheckCircle2Icon className="size-4" />
              ) : (
                <ListChecksIcon className="size-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="min-w-0 flex-1 truncate">{task.name}</CardTitle>
                <StatusBadge
                  active={status.active}
                  activeText={status.label}
                  inactiveText={status.label}
                  warning={status.warning}
                />
              </div>
              <CardDescription className="mt-1 line-clamp-2 text-xs leading-5">
                {task.description || task.task_code}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="mt-auto flex flex-col gap-3">
          {showProgress ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">进度</span>
                <span className="font-mono text-foreground">
                  {fmt(task.current)} / {fmt(target)}
                </span>
              </div>
              <Progress value={progress} />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {task.task_type ? (
              <span className="inline-flex items-center gap-1">
                <ListChecksIcon className="size-3.5" />
                {TASK_TYPE_LABEL[task.task_type] || task.task_type}
              </span>
            ) : null}
            {Number(task.reward_credit) > 0 ? (
              <span className="inline-flex items-center gap-1">
                <GiftIcon className="size-3.5 text-primary" />
                {fmt(task.reward_credit)} 积分
              </span>
            ) : null}
            {Number(task.reward_energy) > 0 ? (
              <span className="inline-flex items-center gap-1">
                <ZapIcon className="size-3.5 text-warning" />
                {fmt(task.reward_energy)} 能量
              </span>
            ) : null}
          </div>

          {task.reason ? (
            <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/80">
              {task.reason}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function TasksPage({ dashboard }: { dashboard: DashboardController }) {
  const { state } = dashboard;
  const [uid, setUid] = useState("all");
  const [busy, setBusy] = useState("");

  const tasks = state.tasks?.tasks || [];
  const summary = state.tasks?.summary;
  const travel = summary?.travel as TravelInfo | undefined;
  const accounts = state.tasks?.accounts || [];
  const activity = state.activity?.rows || [];

  const completedCount = tasks.filter((task) => taskStatus(task).active).length;
  const claimable = tasks.reduce((total, task) => total + Number(task.reward_credit || 0), 0);

  async function run(key: string, url: string, body: unknown, message: string) {
    setBusy(key);
    try {
      await performAction(url, body, message);
      await Promise.allSettled([dashboard.loadTasks(uid), dashboard.loadScheduler(), dashboard.loadUsage()]);
    } catch {
      // performAction already surfaced the failure toast.
    } finally {
      setBusy("");
    }
  }

  async function changeAccount(value: string) {
    setUid(value);
    await dashboard.loadTasks(value);
  }

  const scope = uid === "all" ? {} : { uid };

  return (
    <PageFrame>
      <PageHeader
        title="成长任务"
        description="签到、每日活跃、猫猫旅行与连签奖励的执行状态，数据实时读取上游。"
        icon={ListChecksIcon}
        actions={
          <>
            <Select value={uid} onValueChange={(value) => void changeAccount(value)}>
              <SelectTrigger size="sm" className="w-44">
                <SelectValue placeholder="选择账号" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">全部账号</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.uid} value={account.uid}>
                      {account.nickname}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={Boolean(busy)}
              onClick={() => void run("refresh", "/tasks/run", scope, "任务已重新执行")}
            >
              {busy === "refresh" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              刷新任务
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="当前能量"
          value={fmt(summary?.energy || 0)}
          detail={`${completedCount}/${tasks.length} 项任务已达成`}
          icon={BatteryChargingIcon}
          tone="success"
        />
        <MetricCard
          label="连续签到"
          value={`${fmt(summary?.streak_days || 0)} 天`}
          detail={`补签卡 ${fmt(summary?.makeup_cards || 0)} 张`}
          icon={FlameIcon}
          tone="warning"
        />
        <MetricCard
          label="抽奖机会"
          value={fmt(summary?.lottery_chances || 0)}
          detail="完成成长任务后自动累积"
          icon={DicesIcon}
        />
        <MetricCard
          label="可领积分"
          value={fmt(claimable)}
          detail="当前范围内任务奖励合计"
          icon={GiftIcon}
        />
      </div>

      <div className="grid items-stretch gap-4 xl:grid-cols-2">
        <SectionCard
          title="猫猫旅行"
          description="按日推进的旅行任务与奖励状态。"
          className="h-full"
          action={
            <Button
              size="sm"
              disabled={Boolean(busy)}
              onClick={() => void run("travel", "/tasks/travel", scope, "旅行任务已提交")}
            >
              {busy === "travel" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RouteIcon data-icon="inline-start" />
              )}
              出发
            </Button>
          }
        >
          <div className="flex h-full flex-col gap-3">
            <div className="glass-panel flex items-center gap-3 rounded-lg border border-border/60 p-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPinIcon />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {travel?.location?.name || "目的地待定"}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {TRAVEL_STATE_LABEL[travel?.state || ""] || travel?.state || "未开始"}
                </div>
              </div>
              {Number(travel?.reward_credit) > 0 ? (
                <Badge variant="secondary" className="gap-1">
                  <GiftIcon />
                  {fmt(travel?.reward_credit)} 积分
                </Badge>
              ) : null}
            </div>

            {travel?.daily_limit_reached ? (
              <Alert className="border-warning/30 bg-warning/10 text-warning">
                <TriangleAlertIcon />
                <AlertTitle>今日旅行次数已用完</AlertTitle>
                <AlertDescription className="text-warning/80">
                  明天可以继续推进旅行任务。
                </AlertDescription>
              </Alert>
            ) : null}

            {travel?.started_at || travel?.ends_at ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">开始时间</div>
                  <div className="mt-1 font-mono text-sm">
                    {formatTime(travel?.started_at, true)}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">结束时间</div>
                  <div className="mt-1 font-mono text-sm">
                    {formatTime(travel?.ends_at, true)}
                  </div>
                </div>
              </div>
            ) : null}

            <Button
              variant="outline"
              className="mt-auto w-full"
              disabled={Boolean(busy)}
              onClick={() => void run("streak", "/tasks/streak-bonus", scope, "连签奖励已领取")}
            >
              {busy === "streak" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <FlameIcon data-icon="inline-start" />
              )}
              领取连签奖励
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="自动排程"
          description="后台巡检器的运行状态与最近一次执行结果。"
          className="h-full"
          action={
            <StatusBadge
              active={Boolean(state.scheduler?.enabled)}
              activeText="运行中"
              inactiveText="已暂停"
            />
          }
        >
          <div className="flex h-full flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TimerIcon />
                  下次运行
                </div>
                <div className="mt-1.5 font-mono text-sm">{state.scheduler?.next_run_time || "—"}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarCheckIcon />
                  最近运行
                </div>
                <div className="mt-1.5 font-mono text-sm">{state.scheduler?.last_run_time || "—"}</div>
              </div>
            </div>
            {state.scheduler?.mode ? (
              <div className="rounded-lg border border-border/60 bg-muted/25 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                {state.scheduler.mode}
              </div>
            ) : null}
            <div className="mt-auto flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={Boolean(busy)}
                onClick={() => void run("toggle", "/scheduler/toggle", {}, state.scheduler?.enabled ? "排程器已暂停" : "排程器已启动")}
              >
                {state.scheduler?.enabled ? "暂停排程" : "启动排程"}
              </Button>
              <Button
                disabled={Boolean(busy)}
                onClick={() => void run("trigger", "/scheduler/trigger", {}, "已触发一次巡检")}
              >
                {busy === "trigger" ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <PlayIcon data-icon="inline-start" />
                )}
                立即巡检
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="任务清单"
        description={`当前范围内已完成 ${completedCount}/${tasks.length} 项，任务奖励合计 ${fmt(claimable)} 积分。`}
        action={
          <Button
            size="sm"
            disabled={Boolean(busy)}
            onClick={() => void run("run", "/tasks/run", scope, "任务已开始执行")}
          >
            {busy === "run" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ZapIcon data-icon="inline-start" />
            )}
            一键做任务领积分
          </Button>
        }
      >
        {tasks.length ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-primary/15 bg-primary/5 p-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ListChecksIcon />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium">任务完成进度</span>
                  <span className="font-mono text-muted-foreground">
                    {completedCount}/{tasks.length}
                  </span>
                </div>
                <Progress
                  className="mt-2"
                  value={tasks.length ? (completedCount / tasks.length) * 100 : 0}
                />
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {tasks.map((task, index) => (
                <TaskCard key={task.task_code} task={task} index={index} />
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            title="暂无任务数据"
            description="选择一个账号或稍后刷新，任务清单会从上游实时同步。"
            icon={ListChecksIcon}
            action={
              <Button variant="outline" onClick={() => void dashboard.loadTasks(uid)}>
                <RefreshCwIcon data-icon="inline-start" />
                重新加载
              </Button>
            }
          />
        )}
      </SectionCard>

      <SectionCard
        title="执行记录"
        description="今日签到、活跃与旅行等后台动作的结果。"
        action={<Badge variant="outline">{state.activity?.total || 0} 条</Badge>}
      >
        {activity.length ? (
          <div className="flex flex-col gap-3">
            {activity.slice(0, 12).map((row, index) => (
              <div
                key={`${row.ts}-${row.uid}-${row.task}-${index}`}
                className="grid gap-3 rounded-lg border border-border/60 bg-background/50 p-3 sm:grid-cols-[auto_1fr_auto]"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    row.ok
                      ? "bg-success/10 text-success"
                      : "bg-destructive/10 text-destructive",
                  )}
                >
                  {row.ok ? <CheckCircle2Icon /> : <TriangleAlertIcon />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {row.nickname || row.uid.slice(0, 8)}
                    </span>
                    <RealmBadge realm={row.realm} />
                    <Badge variant="secondary" className="text-[10px]">
                      {ACTIVITY_TASK_LABEL[row.task] || row.task}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {ACTIVITY_TRIGGER_LABEL[row.trigger] || row.trigger}
                    </Badge>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {row.message || "无附加信息"}
                  </div>
                </div>
                <time className="shrink-0 font-mono text-[11px] text-muted-foreground sm:text-right">
                  {formatTime(row.ts)}
                </time>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="今天还没有执行记录"
            description="触发一次巡检或手动执行任务后，这里会显示结果。"
            icon={TicketIcon}
          />
        )}
      </SectionCard>
    </PageFrame>
  );
}
