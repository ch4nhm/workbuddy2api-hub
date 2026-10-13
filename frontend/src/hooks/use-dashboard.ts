import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getJSON,
  isAuthError,
  loginPanel,
  logoutPanel,
  onPanelSessionLost,
  POLL_READ,
  postJSON,
  setPanelToken,
} from "@/lib/api";
import type {
  Account,
  ActivityResponse,
  AnalyticsResponse,
  LogsResponse,
  Model,
  PerfResponse,
  ProxySlot,
  Realm,
  SchedulerStatus,
  Settings,
  TasksResponse,
  TimeseriesResponse,
  UsageRecent,
  UsageResponse,
} from "@/lib/types";

export type MainTab =
  | "gateway"
  | "accounts"
  | "tasks"
  | "analytics"
  | "agents"
  | "settings"
  | "logs";

export const MAIN_TABS: MainTab[] = [
  "gateway",
  "accounts",
  "tasks",
  "analytics",
  "agents",
  "settings",
  "logs",
];

const TAB_STORE = "wb-proxy-main-tab";
export type AnalyticsRange = "today" | "7d" | "30d" | "all";

export interface PanelStatus {
  panel_password_required?: boolean;
  panel_password_is_default?: boolean;
  authenticated?: boolean;
  api_key_set?: boolean;
}

export interface DashboardState {
  ready: boolean;
  panelStatus: PanelStatus;
  settings?: Settings;
  activeRealm: Realm;
  viewRealm: Realm;
  accounts: Account[];
  models: Model[];
  tasks?: TasksResponse;
  scheduler?: SchedulerStatus;
  usage?: UsageResponse;
  usageRecent?: UsageRecent;
  analytics?: AnalyticsResponse;
  timeseries?: TimeseriesResponse;
  perf?: PerfResponse;
  activity?: ActivityResponse;
  logs?: LogsResponse;
  proxySlots: ProxySlot[];
  agentsAvailable: boolean;
  loading: boolean;
  lastUpdated: number | null;
}

const initialState: DashboardState = {
  ready: false,
  panelStatus: {},
  activeRealm: "cn",
  viewRealm: "cn",
  accounts: [],
  models: [],
  proxySlots: [],
  agentsAvailable: false,
  loading: true,
  lastUpdated: null,
};

function initialTab(): MainTab {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("tab") as MainTab | null;
    if (fromUrl && MAIN_TABS.includes(fromUrl)) return fromUrl;
    const saved = localStorage.getItem(TAB_STORE) as MainTab | null;
    if (saved && MAIN_TABS.includes(saved)) return saved;
  } catch {
    // Gateway default below.
  }
  return "gateway";
}

function initialRealmView(): Realm | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("view");
    if (fromUrl === "intl" || fromUrl === "cn") return fromUrl;
  } catch {
    // Active gateway realm is used when the URL does not pin a view.
  }
  return null;
}

export function useDashboard() {
  const [state, setState] = useState<DashboardState>(initialState);
  const [tab, setTabState] = useState<MainTab>(initialTab);
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>("today");
  const stateRef = useRef(state);
  const tabRef = useRef(tab);
  const rangeRef = useRef(analyticsRange);
  const timers = useRef<number[]>([]);

  stateRef.current = state;
  tabRef.current = tab;
  rangeRef.current = analyticsRange;

  const patch = useCallback((next: Partial<DashboardState>) => {
    setState((current) => ({ ...current, ...next }));
  }, []);

  const stopPolling = useCallback(() => {
    timers.current.forEach((timer) => window.clearInterval(timer));
    timers.current = [];
  }, []);

  const sessionLost = useCallback(() => {
    stopPolling();
    setPanelToken("");
    setState((current) => ({
      ...current,
      ready: false,
      loading: false,
      panelStatus: { ...current.panelStatus, authenticated: false },
    }));
    toast.warning("会话已失效，请重新输入面板密码");
  }, [stopPolling]);

  useEffect(() => {
    onPanelSessionLost(sessionLost);
    return () => onPanelSessionLost(null);
  }, [sessionLost]);

  const loadSettings = useCallback(async () => {
    const settings = await getJSON<Settings>("/settings");
    patch({ settings });
    return settings;
  }, [patch]);

  const loadRealm = useCallback(async () => {
    const realmResponse = await getJSON<{ current: Realm; options: Realm[] }>("/realm");
    const pinnedView = initialRealmView();
    const viewRealm = pinnedView || realmResponse.current;
    patch({
      activeRealm: realmResponse.current,
      viewRealm,
    });
    return viewRealm;
  }, [patch]);

  const loadAccounts = useCallback(async () => {
    const [accountResponse, proxyResponse] = await Promise.all([
      getJSON<{ accounts: Account[] }>("/accounts?realm=all"),
      getJSON<{ slots?: ProxySlot[] }>("/proxy/slots").catch(() => ({ slots: [] })),
    ]);
    const accounts = accountResponse.accounts || [];
    patch({ accounts, proxySlots: proxyResponse.slots || [] });
    if (accounts.some((account) => !account.credits)) {
      postJSON<{ accounts: Account[] }>("/accounts/credits", {})
        .then((response) =>
          patch({ accounts: response.accounts?.length ? response.accounts : accounts }),
        )
        .catch(() => undefined);
    }
  }, [patch]);

  const loadModels = useCallback(async (realm = stateRef.current.viewRealm) => {
    const response = await getJSON<{ data: Model[] }>(
      `/v1/models?realm=${encodeURIComponent(realm)}`,
    );
    patch({ models: response.data || [] });
  }, [patch]);

  const loadTasks = useCallback(
    async (uid = "all") => {
      const query = uid && uid !== "all" ? `?uid=${encodeURIComponent(uid)}` : "";
      const response = await getJSON<TasksResponse>(`/tasks${query}`);
      patch({ tasks: response });
    },
    [patch],
  );

  const loadScheduler = useCallback(async () => {
    const scheduler = await getJSON<SchedulerStatus>("/scheduler");
    patch({ scheduler });
  }, [patch]);

  const loadUsage = useCallback(async () => {
    const [usage, byAccount, recent, activity] = await Promise.all([
      getJSON<UsageResponse>("/usage?range=today", POLL_READ),
      getJSON<unknown>("/usage/by-account", POLL_READ),
      getJSON<UsageRecent>("/usage/recent?limit=8&page=1", POLL_READ),
      getJSON<ActivityResponse>("/activity/history?range=today&limit=40").catch(
        () => ({ rows: [], total: 0 }),
      ),
    ]);
    patch({ usage, usageRecent: recent, activity, lastUpdated: Date.now() });
    return byAccount;
  }, [patch]);

  const loadAnalytics = useCallback(
    async (range = rangeRef.current, realm = stateRef.current.viewRealm) => {
      const query = new URLSearchParams({ range, realm });
      const [analytics, timeseries, perf] = await Promise.all([
        getJSON<AnalyticsResponse>(`/usage/analytics?${query}`, POLL_READ),
        getJSON<TimeseriesResponse>(`/usage/timeseries?${query}`, POLL_READ),
        getJSON<PerfResponse>(`/usage/perf?${query}`, POLL_READ),
      ]);
      patch({ analytics, timeseries, perf });
    },
    [patch],
  );

  const loadLogs = useCallback(
    async (limit = 300) => {
      const logs = await getJSON<LogsResponse>(`/logs?limit=${limit}`);
      patch({ logs });
    },
    [patch],
  );

  const loadAgents = useCallback(async () => {
    const response = await getJSON<{ enabled?: boolean }>("/agents/available");
    patch({ agentsAvailable: Boolean(response.enabled) });
  }, [patch]);

  const refresh = useCallback(async () => {
    await Promise.allSettled([
      loadUsage(),
      loadScheduler(),
      tabRef.current === "analytics" ? loadAnalytics() : Promise.resolve(),
      tabRef.current === "logs" ? loadLogs(300) : Promise.resolve(),
    ]);
  }, [loadAnalytics, loadLogs, loadScheduler, loadUsage]);

  const startPolling = useCallback(() => {
    stopPolling();
    timers.current = [
      window.setInterval(() => {
        if (document.hidden) return;
        void refresh();
      }, 5000),
      window.setInterval(() => {
        if (document.hidden) return;
        void loadScheduler();
      }, 30000),
      window.setInterval(() => {
        if (document.hidden) return;
        void loadAccounts().catch(() => undefined);
      }, 15000),
    ];
  }, [loadAccounts, loadAnalytics, loadScheduler, refresh, stopPolling]);

  const start = useCallback(async () => {
    patch({ loading: true });
    try {
      await loadSettings();
      const realm = await loadRealm();
      await Promise.allSettled([
        loadAccounts(),
        loadModels(realm),
        loadTasks(),
        loadScheduler(),
        loadUsage(),
        loadAnalytics(rangeRef.current, realm),
        loadAgents(),
        loadLogs(300),
      ]);
      patch({ ready: true, loading: false });
      startPolling();
    } catch (error) {
      if (isAuthError(error)) return;
      patch({ loading: false });
      toast.error("加载失败: " + (error instanceof Error ? error.message : String(error)));
    }
  }, [
    loadAccounts,
    loadAgents,
    loadAnalytics,
    loadLogs,
    loadModels,
    loadRealm,
    loadScheduler,
    loadSettings,
    loadTasks,
    loadUsage,
    patch,
    startPolling,
  ]);

  useEffect(() => {
    getJSON<PanelStatus>("/panel/status")
      .then(async (panelStatus) => {
        patch({ panelStatus });
        if (panelStatus.authenticated) {
          await start();
        } else {
          const password = new URLSearchParams(window.location.search).get("pwd");
          if (password) {
            try {
              await loginPanel(password);
              await start();
            } catch {
              patch({ loading: false });
            }
          } else {
            patch({ loading: false });
          }
        }
      })
      .catch(() => patch({ loading: false }));
    return stopPolling;
    // Boot runs once; the loaders intentionally read from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden || !stateRef.current.ready) return;
      void refresh();
      void loadAccounts().catch(() => undefined);
      void loadScheduler();
      if (tabRef.current === "analytics") void loadAnalytics();
      if (tabRef.current === "logs") void loadLogs(300);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [loadAccounts, loadAnalytics, loadLogs, loadScheduler, refresh]);

  const login = useCallback(
    async (password: string) => {
      const response = await loginPanel(password);
      if (response.using_default_password) {
        toast.warning("当前是默认密码 admin，建议到「设置」里修改");
      }
      toast.success("已进入面板");
      await start();
    },
    [start],
  );

  const logout = useCallback(async () => {
    stopPolling();
    await logoutPanel();
    window.location.reload();
  }, [stopPolling]);

  const setTab = useCallback((next: MainTab) => {
    setTabState(next);
    tabRef.current = next;
    try {
      localStorage.setItem(TAB_STORE, next);
    } catch {
      // Tab persistence is optional.
    }
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    history.replaceState(null, "", url.toString());
    if (next === "analytics") void loadAnalytics();
    if (next === "logs") void loadLogs(300);
    if (next === "tasks") void loadTasks();
    if (next === "agents") void loadAgents();
  }, [loadAgents, loadAnalytics, loadLogs, loadTasks]);

  const setViewRealm = useCallback(
    async (realm: Realm) => {
      patch({ viewRealm: realm });
      await Promise.allSettled([
        loadModels(realm),
        loadTasks(),
        loadAccounts(),
        loadAnalytics(rangeRef.current, realm),
      ]);
    },
    [loadAccounts, loadAnalytics, loadModels, loadTasks, patch],
  );

  const setActiveRealm = useCallback(
    async (realm: Realm) => {
      const response = await postJSON<{ current?: Realm }>("/realm", { realm });
      const current = response.current || realm;
      patch({ activeRealm: current, viewRealm: current });
      toast.success(`网关默认上游已切换为${current === "cn" ? "国内版" : "国际版"}`);
      await Promise.allSettled([
        loadAccounts(),
        loadModels(current),
        loadTasks(),
        loadAnalytics(rangeRef.current, current),
      ]);
    },
    [loadAccounts, loadAnalytics, loadModels, loadTasks, patch],
  );

  const changeAnalyticsRange = useCallback(
    (range: AnalyticsRange) => {
      setAnalyticsRange(range);
      rangeRef.current = range;
      return loadAnalytics(range, stateRef.current.viewRealm);
    },
    [loadAnalytics],
  );

  const refreshAll = useCallback(async () => {
    await Promise.allSettled([
      loadAccounts(),
      loadModels(),
      loadTasks(),
      loadScheduler(),
      loadUsage(),
      loadAnalytics(),
      loadLogs(300),
    ]);
    toast.success("数据已刷新");
  }, [loadAccounts, loadAnalytics, loadLogs, loadModels, loadScheduler, loadTasks, loadUsage]);

  return {
    state,
    tab,
    setTab,
    analyticsRange,
    setAnalyticsRange: changeAnalyticsRange,
    login,
    logout,
    refreshAll,
    setViewRealm,
    setActiveRealm,
    loadAccounts,
    loadUsage,
    loadAnalytics,
    loadScheduler,
    loadLogs,
    loadTasks,
    loadAgents,
    loadSettings,
    stopPolling,
  };
}

export type DashboardController = ReturnType<typeof useDashboard>;
