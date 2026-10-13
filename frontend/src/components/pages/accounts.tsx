import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeftRightIcon,
  CheckCircle2Icon,
  CircleOffIcon,
  CoinsIcon,
  DownloadIcon,
  EllipsisIcon,
  FileJsonIcon,
  KeyRoundIcon,
  LaptopIcon,
  NetworkIcon,
  PencilLineIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Trash2Icon,
  UserRoundCheckIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import type { DashboardController } from "@/hooks/use-dashboard";
import type { Account, Realm } from "@/lib/types";
import { downloadJSON, postJSON } from "@/lib/api";
import { PRODUCT_LABEL, compact, fmt, formatTime, isAccountActive, relativeTime } from "@/lib/format";
import { performAction } from "@/lib/action";
import { cn } from "cn";
import {
  AddAccountDialog,
  DesktopImportDialog,
  ImportAccountsDialog,
} from "@/components/account-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState, MetricCard, PageFrame, PageHeader, RealmBadge, SectionCard, StatusBadge } from "@/components/shared";

type RealmFilter = "all" | Realm;

const PRODUCT_OPTIONS = [
  { value: "workbuddy", label: "WorkBuddy" },
  { value: "vscode", label: "VS Code" },
  { value: "cli", label: "CLI" },
] as const;

const PRODUCT_ORDER = ["workbuddy", "vscode", "cli"] as const;
const PRODUCT_SHORT: Record<(typeof PRODUCT_ORDER)[number], string> = {
  workbuddy: "WB",
  vscode: "VSC",
  cli: "CLI",
};

type ProductValue = (typeof PRODUCT_ORDER)[number];

function normalizeProduct(product?: string): ProductValue {
  return PRODUCT_ORDER.includes(product as ProductValue) ? (product as ProductValue) : "workbuddy";
}

async function accountAction(
  url: string,
  body: unknown,
  message: string,
  refresh: () => Promise<unknown>,
): Promise<void> {
  await performAction(url, body, message);
  await refresh();
}

function creditPercent(account: Account): number {
  const credits = account.credits;
  if (!credits || !credits.size) return 0;
  return Math.min(100, Math.max(0, (Number(credits.remain) / Number(credits.size)) * 100));
}

function AccountActions({
  account,
  dashboard,
  onEditNote,
  onExport,
  onDelete,
}: {
  account: Account;
  dashboard: DashboardController;
  onEditNote: (account: Account) => void;
  onExport: (account: Account) => void;
  onDelete: (account: Account) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function run(url: string, body: unknown, message: string) {
    setBusy(true);
    try {
      await accountAction(url, body, message, dashboard.loadAccounts);
    } catch {
      // performAction already surfaced the error toast.
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" disabled={busy} aria-label="账号操作">
          {busy ? <RefreshCwIcon className="animate-spin" /> : <EllipsisIcon />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>账号操作</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => void run("/accounts/test", { uid: account.uid }, "账号测试完成")}>
          <ShieldCheckIcon />
          测试连接
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void run("/accounts/refresh", { uid: account.uid }, "凭证已刷新")}>
          <KeyRoundIcon />
          刷新凭证
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void run("/accounts/credits", { uid: account.uid }, "额度已刷新")}>
          <CoinsIcon />
          刷新额度
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void run("/accounts/sync-profile", { uid: account.uid }, "资料已同步")}>
          <UserRoundCheckIcon />
          同步资料
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void run("/accounts/checkin", { uid: account.uid }, "签到请求已提交")}>
          <CheckCircle2Icon />
          立即签到
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void run("/accounts/daily-chat", { uid: account.uid }, "每日活跃已提交")}>
          <SparklesIcon />
          每日活跃
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void run("/accounts/daily-chat-web", { uid: account.uid }, "网页活跃已提交")}>
          <ZapIcon />
          网页活跃
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onEditNote(account)}>
          <PencilLineIcon />
          编辑备注
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport(account)}>
          <DownloadIcon />
          导出账号
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(account)}>
          <Trash2Icon />
          删除账号
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountMobileCard({
  account,
  dashboard,
  onEditNote,
  onExport,
  onDelete,
}: {
  account: Account;
  dashboard: DashboardController;
  onEditNote: (account: Account) => void;
  onExport: (account: Account) => void;
  onDelete: (account: Account) => void;
}) {
  const [busy, setBusy] = useState(false);
  const active = isAccountActive(account);

  async function toggle() {
    setBusy(true);
    try {
      await accountAction(
        "/accounts/set",
        { uid: account.uid, enabled: !account.enabled },
        account.enabled ? "账号已停用" : "账号已启用",
        dashboard.loadAccounts,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-sm">{account.nickname}</CardTitle>
            <CardDescription className="mt-0.5 truncate font-mono text-[11px]">
              {account.uid}
            </CardDescription>
          </div>
          <StatusBadge
            active={active}
            activeText="可用"
            inactiveText={account.enabled ? "受限" : "停用"}
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <RealmBadge realm={account.realm} />
          <Badge variant="secondary">{PRODUCT_LABEL[account.product || ""] || account.product || "—"}</Badge>
          <Badge variant="outline">权重 {account.weight}</Badge>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">剩余额度</span>
            <span className="font-mono">{fmt(account.credits?.remain || 0, 2)}</span>
          </div>
          <Progress value={creditPercent(account)} />
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
          <div className="rounded-md bg-muted/40 p-2">
            <div className="text-muted-foreground">今日 Token</div>
            <div className="mt-1">{account.dailyTokensToday == null ? "—" : compact(account.dailyTokensToday)}</div>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <div className="text-muted-foreground">凭证到期</div>
            <div className="mt-1">{account.expiresIn || (account.expiresAt ? relativeTime(account.expiresAt) : "—")}</div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Switch checked={account.enabled} disabled={busy} onCheckedChange={() => void toggle()} />
            <span className="text-xs text-muted-foreground">{account.enabled ? "已启用" : "已停用"}</span>
          </div>
          <AccountActions
            account={account}
            dashboard={dashboard}
            onEditNote={onEditNote}
            onExport={onExport}
            onDelete={onDelete}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function AccountsPage({ dashboard }: { dashboard: DashboardController }) {
  const { state } = dashboard;
  const [filterRealm, setFilterRealm] = useState<RealmFilter>("all");
  const [query, setQuery] = useState("");
  const [noteTarget, setNoteTarget] = useState<Account | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkBusy, setBulkBusy] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "product" | "disable" | "enable">(null);

  const accounts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return state.accounts.filter((account) => {
      if (filterRealm !== "all" && account.realm !== filterRealm) return false;
      if (!needle) return true;
      return [account.nickname, account.uid, account.note, account.domain, account.product]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [filterRealm, query, state.accounts]);

  const enabledCount = state.accounts.filter((account) => account.enabled).length;
  const readyCount = state.accounts.filter((account) => isAccountActive(account)).length;
  const totalCredits = state.accounts.reduce((total, account) => total + Number(account.credits?.remain || 0), 0);
  const totalTodayTokens = state.accounts.reduce(
    (total, account) => total + Number(account.dailyTokensToday || 0),
    0,
  );
  const uniformProduct = useMemo<ProductValue | null>(() => {
    if (!state.accounts.length) return null;
    const first = normalizeProduct(state.accounts[0].product);
    return state.accounts.every((account) => normalizeProduct(account.product) === first)
      ? first
      : null;
  }, [state.accounts]);
  const nextProduct =
    PRODUCT_ORDER[
      ((uniformProduct ? PRODUCT_ORDER.indexOf(uniformProduct) : -1) + 1) % PRODUCT_ORDER.length
    ];

  function openNote(account: Account) {
    setNoteTarget(account);
    setNoteValue(account.note || "");
  }

  async function saveNote() {
    if (!noteTarget || savingNote) return;
    setSavingNote(true);
    try {
      await accountAction(
        "/accounts/set",
        { uid: noteTarget.uid, note: noteValue.trim() },
        "备注已保存",
        dashboard.loadAccounts,
      );
      setNoteTarget(null);
    } catch {
      // Error toast is handled by performAction.
    } finally {
      setSavingNote(false);
    }
  }

  async function deleteAccount() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await accountAction(
        "/accounts/delete",
        { uid: deleteTarget.uid },
        "账号已删除",
        dashboard.loadAccounts,
      );
      setDeleteTarget(null);
    } catch {
      // Error toast is handled by performAction.
    } finally {
      setDeleting(false);
    }
  }

  async function setAll(enabled: boolean) {
    setBulkBusy(enabled ? "enable" : "disable");
    try {
      await accountAction(
        "/accounts/set-all",
        { enabled },
        enabled ? "已启用全部账号" : "已停用全部账号",
        dashboard.loadAccounts,
      );
    } finally {
      setBulkBusy("");
    }
  }

  async function bulk(url: string, message: string, key: string) {
    setBulkBusy(key);
    try {
      await accountAction(url, {}, message, dashboard.loadAccounts);
    } finally {
      setBulkBusy("");
    }
  }

  async function exportAll() {
    setBulkBusy("export");
    try {
      const result = await downloadJSON("/accounts/export");
      toast.success(`已导出 ${result.count} 个账号 → ${result.filename}`);
    } catch (error) {
      toast.error(`导出失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBulkBusy("");
    }
  }

  async function exportOne(account: Account) {
    try {
      const result = await downloadJSON(
        `/accounts/export?uid=${encodeURIComponent(account.uid)}`,
        `${account.uid.slice(0, 8)}-`,
      );
      toast.success(`已导出 1 个账号 → ${result.filename}`);
    } catch (error) {
      toast.error(`导出失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function assignProxySlots() {
    const unbound = state.accounts.filter((account) => account.enabled && !account.proxySlot);
    if (!unbound.length) {
      toast.success("所有已启用账号都已绑定代理出口");
      return;
    }
    const slots = state.proxySlots.filter((slot) => slot.enabled !== false);
    if (!slots.length) {
      toast.warning("没有启用的代理槽，请先在设置中添加并保存");
      return;
    }

    setBulkBusy("proxy");
    let assigned = 0;
    let failed = 0;
    try {
      for (const [index, account] of unbound.entries()) {
        const slot = slots[index % slots.length];
        try {
          await postJSON("/accounts/set", { uid: account.uid, proxySlot: slot.slot });
          assigned++;
        } catch {
          failed++;
        }
      }
      await dashboard.loadAccounts();
      if (failed) {
        toast.warning(`已分配 ${assigned} 个账号，${failed} 个失败`);
      } else {
        toast.success(`已为 ${assigned} 个未绑定账号分配代理出口`);
      }
    } finally {
      setBulkBusy("");
    }
  }

  async function switchAllProducts() {
    setBulkBusy("product");
    try {
      await accountAction(
        "/accounts/product",
        { product: nextProduct },
        `已把全部账号的出站身份切换为 ${PRODUCT_SHORT[nextProduct]}`,
        dashboard.loadAccounts,
      );
    } catch {
      // performAction already surfaced the error toast.
    } finally {
      setBulkBusy("");
    }
  }

  return (
    <PageFrame>
      <PageHeader
        title="账号池"
        description="管理上游凭证、区域、出口、权重与积分的实时状态。"
        icon={UsersIcon}
        actions={
          <>
            <Badge variant="outline" className="gap-1.5">
              <ShieldCheckIcon />
              {readyCount}/{state.accounts.length} 就绪
            </Badge>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              添加账号
            </Button>
            <Button variant="outline" size="sm" onClick={() => void dashboard.loadAccounts()}>
              <RefreshCwIcon data-icon="inline-start" />
              刷新
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="账号总数" value={fmt(state.accounts.length)} detail={`${enabledCount} 个已启用`} icon={UsersIcon} />
        <MetricCard
          label="就绪账号"
          value={`${readyCount}`}
          detail={`${state.accounts.length - readyCount} 个受限或停用`}
          icon={ShieldCheckIcon}
          tone={readyCount < state.accounts.length ? "warning" : "success"}
        />
        <MetricCard label="剩余积分" value={fmt(totalCredits, 1)} detail="所有可见账号合计" icon={CoinsIcon} tone="warning" />
        <MetricCard label="今日 Token" value={compact(totalTodayTokens)} detail="账号级日用量合计" icon={ZapIcon} tone="success" />
      </div>

      <SectionCard
        title="账号列表"
        description="筛选结果仅影响当前视图，不会修改账号数据。"
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-72">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索昵称、UID、备注…"
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              value={filterRealm}
              onValueChange={(value) => value && setFilterRealm(value as RealmFilter)}
              aria-label="账号区域筛选"
            >
              <ToggleGroupItem value="all" className="px-2 text-xs">
                全部
              </ToggleGroupItem>
              <ToggleGroupItem value="cn" className="px-2 text-xs">
                国内版
              </ToggleGroupItem>
              <ToggleGroupItem value="intl" className="px-2 text-xs">
                国际版
              </ToggleGroupItem>
            </ToggleGroup>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={Boolean(bulkBusy)}>
                  <EllipsisIcon data-icon="inline-start" />
                  更多操作
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>账号维护</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setDesktopOpen(true)}>
                    <LaptopIcon />
                    扫描桌面客户端
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setImportOpen(true)}>
                    <FileJsonIcon />
                    从文件导入
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={Boolean(bulkBusy)} onClick={() => void exportAll()}>
                    <DownloadIcon />
                    {bulkBusy === "export" ? "导出中…" : "导出全部账号"}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem disabled={Boolean(bulkBusy)} onClick={() => void assignProxySlots()}>
                    <NetworkIcon />
                    {bulkBusy === "proxy" ? "分配中…" : "一键分配代理"}
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={Boolean(bulkBusy)} onClick={() => setConfirm("product")}>
                    <ArrowLeftRightIcon />
                    统一出站：{uniformProduct ? PRODUCT_SHORT[uniformProduct] : "混合"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={Boolean(bulkBusy)}
                    onClick={() => void bulk("/accounts/refresh", "凭证刷新已提交", "credentials")}
                  >
                    <KeyRoundIcon />
                    刷新凭证
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={Boolean(bulkBusy)}
                    onClick={() => void bulk("/accounts/credits", "额度刷新已提交", "credits")}
                  >
                    <CoinsIcon />
                    刷新额度
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem disabled={Boolean(bulkBusy)} onClick={() => setConfirm("enable")}>
                    <CheckCircle2Icon />
                    全部启用
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={Boolean(bulkBusy)}
                    onClick={() => setConfirm("disable")}
                  >
                    <CircleOffIcon />
                    全部停用
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {accounts.length ? (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader className="[&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
                  <TableRow>
                    <TableHead>账号</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>区域 / 产品</TableHead>
                    <TableHead>出口</TableHead>
                    <TableHead className="text-center">权重</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead className="text-right">今日 Token</TableHead>
                    <TableHead>活动</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => {
                    const active = isAccountActive(account);
                    return (
                      <TableRow key={account.uid}>
                        <TableCell className="max-w-56">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "flex size-8 shrink-0 items-center justify-center rounded-lg border font-mono text-xs",
                                active
                                  ? "border-success/30 bg-success/10 text-success"
                                  : "border-border bg-muted text-muted-foreground",
                              )}
                            >
                              {account.nickname.slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium">{account.nickname}</div>
                              <div className="truncate font-mono text-[11px] text-muted-foreground">
                                {account.uid}
                              </div>
                              {account.note ? (
                                <div className="truncate text-[11px] text-primary">{account.note}</div>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              size="sm"
                              checked={account.enabled}
                              aria-label={`${account.enabled ? "停用" : "启用"} ${account.nickname}`}
                              onCheckedChange={(checked) =>
                                void accountAction(
                                  "/accounts/set",
                                  { uid: account.uid, enabled: checked },
                                  checked ? "账号已启用" : "账号已停用",
                                  dashboard.loadAccounts,
                                )
                              }
                            />
                            <StatusBadge
                              active={active}
                              activeText="可用"
                              inactiveText={account.enabled ? "受限" : "停用"}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <RealmBadge realm={account.realm} />
                            <Select
                              value={account.product || "workbuddy"}
                              onValueChange={(value) =>
                                void accountAction(
                                  "/accounts/product",
                                  { uid: account.uid, product: value },
                                  "产品类型已更新",
                                  dashboard.loadAccounts,
                                )
                              }
                            >
                              <SelectTrigger size="sm" className="w-32" aria-label="产品类型">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {PRODUCT_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select
                              value={account.proxySlot || "__none__"}
                              onValueChange={(value) =>
                                void accountAction(
                                  "/accounts/set",
                                  { uid: account.uid, proxySlot: value === "__none__" ? "" : value },
                                  "出口绑定已更新",
                                  dashboard.loadAccounts,
                                )
                              }
                            >
                              <SelectTrigger size="sm" className="w-28" aria-label="出口绑定">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="__none__">不绑定</SelectItem>
                                  {state.proxySlots.map((slot) => (
                                    <SelectItem key={slot.slot} value={slot.slot}>
                                      {slot.slot}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <span
                              title={account.proxy || "直连"}
                              className="max-w-20 truncate font-mono text-[10px] text-muted-foreground"
                            >
                              {account.proxy || "直连"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            key={`${account.uid}-${account.weight}`}
                            type="number"
                            min={1}
                            max={99}
                            defaultValue={account.weight}
                            className="mx-auto h-7 w-16 text-center font-mono"
                            onBlur={(event) => {
                              const value = Math.max(1, Math.floor(Number(event.target.value) || 1));
                              if (value === account.weight) return;
                              void accountAction(
                                "/accounts/set",
                                { uid: account.uid, weight: value },
                                "权重已更新",
                                dashboard.loadAccounts,
                              );
                            }}
                          />
                        </TableCell>
                        <TableCell className="min-w-40">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-mono">{fmt(account.credits?.remain || 0, 1)}</span>
                            <span className="text-muted-foreground">
                              / {fmt(account.credits?.size || 0, 0)}
                            </span>
                          </div>
                          <Progress className="mt-1.5" value={creditPercent(account)} />
                          <div className="mt-1 text-[10px] text-muted-foreground">
                            {account.credits?.checkin?.today_checked_in ? "今日已签到" : "今日未签到"}
                            {account.credits?.updated_iso ? ` · ${relativeTime(account.credits.updated_iso)}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {account.dailyTokensToday == null ? "—" : compact(account.dailyTokensToday)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                            <span>签到 {account.lastCheckin ? formatTime(account.lastCheckin, true) : "—"}</span>
                            <span>活跃 {account.lastDailyChat ? formatTime(account.lastDailyChat, true) : "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <AccountActions
                            account={account}
                            dashboard={dashboard}
                            onEditNote={openNote}
                            onExport={exportOne}
                            onDelete={setDeleteTarget}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 md:hidden">
              {accounts.map((account) => (
                <AccountMobileCard
                  key={account.uid}
                  account={account}
                  dashboard={dashboard}
                  onEditNote={openNote}
                  onExport={exportOne}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title="没有匹配的账号"
            description="调整区域筛选或搜索关键词；也可以先刷新账号池。"
            icon={UsersIcon}
            action={
              <Button variant="outline" onClick={() => void dashboard.loadAccounts()}>
                <RefreshCwIcon data-icon="inline-start" />
                刷新账号池
              </Button>
            }
          />
        )}
      </SectionCard>

      <Dialog open={Boolean(noteTarget)} onOpenChange={(open) => !open && setNoteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑账号备注</DialogTitle>
            <DialogDescription>
              {noteTarget?.nickname} · 备注只用于面板识别，不影响上游调度。
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="account-note">备注</FieldLabel>
              <Input
                id="account-note"
                value={noteValue}
                onChange={(event) => setNoteValue(event.target.value)}
                placeholder="例如：主力账号 / 测试 / 仅夜间使用"
              />
              <FieldDescription>留空即可清除备注。</FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteTarget(null)}>
              取消
            </Button>
            <Button disabled={savingNote} onClick={() => void saveNote()}>
              {savingNote ? <RefreshCwIcon data-icon="inline-start" className="animate-spin" /> : null}
              保存备注
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除账号？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除 {deleteTarget?.nickname || "该账号"} 的本地凭证与会话。历史用量记录不会被删除，但账号无法再从面板恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void deleteAccount();
              }}
            >
              {deleting ? "正在删除…" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "product"} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>切换全部账号的出站身份？</AlertDialogTitle>
            <AlertDialogDescription>
              将把全部账号（含另一个版本）切换为 {PRODUCT_SHORT[nextProduct]}。不同身份对应不同的出站指纹、端点和配额通道。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={!state.accounts.length}
              onClick={() => {
                setConfirm(null);
                void switchAllProducts();
              }}
            >
              切换为 {PRODUCT_SHORT[nextProduct]}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "disable"} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>停用全部账号？</AlertDialogTitle>
            <AlertDialogDescription>
              停用后网关会立即停止向这些账号转发请求，账号数据与历史用量不会删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirm(null);
                void setAll(false);
              }}
            >
              确认停用
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "enable"} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>启用全部账号？</AlertDialogTitle>
            <AlertDialogDescription>
              启用后账号会重新进入调度池，达到额度或冷却条件的账号仍会被自动跳过。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirm(null);
                void setAll(true);
              }}
            >
              确认启用
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddAccountDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultRealm={state.viewRealm}
        onAdded={dashboard.loadAccounts}
      />

      <ImportAccountsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={dashboard.loadAccounts}
      />

      <DesktopImportDialog
        open={desktopOpen}
        onOpenChange={setDesktopOpen}
        onImported={dashboard.loadAccounts}
      />
    </PageFrame>
  );
}
