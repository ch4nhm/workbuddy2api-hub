import type { Realm } from "@/lib/types";

export const REALM_LABEL: Record<Realm, string> = {
  intl: "国际版",
  cn: "国内版",
};

export const PRODUCT_LABEL: Record<string, string> = {
  workbuddy: "WB",
  vscode: "VSC",
  cli: "CLI",
};

export const ACTIVITY_TASK_LABEL: Record<string, string> = {
  checkin: "签到",
  daily_chat: "每日活跃",
  activity_report: "活跃上报",
  travel: "猫猫旅行",
  streak_bonus: "连签奖励",
};

export const ACTIVITY_TRIGGER_LABEL: Record<string, string> = {
  manual: "手动",
  scheduler: "排程",
  auto: "自动",
};

export const OUTCOME_LABEL: Record<string, string> = {
  completed: "完成",
  client_aborted: "客户端中止",
  upstream_aborted: "上游中止",
  failed: "失败",
};

export function fmt(value: unknown, digits = 0): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function compact(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(abs >= 1e10 ? 0 : 1) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(abs >= 1e7 ? 0 : 1) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(abs >= 1e4 ? 0 : 1) + "K";
  return fmt(n);
}

export function pct(value: unknown, digits = 1): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function ms(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}s`;
  return `${Math.round(n)}ms`;
}

export function relativeTime(value?: number | string | null): string {
  if (value == null || value === "") return "—";
  const t = typeof value === "number" ? value * 1000 : Date.parse(value);
  if (!Number.isFinite(t)) return "—";
  const seconds = Math.round((Date.now() - t) / 1000);
  if (seconds < 5) return "刚刚";
  if (seconds < 60) return `${seconds} 秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

export function formatTime(value?: string | number | null, withDate = false): string {
  if (value == null || value === "") return "—";
  const d = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  if (!withDate) return time;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}`;
}

export function fmtLeft(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}m`;
}

export function accountName(
  uid: string,
  accounts: Array<{ uid: string; nickname: string }> | undefined,
  fallback = "—",
): string {
  if (!uid) return fallback;
  const hit = accounts?.find((a) => a.uid === uid);
  return hit?.nickname || uid.slice(0, 8);
}

export function isAccountActive(account: {
  enabled?: boolean;
  reserveBlocked?: boolean;
  dailyLimitBlocked?: boolean;
  creditLimitReached?: boolean;
}): boolean {
  return Boolean(
    account.enabled &&
      !account.reserveBlocked &&
      !account.dailyLimitBlocked &&
      !account.creditLimitReached,
  );
}

export function sumBy<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + (Number(pick(row)) || 0), 0);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
