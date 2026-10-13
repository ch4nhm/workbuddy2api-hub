import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { motion } from "motion/react";
import {
  ActivityIcon,
  BadgeCheckIcon,
  BotIcon,
  ChartNoAxesCombinedIcon,
  CheckIcon,
  CircleGaugeIcon,
  Clock3Icon,
  CopyIcon,
  DatabaseIcon,
  EyeIcon,
  EyeOffIcon,
  GlobeIcon,
  InfoIcon,
  KeyRoundIcon,
  ListChecksIcon,
  LogOutIcon,
  NetworkIcon,
  PencilLineIcon,
  PlusIcon,
  RadioTowerIcon,
  RefreshCwIcon,
  RouteIcon,
  ScrollTextIcon,
  ServerIcon,
  Settings2Icon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TerminalIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import type { DashboardController } from "@/hooks/use-dashboard";
import type { ApiKeyRecord, Realm, Settings } from "@/lib/types";
import { getJSON, postJSON, setPanelToken } from "@/lib/api";
import { performAction } from "@/lib/action";
import { copyText } from "@/lib/clipboard";
import { useLanguage } from "@/hooks/use-language";
import type { Language } from "@/lib/i18n";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageFrame, PageHeader, SectionCard, StatusBadge } from "@/components/shared";

/* ------------------------------------------------------------------ *
 *  Shared helpers
 * ------------------------------------------------------------------ */

const LANGUAGE_OPTIONS: Array<{ value: Language; label: string }> = [
  { value: "zh", label: "简体中文" },
  { value: "zh-Hant", label: "正體中文（台灣）" },
  { value: "en", label: "English" },
];

const PAGE_OPTIONS: Array<{ key: string; label: string; icon: typeof CircleGaugeIcon }> = [
  { key: "gateway", label: "网关总览", icon: CircleGaugeIcon },
  { key: "accounts", label: "账号池", icon: UsersIcon },
  { key: "tasks", label: "成长任务", icon: ListChecksIcon },
  { key: "analytics", label: "用量分析", icon: ChartNoAxesCombinedIcon },
  { key: "agents", label: "智能代理", icon: BotIcon },
  { key: "logs", label: "运行日志", icon: ScrollTextIcon },
];

function toInt(value: string, fallback: number): number {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function SettingSwitch({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <Field
      orientation="horizontal"
      className="items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/35"
    >
      <FieldContent>
        <FieldTitle>{label}</FieldTitle>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </Field>
  );
}

function InfoRow({ label, value, mono = true }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-border/50 py-2 first:border-t-0 first:pt-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 break-all text-right text-xs", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function useSettingsSaver(dashboard: DashboardController) {
  return useCallback(
    async (patch: Record<string, unknown>, message: string) => {
      await performAction("/settings/save", patch, message);
      await dashboard.loadSettings();
    },
    [dashboard],
  );
}

/* ------------------------------------------------------------------ *
 *  Security & preferences
 * ------------------------------------------------------------------ */

function SecurityTab({ dashboard }: { dashboard: DashboardController }) {
  const { state, logout } = dashboard;
  const settings = state.settings;
  const save = useSettingsSaver(dashboard);
  const { language, setLanguage } = useLanguage();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const hidden = useMemo(() => new Set(settings?.hidden_pages || []), [settings]);
  const uiLanguage = (settings?.ui_language as Language) || "zh";

  async function changePassword() {
    if (!current || !next) {
      toast.warning("请填写当前密码和新密码");
      return;
    }
    if (next.length < 4) {
      toast.warning("新密码至少 4 位");
      return;
    }
    setSavingPwd(true);
    try {
      const response = await postJSON<{ ok?: boolean; token?: string }>("/panel/password", {
        current,
        new: next,
      });
      if (response.token) setPanelToken(response.token);
      setCurrent("");
      setNext("");
      toast.success("面板密码已更新");
      await dashboard.loadSettings();
    } catch (error) {
      toast.error("修改失败: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setSavingPwd(false);
    }
  }

  async function togglePage(key: string) {
    const now = settings?.hidden_pages || [];
    const updated = now.includes(key) ? now.filter((item) => item !== key) : [...now, key];
    try {
      const response = await postJSON<{ hidden_pages?: string[] }>("/settings/save", {
        hidden_pages: updated,
      });
      if (Array.isArray(response.hidden_pages)) {
        await dashboard.loadSettings();
      } else {
        await dashboard.loadSettings();
      }
    } catch (error) {
      toast.error("页面显示保存失败: " + (error instanceof Error ? error.message : String(error)));
    }
  }

  async function changeLanguage(value: Language) {
    setLanguage(value);
    try {
      await save({ ui_language: value }, "实例默认语言已保存");
    } catch {
      // performAction already surfaced the failure toast.
    }
  }

  function clearLanguageOverride() {
    try {
      localStorage.removeItem("wb-lang");
    } catch {
      // Storage may be unavailable; the reload still restores the default.
    }
    window.location.reload();
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="flex flex-col gap-4">
        <SectionCard
          title="面板访问密码"
          description="用于打开本看板。默认密码为 admin，建议立即修改。"
          action={
            <StatusBadge
              active={!settings?.panel_password_is_default}
              activeText="已自定义"
              inactiveText="默认密码"
              warning={Boolean(settings?.panel_password_is_default)}
            />
          }
        >
          {settings?.panel_password_is_default ? (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              <TriangleAlertIcon />
              <span>当前仍在使用默认密码，任何能访问该地址的人都能进入面板。</span>
            </div>
          ) : null}
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="pwd-current">当前密码</FieldLabel>
                <Input
                  id="pwd-current"
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(event) => setCurrent(event.target.value)}
                  placeholder="当前密码"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="pwd-next">新密码</FieldLabel>
                <Input
                  id="pwd-next"
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(event) => setNext(event.target.value)}
                  placeholder="至少 4 位"
                />
              </Field>
            </div>
          </FieldGroup>
          <div className="mt-4 flex justify-end">
            <Button disabled={savingPwd} onClick={() => void changePassword()}>
              {savingPwd ? (
                <RefreshCwIcon data-icon="inline-start" className="animate-spin" />
              ) : (
                <ShieldCheckIcon data-icon="inline-start" />
              )}
              修改密码
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="顶部页签显示"
          description="取消勾选即把该页收进侧边栏。偏好保存在网关，换浏览器、重启服务都记得。"
          action={<Badge variant="outline">{PAGE_OPTIONS.length + 1 - hidden.size} 个可见</Badge>}
        >
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {PAGE_OPTIONS.map((page) => {
              const visible = !hidden.has(page.key);
              const Icon = page.icon;
              return (
                <button
                  key={page.key}
                  type="button"
                  onClick={() => void togglePage(page.key)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-all",
                    visible
                      ? "border-primary/30 bg-primary/5 text-foreground"
                      : "border-border/60 bg-muted/20 text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md border",
                      visible ? "border-primary/30 bg-primary/10 text-primary" : "border-border/60",
                    )}
                  >
                    <Icon />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{page.label}</span>
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border",
                      visible ? "border-primary bg-primary text-primary-foreground" : "border-border",
                    )}
                  >
                    {visible ? <CheckIcon className="size-3" /> : <span className="size-1.5 rounded-full bg-current" />}
                  </span>
                </button>
              );
            })}
            <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground">
              <span className="flex size-8 items-center justify-center rounded-md border border-border/60">
                <Settings2Icon />
              </span>
              <span className="min-w-0 flex-1 truncate">系统设置</span>
              <Badge variant="secondary">固定保留</Badge>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard title="界面语言" description="实例默认语言；右上角切换只覆盖当前浏览器。">
          <Field>
            <FieldLabel htmlFor="ui-language">实例默认语言</FieldLabel>
            <Select value={uiLanguage} onValueChange={(value) => void changeLanguage(value as Language)}>
              <SelectTrigger id="ui-language" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {LANGUAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              当前浏览器覆盖：{LANGUAGE_OPTIONS.find((item) => item.value === language)?.label}
            </FieldDescription>
          </Field>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={clearLanguageOverride}>
              <RefreshCwIcon data-icon="inline-start" />
              清除浏览器覆盖
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="界面布局偏好" description="这些开关会影响面板的呈现方式，不影响任何上游数据。">
          <FieldGroup>
            <SettingSwitch
              label="账号独立成一个页签"
              description="关闭时账号相关区块与网关合并显示。"
              checked={settings?.accounts_separate_tab === true}
              onCheckedChange={(value) => void save({ accounts_separate_tab: value }, "布局偏好已保存")}
            />
            <SettingSwitch
              label="账号区默认折叠"
              description="进入面板时收起账号区块，适合账号较多的场景。"
              checked={settings?.accounts_collapsed === true}
              onCheckedChange={(value) => void save({ accounts_collapsed: value }, "布局偏好已保存")}
            />
            <SettingSwitch
              label="隐藏切换前的旧 Key 行"
              description="在用量归属里收起历史遗留的旧 Key 分组。"
              checked={settings?.key_before_hidden === true}
              onCheckedChange={(value) => void save({ key_before_hidden: value }, "布局偏好已保存")}
            />
          </FieldGroup>
        </SectionCard>

        <SectionCard title="管理员会话" description="退出后需要重新输入面板密码。">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <LogOutIcon data-icon="inline-start" />
                退出登录
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>退出登录？</AlertDialogTitle>
                <AlertDialogDescription>
                  退出后当前会话令牌会失效，需要重新输入面板密码。账号、用量与设置数据不受影响。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => void logout()}>
                  退出
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SectionCard>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  API keys
 * ------------------------------------------------------------------ */

type KeyRealm = "" | Realm;

interface KeyDraft {
  id: string;
  name: string;
  realm: KeyRealm;
  models: string;
  enabled: boolean;
  masked: string;
  key: string;
  created_at?: string;
}

function parseModelPatterns(text: string): string[] {
  const out: string[] = [];
  text.split(/[,;]/).forEach((part) => {
    const pattern = part.trim().toLowerCase();
    if (pattern && !out.includes(pattern)) out.push(pattern);
  });
  return out;
}

function toDraft(record: ApiKeyRecord): KeyDraft {
  return {
    id: record.id || "",
    name: record.name || "",
    realm: (record.realm === "intl" || record.realm === "cn" ? record.realm : "") as KeyRealm,
    models: Array.isArray(record.models) ? record.models.join(", ") : "",
    enabled: record.enabled !== false,
    masked: record.masked || "",
    key: "",
    created_at: record.created_at,
  };
}

function randomKey(): string {
  const bytes = new Uint8Array(18);
  if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
  const raw = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return raw || "wb-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const REALM_CHOICES: Array<{ value: KeyRealm; label: string }> = [
  { value: "", label: "跟随面板切换" },
  { value: "intl", label: "固定国际版出口" },
  { value: "cn", label: "固定国内版出口" },
];

function realmChoiceLabel(value: KeyRealm): string {
  return REALM_CHOICES.find((item) => item.value === value)?.label || "跟随面板切换";
}

function ApiKeysTab({ dashboard }: { dashboard: DashboardController }) {
  const settings = dashboard.state.settings;
  const [rows, setRows] = useState<KeyDraft[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<KeyDraft | null>(null);
  const [editIndex, setEditIndex] = useState(-1);
  const [busyId, setBusyId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ index: number; draft: KeyDraft } | null>(null);

  useEffect(() => {
    setRows((settings?.api_keys || []).map(toDraft));
    setDeletedIds([]);
  }, [settings]);

  const deleted = settings?.deleted_api_keys || [];
  const enabledCount = rows.filter((row) => row.enabled).length;

  async function saveAll(list: KeyDraft[], deletedList: string[]) {
    if (list.some((row) => !row.masked && !row.id && !row.key.trim())) {
      toast.warning("新增的行还没有填写 Key");
      return false;
    }
    const payload = list
      .filter((row) => !row.id || !deletedList.includes(row.id))
      .map((row) => ({
        id: row.id,
        name: row.name.trim() || "未命名",
        realm: row.realm,
        models: parseModelPatterns(row.models),
        enabled: row.enabled !== false,
        key: row.key.trim(),
      }));
    try {
      await performAction(
        "/settings/save",
        { api_keys: payload, deleted_api_key_ids: deletedList },
        `已保存 ${payload.length} 个 API Key`,
      );
      await dashboard.loadSettings();
      return true;
    } catch {
      return false;
    }
  }

  function openNew() {
    const next = {
      id: "",
      name: "",
      realm: "" as KeyRealm,
      models: "",
      enabled: true,
      masked: "",
      key: randomKey(),
    };
    setDraft(next);
    setEditIndex(rows.length);
    setRows((prev) => [...prev, next]);
  }

  function openEdit(index: number) {
    setDraft({ ...rows[index] });
    setEditIndex(index);
  }

  function closeDialog() {
    const row = rows[editIndex];
    if (row && !row.id && !row.masked && !row.key.trim()) {
      setRows((prev) => prev.filter((_, index) => index !== editIndex));
    }
    setDraft(null);
    setEditIndex(-1);
  }

  function confirmDialog() {
    if (!draft) return;
    if (!draft.masked && !draft.key.trim()) {
      toast.warning("API Key 不能为空");
      return;
    }
    const list = rows.slice();
    list[editIndex] = draft;
    setRows(list);
    setDraft(null);
    setEditIndex(-1);
    void saveAll(list, deletedIds);
  }

  async function toggleRow(index: number, value: boolean) {
    const list = rows.map((row, position) =>
      position === index ? { ...row, enabled: value } : row,
    );
    setRows(list);
    const ok = await saveAll(list, deletedIds);
    if (!ok) {
      setRows(rows);
    }
  }

  async function copyRow(row: KeyDraft) {
    setBusyId(row.id || row.name);
    try {
      let value = row.key.trim();
      if (!value && row.id) {
        const response = await getJSON<{ key?: string }>(
          "/settings/reveal?id=" + encodeURIComponent(row.id),
        );
        value = response.key || "";
      }
      if (!value) {
        toast.warning("这一行还没有 Key，点「随机生成」或直接填写");
        return;
      }
      await copyText(value);
      toast.success("已复制到剪贴板");
    } catch (error) {
      toast.error("复制失败: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setBusyId("");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { index, draft: target } = deleteTarget;
    const nextDeleted = target.id && !deletedIds.includes(target.id) ? [...deletedIds, target.id] : deletedIds;
    const list = rows.filter((_, position) => position !== index);
    setDeletedIds(nextDeleted);
    setRows(list);
    setDeleteTarget(null);
    const ok = await saveAll(list, nextDeleted);
    if (ok) {
      setDeletedIds([]);
    } else {
      await dashboard.loadSettings();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="API Key"
        description="为每个 Key 绑定专属出口；客户端使用该 Key 请求时会固定走对应区域，实现双出口并发。"
        action={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <KeyRoundIcon />
              {enabledCount}/{rows.length} 生效
            </Badge>
            <Button size="sm" onClick={openNew}>
              <PlusIcon data-icon="inline-start" />
              添加 API Key
            </Button>
          </div>
        }
      >
        {rows.length ? (
          <div className="grid gap-3">
            {rows.map((row, index) => (
              <motion.div
                key={row.id || `new-${index}`}
                layout
                className={cn(
                  "rounded-xl border p-3 transition-colors sm:p-4",
                  row.enabled
                    ? "border-border/70 bg-background/75"
                    : "border-border/50 bg-muted/25 opacity-80",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{row.name || "未命名"}</span>
                      <StatusBadge active={row.enabled} activeText="已启用" inactiveText="已禁用" />
                      <Badge variant="secondary" className="gap-1">
                        <GlobeIcon />
                        {realmChoiceLabel(row.realm)}
                      </Badge>
                      {row.models ? (
                        <Badge variant="outline" className="font-mono">
                          限 {row.models}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-mono">
                        Key:{" "}
                        <span className="text-foreground">
                          {row.masked || (row.key ? row.key.slice(0, 4) + "••••••" + row.key.slice(-4) : "未设置")}
                        </span>
                      </span>
                      {row.created_at ? <span>创建 {row.created_at}</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Switch
                      size="sm"
                      checked={row.enabled}
                      disabled={busyId === (row.id || row.name)}
                      onCheckedChange={(value) => void toggleRow(index, value)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === (row.id || row.name)}
                      onClick={() => void copyRow(row)}
                    >
                      <CopyIcon data-icon="inline-start" />
                      复制
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(index)}>
                      <PencilLineIcon data-icon="inline-start" />
                      编辑
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      aria-label="删除 API Key"
                      onClick={() => setDeleteTarget({ index, draft: row })}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/70 px-6 py-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-full border border-border/70 text-muted-foreground">
              <KeyRoundIcon />
            </div>
            <div className="text-sm font-medium">还没有配置 API Key</div>
            <p className="max-w-md text-xs text-muted-foreground">
              添加后即可为不同客户端分配专属出口与模型范围。所有请求会按 Key 归属，历史用量不受影响。
            </p>
            <Button size="sm" onClick={openNew}>
              <PlusIcon data-icon="inline-start" />
              创建第一个 Key
            </Button>
          </div>
        )}

        {deleted.length ? (
          <div className="mt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <DatabaseIcon />
              已删除的 API Key（{deleted.length}）· 只读历史
            </div>
            <div className="mt-2 grid gap-1.5">
              {deleted.map((record) => (
                <div
                  key={record.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
                >
                  <span className="font-medium text-foreground">{record.name || "未命名"}</span>
                  <span>{realmChoiceLabel((record.realm === "cn" ? "cn" : record.realm === "intl" ? "intl" : "") as KeyRealm)}</span>
                  {record.created_at ? <span>创建 {record.created_at}</span> : null}
                  {record.deleted_at ? <span>删除 {record.deleted_at}</span> : null}
                  <span className="ml-auto font-mono">{record.id}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              删除时密钥已被抹掉，无法恢复或再次使用。保留记录是为了让历史用量仍能显示对应名称。
            </p>
          </div>
        ) : null}
      </SectionCard>

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "编辑 API Key" : "新建 API Key"}</DialogTitle>
            <DialogDescription>
              留空 Key 内容表示保持原有密钥不变；出口与模型限制会立即生效。
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="key-name">备注名称</FieldLabel>
                  <Input
                    id="key-name"
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    placeholder="如：Cursor / DSH / 本地测试"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="key-realm">出口绑定</FieldLabel>
                  <Select
                    value={draft.realm || "follow"}
                    onValueChange={(value) =>
                      setDraft({ ...draft, realm: (value === "follow" ? "" : value) as KeyRealm })
                    }
                  >
                    <SelectTrigger id="key-realm" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {REALM_CHOICES.map((choice) => (
                          <SelectItem key={choice.value || "follow"} value={choice.value || "follow"}>
                            {choice.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="key-models">模型限制</FieldLabel>
                <Input
                  id="key-models"
                  value={draft.models}
                  onChange={(event) => setDraft({ ...draft, models: event.target.value })}
                  placeholder="如 deepseek* 或 gpt-6-astra；多个用逗号分隔，支持 * 通配"
                />
                <FieldDescription>留空表示不限制模型。</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="key-value">API Key 内容</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="key-value"
                    value={draft.key}
                    onChange={(event) => setDraft({ ...draft, key: event.target.value })}
                    placeholder={draft.masked ? `已保存 ${draft.masked}，留空表示不改` : "输入自定义密钥，或点击右侧生成"}
                    className="font-mono"
                  />
                  <Button
                    variant="outline"
                    onClick={() => setDraft({ ...draft, key: randomKey() })}
                    className="shrink-0"
                  >
                    <SparklesIcon data-icon="inline-start" />
                    随机生成
                  </Button>
                </div>
                {draft.masked ? (
                  <FieldDescription>已保存的密钥不会回显；留空即可保持原值。</FieldDescription>
                ) : null}
              </Field>
            </FieldGroup>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              取消
            </Button>
            <Button onClick={confirmDialog}>
              <CheckIcon data-icon="inline-start" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除 API Key？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除 {deleteTarget?.draft.name || "该 Key"}，密钥会被抹掉且无法恢复。历史用量仍会保留这个名字。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Limits, pricing & refresh
 * ------------------------------------------------------------------ */

const LIMIT_FIELDS = [
  { key: "reserve_credits", label: "保留积分", hint: "账号积分低于该值时不再派发请求。" },
  { key: "daily_token_limit", label: "每日 Token 限额", hint: "单个账号每天可消耗的 Token 上限。" },
  { key: "daily_credit_limit", label: "每日积分限额", hint: "单个账号每天可消耗的积分上限。" },
  { key: "model_daily_token_limit", label: "按模型每日 Token 限额", hint: "针对单个模型、单个账号的每日上限。" },
  { key: "expiring_window_days", label: "临期积分优先", hint: "优先消耗若干天内即将过期的积分。" },
] as const;

const LIMIT_SCOPES = ["global", "intl", "cn"] as const;
type LimitScope = (typeof LIMIT_SCOPES)[number];
type LimitEntry = { global: number; intl: number | null; cn: number | null };
type LimitForm = Record<string, Record<LimitScope, string>>;

interface PricingState {
  enabled?: boolean;
  current_at_label?: string;
  models?: number;
  last_run_label?: string;
  next_run_label?: string;
  policies?: number;
  last_error?: string;
  current?: Record<string, { id?: string; via?: string; inherited_from?: string; label?: string }>;
  gaps?: Array<{ model: string; reason?: string; candidates?: string[] }>;
  gap_summary?: {
    total?: number;
    or_missing?: number;
    variant_unmatched?: number;
    aliases?: number;
    variants_enabled?: boolean;
  };
}

const PRICING_REASON: Record<string, string> = {
  or_missing: "OpenRouter 无对应",
  variant_unmatched: "变体名未命中基准",
  alias: "虚拟别名（非实体模型）",
};

function buildLimitForm(settings: Settings | undefined): LimitForm {
  const form: LimitForm = {};
  for (const field of LIMIT_FIELDS) {
    const entry = (settings?.limits?.[field.key] || {}) as Partial<LimitEntry>;
    form[field.key] = {
      global: String(Number(entry.global ?? 0)),
      intl: entry.intl === null || entry.intl === undefined ? "" : String(entry.intl),
      cn: entry.cn === null || entry.cn === undefined ? "" : String(entry.cn),
    };
  }
  return form;
}

function LimitsRefreshTab({ dashboard }: { dashboard: DashboardController }) {
  const settings = dashboard.state.settings;
  const save = useSettingsSaver(dashboard);
  const [form, setForm] = useState<LimitForm>(() => buildLimitForm(settings));
  const [perRealm, setPerRealm] = useState(false);
  const [savingLimits, setSavingLimits] = useState(false);
  const [creditsHours, setCreditsHours] = useState("12");
  const [pricingMinutes, setPricingMinutes] = useState("5");

  useEffect(() => {
    const next = buildLimitForm(settings);
    setForm(next);
    const entries = settings?.limits || {};
    setPerRealm(
      LIMIT_FIELDS.some((field) => {
        const entry = entries[field.key] as Partial<LimitEntry> | undefined;
        return (entry?.intl ?? null) !== null || (entry?.cn ?? null) !== null;
      }),
    );
    setCreditsHours(String(Number(settings?.credits_refresh_hours ?? 12)));
    setPricingMinutes(String(Number(settings?.pricing_refresh_minutes ?? 5)));
  }, [settings]);

  function updateCell(field: string, scope: LimitScope, value: string) {
    setForm((prev) => ({ ...prev, [field]: { ...prev[field], [scope]: value } }));
  }

  async function saveLimits() {
    const payload: Record<string, LimitEntry> = {};
    for (const field of LIMIT_FIELDS) {
      const entry = form[field.key];
      const global = Math.floor(Number(entry.global || 0));
      if (!Number.isFinite(global) || global < 0) {
        toast.warning(`「${field.label}」的全局默认请填 0 或正整数`);
        return;
      }
      const scopeValue = (scope: "intl" | "cn"): number | null => {
        const raw = entry[scope];
        if (!perRealm || raw === "") return null;
        const value = Math.floor(Number(raw));
        if (!Number.isFinite(value) || value < 0) {
          toast.warning(`「${field.label}」的${scope === "intl" ? "国际版" : "国内版"}请填 0 或正整数`);
          return null;
        }
        return value;
      };
      const intl = scopeValue("intl");
      const cn = scopeValue("cn");
      payload[field.key] = { global, intl, cn };
    }
    setSavingLimits(true);
    try {
      await save({ limits: payload }, "限额已保存");
    } catch {
      // performAction surfaced the error.
    } finally {
      setSavingLimits(false);
    }
  }

  async function toggleExpiringWindow(value: boolean) {
    const current = toInt(form.expiring_window_days.global, 0);
    const next = value ? (current > 0 ? current : 7) : 0;
    try {
      await save(
        { limits: { expiring_window_days: { global: next } } },
        value ? "已开启临期积分优先" : "已关闭临期积分优先",
      );
    } catch {
      // performAction surfaced the error.
    }
  }

  const pricingEnabled = settings?.pricing_enabled !== false;
  const expiringOn = toInt(form.expiring_window_days.global, 0) > 0;

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="账号限额"
        description="全局默认对所有账号生效；国际版 / 国内版留空即继承全局默认，填 0 表示关闭该版本的独立限制。"
        action={
          <div className="flex items-center gap-2">
            <div className="glass-panel flex items-center gap-2 rounded-lg px-2.5 py-1.5">
              <span className="text-xs text-muted-foreground">分版本设置</span>
              <Switch size="sm" checked={perRealm} onCheckedChange={setPerRealm} />
            </div>
            <Button size="sm" disabled={savingLimits} onClick={() => void saveLimits()}>
              {savingLimits ? (
                <RefreshCwIcon data-icon="inline-start" className="animate-spin" />
              ) : (
                <CheckIcon data-icon="inline-start" />
              )}
              保存限额
            </Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-52">护栏</TableHead>
                <TableHead className="w-28">全局默认</TableHead>
                {perRealm ? <TableHead className="w-28">国际版</TableHead> : null}
                {perRealm ? <TableHead className="w-28">国内版</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {LIMIT_FIELDS.map((field) => (
                <TableRow key={field.key}>
                  <TableCell>
                    <div className="text-sm font-medium">{field.label}</div>
                    <div className="text-[11px] text-muted-foreground">{field.hint}</div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={form[field.key]?.global ?? "0"}
                      onChange={(event) => updateCell(field.key, "global", event.target.value)}
                      className="h-8 w-24 font-mono"
                    />
                  </TableCell>
                  {perRealm ? (
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={form[field.key]?.intl ?? ""}
                        placeholder={`继承 ${toInt(form[field.key]?.global ?? "0", 0)}`}
                        onChange={(event) => updateCell(field.key, "intl", event.target.value)}
                        className="h-8 w-24 font-mono"
                      />
                    </TableCell>
                  ) : null}
                  {perRealm ? (
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={form[field.key]?.cn ?? ""}
                        placeholder={`继承 ${toInt(form[field.key]?.global ?? "0", 0)}`}
                        onChange={(event) => updateCell(field.key, "cn", event.target.value)}
                        className="h-8 w-24 font-mono"
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
          <div>
            <div className="text-sm font-medium">临期积分优先</div>
            <div className="text-xs text-muted-foreground">开启后默认窗口为 7 天，可在上方单独调整天数。</div>
          </div>
          <Switch checked={expiringOn} onCheckedChange={(value) => void toggleExpiringWindow(value)} />
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="后台刷新"
          description="积分缓存的后台刷新间隔；分派读取的是缓存余额，填 0 关闭后台刷新。"
          action={<Clock3Icon className="text-primary" />}
        >
          <Field orientation="horizontal" className="items-end gap-3">
            <Field>
              <FieldLabel htmlFor="credits-hours">刷新间隔（小时）</FieldLabel>
              <Input
                id="credits-hours"
                type="number"
                min={0}
                value={creditsHours}
                onChange={(event) => setCreditsHours(event.target.value)}
                className="font-mono"
              />
            </Field>
            <Button
              variant="outline"
              onClick={() =>
                void save(
                  { credits_refresh_hours: Math.max(0, toInt(creditsHours, 0)) },
                  "已保存积分刷新间隔",
                )
              }
            >
              <CheckIcon data-icon="inline-start" />
              保存
            </Button>
          </Field>
        </SectionCard>

        <SectionCard
          title="价估算（OpenRouter）"
          description="按模型成本估算费用。关闭后停止取价与算价，历史数据不受影响。"
          action={
            <Switch
              checked={pricingEnabled}
              onCheckedChange={(value) =>
                void save(
                  { pricing_enabled: value },
                  value ? "已启用价估算" : "已关闭价估算",
                )
              }
            />
          }
        >
          <div className="flex flex-col gap-3">
            <Field orientation="horizontal" className="items-end gap-3">
              <Field>
                <FieldLabel htmlFor="pricing-minutes">自动取价间隔（分钟）</FieldLabel>
                <Input
                  id="pricing-minutes"
                  type="number"
                  min={0}
                  disabled={!pricingEnabled}
                  value={pricingMinutes}
                  onChange={(event) => setPricingMinutes(event.target.value)}
                  className="font-mono"
                />
              </Field>
              <Button
                variant="outline"
                disabled={!pricingEnabled}
                onClick={() =>
                  void save(
                    { pricing_refresh_minutes: Math.max(0, toInt(pricingMinutes, 0)) },
                    "已保存取价间隔",
                  )
                }
              >
                保存
              </Button>
            </Field>
            <SettingSwitch
              label="变体继承定价"
              description="带渠道后缀的模型在唯一命中时按基准模型继承定价。"
              checked={settings?.pricing_variant_inherit !== false}
              disabled={!pricingEnabled}
              onCheckedChange={(value) =>
                void save({ pricing_variant_inherit: value }, "已更新变体继承")
              }
            />
          </div>
        </SectionCard>
      </div>

      <PricingStatusCard enabled={pricingEnabled} />
    </div>
  );
}

function PricingStatusCard({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState<PricingState | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mappingModel, setMappingModel] = useState<string | null>(null);
  const [mappingValue, setMappingValue] = useState("");

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      setStatus(await getJSON<PricingState>("/pricing"));
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshNow() {
    setRefreshing(true);
    try {
      const response = await postJSON<{ msg?: string }>("/pricing/refresh", {});
      toast.success(response.msg || "已开始抓取价");
      window.setTimeout(() => void load(), 4000);
      window.setTimeout(() => void load(), 15000);
    } catch (error) {
      toast.error("触发失败: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setRefreshing(false);
    }
  }

  async function saveMapping() {
    if (!mappingModel) return;
    try {
      const response = await postJSON<{ msg?: string; known?: boolean }>("/pricing/mapping", {
        model: mappingModel,
        or_id: mappingValue.trim(),
      });
      toast.success(response.msg || "已记录映射");
      setMappingModel(null);
      setMappingValue("");
      window.setTimeout(() => void load(), 3000);
    } catch (error) {
      toast.error("登记失败: " + (error instanceof Error ? error.message : String(error)));
    }
  }

  const gaps = status?.gaps || [];
  const summary = status?.gap_summary || {};

  return (
    <SectionCard
      title="取价状态"
      description="当前生效的定价快照、后台任务以及尚未定价的模型。"
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={!enabled || loading} onClick={() => void load()}>
            <RefreshCwIcon data-icon="inline-start" className={loading ? "animate-spin" : undefined} />
            刷新状态
          </Button>
          <Button size="sm" disabled={!enabled || refreshing} onClick={() => void refreshNow()}>
            <RouteIcon data-icon="inline-start" />
            立即取价
          </Button>
        </div>
      }
    >
      {!enabled ? (
        <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
          价估算当前已关闭，未取价也不计费。
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground">当前生效</div>
              <div className="mt-1 text-sm font-medium">
                {status?.current_at_label || "出厂快照"}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground">已定价模型</div>
              <div className="mt-1 text-sm font-medium tabular-nums">{status?.models ?? "—"}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground">策略表</div>
              <div className="mt-1 text-sm font-medium tabular-nums">{status?.policies ?? "—"} 条</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="text-xs text-muted-foreground">上次 / 下次</div>
              <div className="mt-1 text-xs">
                {status?.last_run_label || "—"}
                {status?.next_run_label ? ` · ${status.next_run_label}` : ""}
              </div>
            </div>
          </div>

          {status?.last_error ? (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              <TriangleAlertIcon />
              <span>上次取价失败：{status.last_error}</span>
            </div>
          ) : null}

          <div className="rounded-lg border border-border/60">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <InfoIcon />
                未定价模型 {summary.total ?? 0} 个
              </span>
              <span>
                无对应 {summary.or_missing ?? 0} · 变体未命中 {summary.variant_unmatched ?? 0} · 别名{" "}
                {summary.aliases ?? 0}
              </span>
            </div>
            {gaps.length ? (
              <div className="max-h-72 overflow-auto">
                {gaps.map((gap) => (
                  <div
                    key={gap.model}
                    className="flex flex-wrap items-center gap-2 border-t border-border/50 px-3 py-2 text-xs first:border-t-0"
                  >
                    <span className="min-w-40 flex-1 truncate font-mono">{gap.model}</span>
                    <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                      {PRICING_REASON[gap.reason || ""] || gap.reason || "未定价"}
                    </Badge>
                    {gap.candidates?.length ? (
                      <span className="text-muted-foreground">候选：{gap.candidates.slice(0, 3).join("、")}</span>
                    ) : null}
                    {gap.reason !== "alias" ? (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          setMappingModel(gap.model);
                          setMappingValue(gap.candidates?.[0] || "");
                        }}
                      >
                        登记映射
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-3 py-6 text-center text-xs text-success">全部模型都有价。</div>
            )}
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(mappingModel)}
        onOpenChange={(open) => {
          if (!open) {
            setMappingModel(null);
            setMappingValue("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>登记定价映射</DialogTitle>
            <DialogDescription>
              为 {mappingModel} 指定 OpenRouter 的模型 id；留空提交即删除该映射。
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="pricing-map">OpenRouter 模型 id</FieldLabel>
            <Input
              id="pricing-map"
              value={mappingValue}
              onChange={(event) => setMappingValue(event.target.value)}
              placeholder="vendor/model"
              className="font-mono"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingModel(null)}>
              取消
            </Button>
            <Button onClick={() => void saveMapping()}>
              <CheckIcon data-icon="inline-start" />
              登记
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ *
 *  Advanced parameters
 * ------------------------------------------------------------------ */

interface SlotDraft {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  ip?: string;
  country?: string;
  country_code?: string;
  ip_type?: string;
  isp?: string;
  asn?: string;
  probed_at?: number;
  bound?: number;
  label?: string;
}

interface SlotCandidate {
  url: string;
  reachable?: boolean;
  exit_ip?: string;
  country?: string;
  country_code?: string;
  ip_type?: string;
  latency_ms?: number;
}

interface UpdateState {
  ok?: boolean;
  msg?: string;
  last_error?: string;
  update_available?: boolean;
  current_version?: string;
  latest_version?: string;
  last_attempt?: string;
  enabled?: boolean;
}

function updateFailure(data: UpdateState | null): string {
  if (!data) return "响应为空";
  if (data.ok === false) return data.msg || "更新检查未运行";
  return data.last_error || "";
}

function updateLabel(data: UpdateState | null): string {
  if (!data) return "未知";
  if (updateFailure(data)) return "检查失败";
  if (data.update_available) return "发现新版本";
  if (data.latest_version) return "已是最新";
  return "尚未检查";
}

function slotAutoName(slot: SlotDraft): string {
  const where = String(slot.country || "").trim();
  const kind = slot.ip_type === "residential" ? "住宅" : slot.ip_type === "datacenter" ? "机房" : "";
  if (!where) return slot.label || slot.id || "槽位";
  return kind ? `${where} ${kind}` : where;
}

function AdvancedTab({ dashboard }: { dashboard: DashboardController }) {
  const settings = dashboard.state.settings;
  const save = useSettingsSaver(dashboard);
  const [headerTimeout, setHeaderTimeout] = useState("120");
  const [idleTimeout, setIdleTimeout] = useState("300");
  const [promptMode, setPromptMode] = useState("passthrough");
  const [promptFile, setPromptFile] = useState("");
  const [updates, setUpdates] = useState<UpdateState | null>(null);
  const [checking, setChecking] = useState(false);
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [slotsDirty, setSlotsDirty] = useState(false);
  const [savingSlots, setSavingSlots] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [candidates, setCandidates] = useState<SlotCandidate[]>([]);
  const [testingSlot, setTestingSlot] = useState("");

  useEffect(() => {
    setHeaderTimeout(String(Number(settings?.upstream?.header_timeout_seconds ?? 120)));
    setIdleTimeout(String(Number(settings?.upstream?.idle_timeout_seconds ?? 300)));
    setPromptMode(settings?.prompt?.mode || "passthrough");
    setPromptFile(settings?.prompt?.file || "");
  }, [settings]);

  const loadSlots = useCallback(async () => {
    try {
      const response = await getJSON<{ slots?: SlotDraft[] }>("/proxy/slots");
      setSlots(response.slots || []);
      setSlotsDirty(false);
    } catch {
      setSlots([]);
    }
  }, []);

  const loadUpdates = useCallback(async () => {
    try {
      setUpdates(await getJSON<UpdateState>("/updates"));
    } catch {
      setUpdates({ ok: false, msg: "读取失败" });
    }
  }, []);

  useEffect(() => {
    void loadSlots();
    void loadUpdates();
  }, [loadSlots, loadUpdates]);

  async function checkUpdate() {
    setChecking(true);
    try {
      const data = await postJSON<UpdateState>("/updates/check", {});
      setUpdates(data);
      const failure = updateFailure(data);
      if (failure) {
        toast.error("检查更新失败: " + failure);
        return;
      }
      toast.success(data.update_available ? `发现新版本 ${data.latest_version}` : "已是最新版本");
    } catch (error) {
      toast.error("检查更新失败: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setChecking(false);
    }
  }

  function markSlots(next: SlotDraft[]) {
    setSlots(next);
    setSlotsDirty(true);
  }

  async function saveSlots() {
    setSavingSlots(true);
    try {
      const payload = slots.map((slot) => ({
        id: slot.id || "",
        name: slot.name || "",
        url: (slot.url || "").trim(),
        enabled: slot.enabled !== false,
        ip: slot.ip || "",
        country: slot.country || "",
        country_code: slot.country_code || "",
        ip_type: slot.ip_type || "",
        isp: slot.isp || "",
        asn: slot.asn || "",
        probed_at: slot.probed_at || 0,
      }));
      const response = await performAction<{ slots?: SlotDraft[] }>(
        "/proxy/slots/save",
        { slots: payload },
        `已保存 ${payload.length} 个代理槽`,
      );
      setSlots(response.slots || []);
      setSlotsDirty(false);
      await dashboard.loadAccounts();
    } catch {
      // performAction surfaced the error.
    } finally {
      setSavingSlots(false);
    }
  }

  async function testSlot(index: number) {
    const slot = slots[index];
    if (!slot?.url) {
      toast.warning("槽位还没有填写代理地址");
      return;
    }
    setTestingSlot(slot.id || slot.url);
    try {
      let id = slot.id;
      if (!id) {
        const saved = await postJSON<{ slots?: SlotDraft[] }>("/proxy/slots/save", {
          slots: slots.map((item) => ({ ...item, id: item.id || "" })),
        });
        setSlots(saved.slots || []);
        id = (saved.slots || [])[index]?.id || "";
        setSlotsDirty(false);
      }
      const result = await postJSON<{
        ok?: boolean;
        slot?: SlotDraft;
        country?: string;
        ip_type?: string;
        exit_ip?: string;
        latency_ms?: number;
        error?: string;
      }>("/proxy/slots/test", { id });
      if (result.ok) {
        await loadSlots();
        const where = [result.country, result.ip_type === "residential" ? "住宅" : result.ip_type === "datacenter" ? "机房" : ""]
          .filter(Boolean)
          .join(" ");
        toast.success(
          `出口 ${result.exit_ip}${where ? " · " + where : ""}（${result.latency_ms}ms）`,
        );
      } else {
        toast.error("测试失败: " + (result.error || "unknown"));
      }
    } catch (error) {
      toast.error("测试失败: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setTestingSlot("");
    }
  }

  async function discover() {
    setDiscovering(true);
    try {
      const response = await postJSON<{ candidates?: SlotCandidate[] }>("/proxy/discover", {});
      setCandidates(response.candidates || []);
    } catch (error) {
      toast.error("自动发现失败: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setDiscovering(false);
    }
  }

  function importCandidate(candidate: SlotCandidate) {
    if (slots.some((slot) => slot.url === candidate.url)) {
      toast.info("该出口已在列表中");
      return;
    }
    markSlots([
      ...slots,
      {
        id: "",
        name: "",
        url: candidate.url,
        enabled: true,
        bound: 0,
        ip: candidate.exit_ip || "",
        country: candidate.country || "",
        country_code: candidate.country_code || "",
        ip_type: candidate.ip_type || "",
        probed_at: Math.floor(Date.now() / 1000),
      },
    ]);
    toast.success("已加入槽位，记得点「保存槽位」");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <div className="flex flex-col gap-4">
        <SectionCard title="上游请求超时" description="网关向 WorkBuddy 上游发起请求时的等待上限。">
          <FieldGroup>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="header-timeout">响应头超时（秒）</FieldLabel>
                <Input
                  id="header-timeout"
                  type="number"
                  min={1}
                  value={headerTimeout}
                  onChange={(event) => setHeaderTimeout(event.target.value)}
                  className="font-mono"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="idle-timeout">空闲超时（秒）</FieldLabel>
                <Input
                  id="idle-timeout"
                  type="number"
                  min={1}
                  value={idleTimeout}
                  onChange={(event) => setIdleTimeout(event.target.value)}
                  className="font-mono"
                />
              </Field>
            </div>
          </FieldGroup>
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={() =>
                void save(
                  {
                    upstream: {
                      header_timeout_seconds: Math.max(1, toInt(headerTimeout, 120)),
                      idle_timeout_seconds: Math.max(1, toInt(idleTimeout, 300)),
                    },
                  },
                  "超时参数已保存",
                )
              }
            >
              <CheckIcon data-icon="inline-start" />
              保存超时
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="系统提示词" description="上游是否附加自定义提示词，以及提示词文件位置。">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="prompt-mode">提示词模式</FieldLabel>
              <Select value={promptMode} onValueChange={setPromptMode}>
                <SelectTrigger id="prompt-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="passthrough">透传（不改动）</SelectItem>
                    <SelectItem value="custom">自定义（替换）</SelectItem>
                    <SelectItem value="append">追加（在原文后追加）</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="prompt-file">提示词文件</FieldLabel>
              <Input
                id="prompt-file"
                value={promptFile}
                onChange={(event) => setPromptFile(event.target.value)}
                placeholder="留空使用默认位置"
                className="font-mono"
              />
              <FieldDescription>相对路径与绝对路径均可，留空表示使用默认文件。</FieldDescription>
            </Field>
          </FieldGroup>
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={() => void save({ prompt: { mode: promptMode, file: promptFile.trim() } }, "提示词设置已保存")}
            >
              <CheckIcon data-icon="inline-start" />
              保存提示词
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="调度与行为开关" description="这些开关直接影响网关的调度策略。">
          <FieldGroup>
            <SettingSwitch
              label="优先使用剩余积分"
              description="派发时优先选择剩余积分更充足或更临期的账号。"
              checked={settings?.remaining_priority_enabled === true}
              onCheckedChange={(value) => void save({ remaining_priority_enabled: value }, "已更新优先级策略")}
            />
            <SettingSwitch
              label="出口级瞬时失败退避"
              description="某个出口连续失败时短暂冷却，避免拖慢整体请求。"
              checked={settings?.egress_backoff_enabled === true}
              onCheckedChange={(value) => void save({ egress_backoff_enabled: value }, "已更新退避策略")}
            />
            <SettingSwitch
              label="自动切换产品"
              description="上游返回产品差异时自动切换以提升成功率。"
              checked={settings?.auto_switch_product === true}
              onCheckedChange={(value) => void save({ auto_switch_product: value }, "已更新产品策略")}
            />
            <SettingSwitch
              label="网页端每日活跃"
              description="每日活跃任务同时走网页端，提高活动完成率。"
              checked={settings?.daily_chat_web !== false}
              onCheckedChange={(value) => void save({ daily_chat_web: value }, "已更新每日活跃设置")}
            />
            <SettingSwitch
              label="本地 Web 工具"
              description="允许上游调用本地检索与浏览工具。"
              checked={settings?.local_web_tools === true}
              onCheckedChange={(value) => void save({ local_web_tools: value }, "已更新 Web 工具设置")}
            />
          </FieldGroup>
        </SectionCard>

        <SectionCard
          title="版本更新"
          description="面板只负责查询公开 Release；本版仅做检查，不会自动安装或重启。"
          action={
            <Badge
              variant="outline"
              className={cn(
                updateFailure(updates) && "border-warning/30 bg-warning/10 text-warning",
                updates?.update_available && "border-primary/30 bg-primary/10 text-primary",
              )}
            >
              {updateLabel(updates)}
            </Badge>
          }
        >
          <div className="flex flex-col">
            <InfoRow label="当前版本" value={updates?.current_version || settings?.version || "—"} />
            <InfoRow label="最新版本" value={updates?.latest_version || "—"} />
            <InfoRow label="上次检查" value={updates?.last_attempt || "—"} />
          </div>
          {updateFailure(updates) ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              <TriangleAlertIcon />
              <span>上次检查失败：{updateFailure(updates)}</span>
            </div>
          ) : null}
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Switch
                size="sm"
                checked={settings?.update_check_enabled !== false}
                onCheckedChange={(value) => void save({ update_check_enabled: value }, "已更新自动检查设置")}
              />
              <span className="text-xs text-muted-foreground">每天自动检查</span>
            </div>
            <Button variant="outline" size="sm" disabled={checking} onClick={() => void checkUpdate()}>
              <RefreshCwIcon data-icon="inline-start" className={checking ? "animate-spin" : undefined} />
              立即检查
            </Button>
          </div>
        </SectionCard>
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard
          title="账号代理槽"
          description="每个账号固定绑定一个出口槽；地址变化时绑定账号自动跟随，禁用或删除后回退直连。"
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant={slotsDirty ? "destructive" : "outline"}>{slots.length} 个</Badge>
              <Button variant="outline" size="sm" disabled={discovering} onClick={() => void discover()}>
                <RadioTowerIcon data-icon="inline-start" className={discovering ? "animate-pulse" : undefined} />
                自动发现
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  markSlots([...slots, { id: "", name: "", url: "", enabled: true, bound: 0 }])
                }
              >
                <PlusIcon data-icon="inline-start" />
                添加槽位
              </Button>
              <Button size="sm" disabled={savingSlots || !slotsDirty} onClick={() => void saveSlots()}>
                {savingSlots ? (
                  <RefreshCwIcon data-icon="inline-start" className="animate-spin" />
                ) : (
                  <CheckIcon data-icon="inline-start" />
                )}
                保存槽位
              </Button>
            </div>
          }
        >
          {slots.length ? (
            <div className="flex flex-col gap-3">
              {slots.map((slot, index) => (
                <div key={slot.id || `slot-${index}`} className="rounded-xl border border-border/70 bg-background/70 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor={`slot-name-${index}`}>名称</FieldLabel>
                      <Input
                        id={`slot-name-${index}`}
                        value={slot.name}
                        placeholder={slotAutoName(slot)}
                        onChange={(event) =>
                          markSlots(
                            slots.map((item, position) =>
                              position === index ? { ...item, name: event.target.value } : item,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`slot-url-${index}`}>代理地址</FieldLabel>
                      <Input
                        id={`slot-url-${index}`}
                        value={slot.url}
                        onChange={(event) =>
                          markSlots(
                            slots.map((item, position) =>
                              position === index ? { ...item, url: event.target.value } : item,
                            ),
                          )
                        }
                        placeholder="http://127.0.0.1:7890"
                        className="font-mono"
                      />
                    </Field>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Switch
                        size="sm"
                        checked={slot.enabled !== false}
                        onCheckedChange={(value) =>
                          markSlots(
                            slots.map((item, position) =>
                              position === index ? { ...item, enabled: value } : item,
                            ),
                          )
                        }
                      />
                      启用
                    </div>
                    <span className="flex items-center gap-1">
                      <NetworkIcon />
                      {slot.ip || "未探测"}
                      {slot.ip_type ? ` · ${slot.ip_type === "residential" ? "住宅" : "机房"}` : ""}
                    </span>
                    <span>绑定 {slot.bound ?? 0} 个账号</span>
                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={testingSlot === (slot.id || slot.url)}
                        onClick={() => void testSlot(index)}
                      >
                        {testingSlot === (slot.id || slot.url) ? (
                          <RefreshCwIcon data-icon="inline-start" className="animate-spin" />
                        ) : (
                          <ActivityIcon data-icon="inline-start" />
                        )}
                        测试
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-xs"
                        className="text-destructive hover:text-destructive"
                        aria-label="删除槽位"
                        onClick={() => markSlots(slots.filter((_, position) => position !== index))}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
              还没有代理槽。点击「自动发现」或「添加槽位」创建。
            </div>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            名称留空时按出口自动显示「国家 类型」；点「测试」会补全出口信息并据此命名。绑定账号的操作在账号池的出口下拉中完成。
          </p>
        </SectionCard>

        <SectionCard title="运行环境" description="网关运行时使用的目录与配置文件位置。">
          <div className="flex flex-col">
            <InfoRow label="版本" value={settings?.version || "—"} />
            <InfoRow label="账号目录" value={settings?.accounts_dir || "—"} />
            <InfoRow label="用量目录" value={settings?.usage_dir || "—"} />
            <InfoRow label="设置文件" value={settings?.settings_file || "—"} />
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <ServerIcon />
            以上路径由服务端提供，只读展示，前端不会写入任何本地数据。
          </div>
        </SectionCard>
      </div>

      {candidates.length ? (
        <div className="xl:col-span-2">
          <SectionCard
            title="发现到的出口"
            description="勾选要导入为槽位的出口；导入后仍需点击「保存槽位」写入。"
            action={
              <Button variant="outline" size="sm" onClick={() => setCandidates([])}>
                关闭
              </Button>
            }
          >
            <div className="grid gap-2">
              {candidates.map((candidate) => (
                <div
                  key={candidate.url}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs"
                >
                  <span className="font-mono">{candidate.url}</span>
                  <Badge
                    variant="outline"
                    className={candidate.reachable ? "border-success/30 bg-success/10 text-success" : "text-muted-foreground"}
                  >
                    {candidate.reachable ? `出口 ${candidate.exit_ip || "可达"} · ${candidate.latency_ms ?? "?"}ms` : "不可达"}
                  </Badge>
                  {candidate.country ? <span className="text-muted-foreground">{candidate.country}</span> : null}
                  <Button
                    variant="outline"
                    size="xs"
                    className="ml-auto"
                    disabled={!candidate.reachable}
                    onClick={() => importCandidate(candidate)}
                  >
                    <PlusIcon data-icon="inline-start" />
                    导入
                  </Button>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Page shell
 * ------------------------------------------------------------------ */

const TABS = [
  { value: "security", label: "安全与偏好", icon: ShieldCheckIcon },
  { value: "keys", label: "API Key", icon: KeyRoundIcon },
  { value: "limits", label: "限额与刷新", icon: SlidersHorizontalIcon },
  { value: "advanced", label: "高级参数", icon: ServerIcon },
] as const;

export function SettingsPage({ dashboard }: { dashboard: DashboardController }) {
  const [tab, setTab] = useState<string>("security");
  const [refreshing, setRefreshing] = useState(false);
  const settings = dashboard.state.settings;

  async function refresh() {
    setRefreshing(true);
    try {
      await dashboard.loadSettings();
      toast.success("设置已刷新");
    } catch (error) {
      toast.error("读取设置失败: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <PageFrame>
      <PageHeader
        title="系统设置"
        description="面板安全、API Key、账号限额、取价与高级运行参数。所有改动只写入网关自身的配置文件。"
        icon={Settings2Icon}
        actions={
          <>
            <Badge variant="outline" className="gap-1.5">
              <BadgeCheckIcon />
              版本 {settings?.version || "—"}
            </Badge>
            <Button variant="outline" size="sm" disabled={refreshing} onClick={() => void refresh()}>
              <RefreshCwIcon data-icon="inline-start" className={refreshing ? "animate-spin" : undefined} />
              刷新设置
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList
          variant="default"
          className="glass-panel h-auto! w-fit max-w-full justify-start gap-1 overflow-x-auto rounded-xl p-1 max-sm:grid max-sm:w-full max-sm:grid-cols-2"
        >
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className="h-8 flex-none gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-active:bg-primary! data-active:text-primary-foreground! data-active:shadow-sm sm:px-3 sm:text-sm"
              >
                <Icon />
                {item.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <TabsContent value="security">
          <SecurityTab dashboard={dashboard} />
        </TabsContent>
        <TabsContent value="keys">
          <ApiKeysTab dashboard={dashboard} />
        </TabsContent>
        <TabsContent value="limits">
          <LimitsRefreshTab dashboard={dashboard} />
        </TabsContent>
        <TabsContent value="advanced">
          <AdvancedTab dashboard={dashboard} />
        </TabsContent>
      </Tabs>
    </PageFrame>
  );
}
