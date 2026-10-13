import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CopyIcon,
  ExternalLinkIcon,
  FileJsonIcon,
  HardDriveDownloadIcon,
  Loader2Icon,
  RefreshCwIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { getJSON, postJSON } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import type { Realm } from "@/lib/types";
import { cn } from "cn";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const REALM_META: Record<Realm, { label: string; host: string }> = {
  intl: { label: "国际版", host: "www.workbuddy.ai" },
  cn: { label: "国内版", host: "copilot.tencent.com" },
};

/* ------------------------------------------------------------------ */
/* OAuth 添加账号                                                       */
/* ------------------------------------------------------------------ */

interface LoginStartResponse {
  state: string;
  authUrl: string;
  realm?: Realm;
  platform?: string;
}

interface LoginPollResponse {
  status: "pending" | "ok" | "error" | "expired" | "unknown" | string;
  message?: string;
  account?: { uid?: string; nickname?: string };
}

type StepState = "idle" | "active" | "done" | "error";

function LoginStep({
  index,
  title,
  state,
}: {
  index: number;
  title: string;
  state: StepState;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-mono",
          state === "done" && "border-success/40 bg-success/10 text-success",
          state === "active" && "border-primary/40 bg-primary/10 text-primary",
          state === "error" && "border-destructive/40 bg-destructive/10 text-destructive",
          state === "idle" && "border-border bg-muted text-muted-foreground",
        )}
      >
        {state === "done" ? (
          <CheckCircle2Icon className="size-3.5" />
        ) : state === "active" ? (
          <Loader2Icon className="size-3.5 animate-spin" />
        ) : state === "error" ? (
          <AlertTriangleIcon className="size-3.5" />
        ) : (
          index
        )}
      </span>
      <span className={cn("text-sm leading-6", state === "idle" ? "text-muted-foreground" : "text-foreground")}>
        {title}
      </span>
    </li>
  );
}

export function AddAccountDialog({
  open,
  onOpenChange,
  defaultRealm,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRealm: Realm;
  onAdded: () => Promise<unknown> | void;
}) {
  const [realm, setRealm] = useState<Realm>(defaultRealm);
  const [phase, setPhase] = useState<"starting" | "waiting" | "ok" | "error">("starting");
  const [authUrl, setAuthUrl] = useState("");
  const [message, setMessage] = useState("");
  const loginStateRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancelCurrent = useCallback(() => {
    const current = loginStateRef.current;
    loginStateRef.current = null;
    if (current) void postJSON("/accounts/login/cancel", { state: current }).catch(() => undefined);
  }, []);

  const poll = useCallback(
    async (stateValue: string) => {
      if (loginStateRef.current !== stateValue) return;
      try {
        const response = await getJSON<LoginPollResponse>(
          `/accounts/login/poll?state=${encodeURIComponent(stateValue)}`,
        );
        if (loginStateRef.current !== stateValue) return;
        if (response.message) setMessage(response.message);
        if (response.status === "ok") {
          stopPolling();
          loginStateRef.current = null;
          setPhase("ok");
          const who = response.account?.nickname || response.account?.uid || "";
          setMessage(`登录成功：${who} 已加入账号池`);
          toast.success("新账号已加入账号池");
          await onAdded();
          closeTimerRef.current = window.setTimeout(() => onOpenChange(false), 1400);
        } else if (["error", "expired", "unknown"].includes(response.status)) {
          stopPolling();
          setPhase("error");
        }
      } catch {
        // 轮询的瞬时错误不打断流程，下一个 tick 继续重试。
      }
    },
    [onAdded, onOpenChange, stopPolling],
  );

  const start = useCallback(
    async (target: Realm) => {
      stopPolling();
      cancelCurrent();
      setPhase("starting");
      setAuthUrl("");
      setMessage("");
      try {
        const response = await postJSON<LoginStartResponse>("/accounts/login/start", {
          platform: "CLI",
          realm: target,
        });
        if (!response.state || !response.authUrl) throw new Error("上游没有返回授权链接");
        loginStateRef.current = response.state;
        setAuthUrl(response.authUrl);
        setPhase("waiting");
        void poll(response.state);
        timerRef.current = window.setInterval(() => void poll(response.state), 2500);
      } catch (error) {
        setPhase("error");
        setMessage(error instanceof Error ? error.message : String(error));
      }
    },
    [cancelCurrent, poll, stopPolling],
  );

  useEffect(() => {
    if (!open) {
      stopPolling();
      cancelCurrent();
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      return;
    }
    setRealm(defaultRealm);
    void start(defaultRealm);
    return () => {
      stopPolling();
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
    // 仅在打开时重启；切换版本由下方的 onValueChange 显式处理。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => cancelCurrent(), [cancelCurrent]);

  const meta = REALM_META[realm];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>添加 WorkBuddy 账号</DialogTitle>
          <DialogDescription>
            选择版本后在浏览器完成 OAuth 授权，网关会自动把账号加入账号池。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">选择要登录的版本</div>
            <ToggleGroup
              type="single"
              value={realm}
              onValueChange={(value) => {
                if (!value) return;
                const next = value as Realm;
                setRealm(next);
                void start(next);
              }}
              className="w-full"
            >
              <ToggleGroupItem value="intl" className="flex-1 text-xs">
                国际版 · {REALM_META.intl.host}
              </ToggleGroupItem>
              <ToggleGroupItem value="cn" className="flex-1 text-xs">
                国内版 · {REALM_META.cn.host}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <ol className="flex flex-col gap-2">
            <LoginStep
              index={1}
              title={
                phase === "starting"
                  ? `正在向 ${meta.host} 申请授权链接…`
                  : `已向 ${meta.host} 申请授权链接`
              }
              state={phase === "starting" ? "active" : phase === "error" && !authUrl ? "error" : "done"}
            />
            <LoginStep
              index={2}
              title="在浏览器里打开授权链接并完成登录"
              state={authUrl ? (phase === "waiting" ? "active" : "done") : "idle"}
            />
            <LoginStep
              index={3}
              title="等待授权回调自动检测并入池"
              state={phase === "ok" ? "done" : phase === "error" ? "error" : phase === "waiting" ? "active" : "idle"}
            />
          </ol>

          {authUrl ? (
            <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="break-all font-mono text-[11px] leading-5 text-primary">{authUrl}</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void copyText(authUrl)
                      .then(() => toast.success("授权链接已复制"))
                      .catch((error) => toast.error(error instanceof Error ? error.message : String(error)))
                  }
                >
                  <CopyIcon data-icon="inline-start" />
                  复制链接
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={authUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon data-icon="inline-start" />
                    打开授权页
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                在浏览器完成登录后，本窗口会自动检测并完成入池。
              </p>
            </div>
          ) : null}

          {phase === "error" ? (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertTitle>发起失败</AlertTitle>
              <AlertDescription>{message || "请重试或检查网关到上游的网络。"}</AlertDescription>
            </Alert>
          ) : message ? (
            <Alert>
              {phase === "ok" ? <ShieldCheckIcon /> : <Loader2Icon className="animate-spin" />}
              <AlertTitle>{phase === "ok" ? "已加入账号池" : "等待授权"}</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => void start(realm)} disabled={phase === "starting"}>
            <RefreshCwIcon data-icon="inline-start" />
            重新生成链接
          </Button>
          <Button onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* 导入账号 JSON                                                       */
/* ------------------------------------------------------------------ */

interface ImportListEntry {
  uid?: string;
  reason?: string;
}

interface ImportPreview {
  added?: ImportListEntry[];
  updated?: ImportListEntry[];
  skipped?: ImportListEntry[];
  invalid?: ImportListEntry[];
}

interface ImportResponse {
  count?: number;
  result?: ImportPreview;
}

function entryUid(entry: ImportListEntry | string): string {
  if (typeof entry === "string") return entry;
  return String(entry?.uid || "?");
}

function ImportList({ label, entries }: { label: string; entries?: ImportListEntry[] }) {
  if (!entries?.length) return null;
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium text-muted-foreground">
        {label}（{entries.length}）
      </div>
      <ScrollArea className="max-h-28 rounded-md border bg-muted/20">
        <ul className="flex flex-col gap-1 p-2">
          {entries.map((entry, index) => (
            <li key={`${entryUid(entry)}-${index}`} className="flex items-baseline gap-2 text-xs">
              <code className="font-mono text-[11px] text-foreground">{entryUid(entry).slice(0, 12)}</code>
              {typeof entry !== "string" && entry.reason ? (
                <span className="text-muted-foreground">{entry.reason}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}

export function ImportAccountsDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => Promise<unknown> | void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<unknown[] | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [total, setTotal] = useState(0);
  const [overwrite, setOverwrite] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => {
    setFileName("");
    setRows(null);
    setPreview(null);
    setTotal(0);
    setOverwrite(false);
    setError("");
    setBusy(false);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  async function readFile(file: File) {
    setError("");
    setPreview(null);
    setRows(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      let doc: unknown;
      try {
        doc = JSON.parse(text);
      } catch {
        throw new Error("文件不是合法 JSON");
      }
      let parsedRows: unknown[];
      if (Array.isArray(doc)) {
        parsedRows = doc;
      } else if (doc && typeof doc === "object" && Array.isArray((doc as { accounts?: unknown[] }).accounts)) {
        parsedRows = (doc as { accounts: unknown[] }).accounts;
      } else if (doc && typeof doc === "object" && ("accessToken" in doc || "auth" in doc)) {
        parsedRows = [doc];
      } else {
        throw new Error("文件里没有找到账号（既没有 accounts 数组，也不是单个账号）");
      }
      if (!parsedRows.length) throw new Error("账号列表是空的");
      setRows(parsedRows);
      setTotal(parsedRows.length);
      const response = await postJSON<ImportResponse>("/accounts/import", { data: doc, dryRun: true });
      setPreview(response.result || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function commit() {
    if (!rows || busy) return;
    if (overwrite && !window.confirm("将覆盖同 UID 的现有账号（含其凭证），确定继续？")) return;
    setBusy(true);
    try {
      const response = await postJSON<ImportResponse>("/accounts/import", { data: rows, overwrite });
      const result = response.result || {};
      const added = result.added?.length || 0;
      const updated = result.updated?.length || 0;
      const skipped = result.skipped?.length || 0;
      const invalid = result.invalid?.length || 0;
      toast.success(`导入完成：新增 ${added}，覆盖 ${updated}，跳过 ${skipped}，无效 ${invalid}`);
      if (added + updated > 0) {
        onOpenChange(false);
        await onImported();
      } else {
        setPreview(result);
      }
    } catch (err) {
      toast.error(`导入失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  const added = preview?.added?.length || 0;
  const updated = preview?.updated?.length || 0;
  const skipped = preview?.skipped?.length || 0;
  const invalid = preview?.invalid?.length || 0;
  const canCommit = Boolean(rows) && added + updated > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>导入账号</DialogTitle>
          <DialogDescription>
            支持本网关导出的文件、账号数组、单个账号对象，以及桌面客户端的 {"{"}account, auth{"}"} 格式。
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void readFile(file);
          }}
        />

        <div className="flex flex-col gap-4">
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            <FileJsonIcon data-icon="inline-start" />
            选择账号 JSON 文件
          </Button>

          {fileName ? (
            <div className="text-xs text-muted-foreground">
              文件：<span className="font-medium text-foreground">{fileName}</span> · 共 {total} 条
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertTitle>读取失败</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {preview ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">新增 {added}</Badge>
                <Badge variant="outline">覆盖 {updated}</Badge>
                <Badge variant="outline">跳过 {skipped}</Badge>
                <Badge variant={invalid ? "destructive" : "outline"}>无效 {invalid}</Badge>
              </div>
              {added + updated === 0 ? (
                <Alert>
                  <AlertTriangleIcon />
                  <AlertTitle>没有可导入的账号</AlertTitle>
                  <AlertDescription>
                    {skipped
                      ? "若要覆盖已存在的账号，请勾选下方「覆盖同 UID 账号」。"
                      : "请确认文件内容后重试。"}
                  </AlertDescription>
                </Alert>
              ) : null}
              <ImportList label="将新增" entries={preview.added} />
              <ImportList label="将覆盖" entries={preview.updated} />
              <ImportList label="将跳过" entries={preview.skipped} />
              <ImportList label="无法解析" entries={preview.invalid} />
            </div>
          ) : null}
        </div>

        <DialogFooter className="sm:justify-between">
          <Field orientation="horizontal" className="w-auto">
            <Checkbox
              id="import-overwrite"
              checked={overwrite}
              onCheckedChange={(value) => setOverwrite(Boolean(value))}
            />
            <FieldLabel htmlFor="import-overwrite">覆盖同 UID 账号</FieldLabel>
          </Field>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button disabled={!canCommit || busy} onClick={() => void commit()}>
              {busy ? <Loader2Icon data-icon="inline-start" className="animate-spin" /> : null}
              确认导入 {added + updated > 0 ? added + updated : ""}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* 扫描本机桌面客户端                                                    */
/* ------------------------------------------------------------------ */

interface DesktopEntry {
  uid?: string;
  nickname?: string;
  domain?: string;
  expiresIn?: string;
  file?: string;
  path?: string;
  realm?: Realm;
  valid?: boolean;
  needsKey?: boolean;
  error?: string;
}

interface AtrestStatus {
  keyCached?: boolean;
  keyId?: string;
  huntSupported?: boolean;
  platform?: string;
}

interface DesktopScanResponse {
  detected?: DesktopEntry[];
  pool_uids?: string[];
  atrest?: AtrestStatus | null;
  imported?: { uid?: string; nickname?: string; realm?: Realm }[];
  ok?: boolean;
  msg?: string;
  keyId?: string;
}

export function DesktopImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => Promise<unknown> | void;
}) {
  const [scanning, setScanning] = useState(false);
  const [detected, setDetected] = useState<DesktopEntry[]>([]);
  const [poolUids, setPoolUids] = useState<Set<string>>(new Set());
  const [atrest, setAtrest] = useState<AtrestStatus | null>(null);
  const [importingPath, setImportingPath] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState("");
  const [scanned, setScanned] = useState(false);

  const scan = useCallback(async () => {
    setScanning(true);
    setError("");
    try {
      const response = await postJSON<DesktopScanResponse>("/accounts/import/desktop", {});
      setDetected(response.detected || []);
      setPoolUids(new Set(response.pool_uids || []));
      setAtrest(response.atrest || null);
      setScanned(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void scan();
    } else {
      setDetected([]);
      setPoolUids(new Set());
      setAtrest(null);
      setError("");
      setScanned(false);
    }
  }, [open, scan]);

  async function importEntry(entry: DesktopEntry) {
    if (!entry.path) return;
    setImportingPath(entry.path);
    try {
      const response = await postJSON<DesktopScanResponse>("/accounts/import/desktop", {
        path: entry.path,
        realm: entry.realm,
      });
      const imported = response.imported?.[0];
      const who = imported?.nickname || imported?.uid?.slice(0, 8) || "账号";
      toast.success(`已导入 ${who} 到${imported?.realm === "cn" ? "国内版" : "国际版"}`);
      await onImported();
      await scan();
    } catch (err) {
      toast.error(`导入失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImportingPath("");
    }
  }

  async function recoverKey() {
    setRecovering(true);
    try {
      const response = await postJSON<DesktopScanResponse>("/accounts/import/desktop", { recoverKey: true });
      if (!response.ok) throw new Error(response.msg || "回收失败");
      toast.success("解码密钥已回收，正在重新扫描");
      await scan();
    } catch (err) {
      toast.error(`回收失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRecovering(false);
    }
  }

  const valid = detected.filter((entry) => entry.valid);
  const needKey = detected.filter((entry) => !entry.valid && entry.needsKey);
  const broken = detected.filter((entry) => !entry.valid && !entry.needsKey);

  function renderSection(title: string, items: DesktopEntry[]) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-xs font-medium text-muted-foreground">
          {title}
          <span className="ml-1 text-muted-foreground/70">({items.length})</span>
        </div>
        {items.length ? (
          <div className="overflow-hidden rounded-lg border">
            {items.map((entry) => {
              const imported = entry.uid ? poolUids.has(entry.uid) : false;
              return (
                <div
                  key={entry.path || entry.uid}
                  className="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {entry.nickname || (entry.uid || "").slice(0, 8)}
                    </div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">
                      {(entry.uid || "").slice(0, 8)} · {entry.file} · {entry.expiresIn || "有效期未知"}
                    </div>
                  </div>
                  {imported ? (
                    <Badge variant="secondary">已导入</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(importingPath)}
                      onClick={() => void importEntry(entry)}
                    >
                      {importingPath === entry.path ? (
                        <Loader2Icon data-icon="inline-start" className="animate-spin" />
                      ) : (
                        <HardDriveDownloadIcon data-icon="inline-start" />
                      )}
                      导入
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
            未检测到该版本账号
          </div>
        )}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>本机桌面客户端账号</DialogTitle>
          <DialogDescription>
            只读检测本机客户端已登录的账号，点击「导入」才会加入网关。国际版与国内版会分别归入对应列表。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {atrest ? (
            atrest.keyCached ? (
              <Alert>
                <ShieldCheckIcon />
                <AlertTitle>解码密钥已就绪</AlertTitle>
                <AlertDescription>keyId {atrest.keyId || "-"}，加密凭据可直接导入。</AlertDescription>
              </Alert>
            ) : needKey.length ? (
              <Alert>
                <AlertTriangleIcon />
                <AlertTitle>检测到加密凭据</AlertTitle>
                <AlertDescription className="flex flex-col gap-2">
                  <span>
                    桌面客户端把 token 加密存储，需要从正在运行的 WorkBuddy 客户端进程内存里回收静态密钥（只读）。
                  </span>
                  {atrest.huntSupported ? (
                    <Button size="sm" variant="outline" disabled={recovering} onClick={() => void recoverKey()}>
                      {recovering ? (
                        <Loader2Icon data-icon="inline-start" className="animate-spin" />
                      ) : (
                        <ShieldCheckIcon data-icon="inline-start" />
                      )}
                      回收密钥
                    </Button>
                  ) : (
                    <span>
                      当前系统（{atrest.platform}）不支持进程内存回收，请改用「添加账号 (OAuth)」。
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            ) : null
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertTitle>扫描失败</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : scanning ? (
            <div className="flex flex-col gap-2">
              <div className="text-xs text-muted-foreground">正在检测本机桌面客户端账号…</div>
              <Progress value={60} className="animate-pulse" />
            </div>
          ) : scanned && !detected.length ? (
            <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              未在本机检测到桌面客户端登录凭证。
              <br />
              请确认已安装并登录 WorkBuddy 客户端后点「重新扫描」。
            </div>
          ) : (
            <>
              {renderSection("国际版 (Global) · www.workbuddy.ai", valid.filter((entry) => entry.realm !== "cn"))}
              {renderSection("国内版 (China) · copilot.tencent.com", valid.filter((entry) => entry.realm === "cn"))}
              {renderSection("待解码的凭证（加密存储）", needKey)}
              {renderSection("无法读取的凭证", broken)}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={scanning} onClick={() => void scan()}>
            <RefreshCwIcon data-icon="inline-start" className={scanning ? "animate-spin" : undefined} />
            重新扫描
          </Button>
          <Button onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
