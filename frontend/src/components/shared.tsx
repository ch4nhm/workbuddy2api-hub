import type { ComponentType, ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { Realm } from "@/lib/types";

export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="flex w-full flex-col gap-4 p-3 sm:p-4 lg:p-5"
    >
      {children}
    </motion.div>
  );
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="glass-panel flex size-9 shrink-0 items-center justify-center rounded-lg text-primary">
          <Icon />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
          <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon: ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "warning" | "destructive";
}) {
  const toneClass = {
    default: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.16 }}>
      <Card size="sm" className="h-full">
        <CardHeader className="grid-cols-[1fr_auto] items-center">
          <CardDescription className="text-xs uppercase">{label}</CardDescription>
          <Icon className={toneClass} />
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="text-xl font-semibold tabular-nums lg:text-2xl">{value}</div>
          {detail ? <div className="text-xs text-muted-foreground">{detail}</div> : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function StatusBadge({
  active,
  activeText = "正常",
  inactiveText = "停用",
  warning,
}: {
  active: boolean;
  activeText?: string;
  inactiveText?: string;
  warning?: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5",
        active && !warning && "border-success/30 bg-success/10 text-success",
        active && warning && "border-warning/30 bg-warning/10 text-warning",
        !active && "border-border text-muted-foreground",
      )}
    >
      <span className={cn("status-dot size-1.5 rounded-full bg-current", active && "animate-pulse")} />
      {active ? activeText : inactiveText}
    </Badge>
  );
}

export function RealmBadge({ realm }: { realm: Realm }) {
  return (
    <Badge variant="secondary" className={realm === "cn" ? "text-primary" : "text-chart-4"}>
      {realm === "cn" ? "国内版" : "国际版"}
    </Badge>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  description: string;
  icon: ComponentType;
  action?: ReactNode;
}) {
  return (
    <Empty className="min-h-52 border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action}
    </Empty>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
