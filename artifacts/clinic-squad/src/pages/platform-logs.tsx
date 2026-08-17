import { useMemo, useState } from "react";
import { Activity, Calendar, History, Search, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useLang } from "@/lib/lang";
import { formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AuditLog { id: string; adminEmail: string; action: string; details: string; createdAt: string; }

export default function PlatformLogsPage() {
  const { t, lang } = useLang();
  const [search, setSearch] = useState("");
  const auditQ = useQuery<AuditLog[]>({ queryKey: ["/api/platform/audit-logs"], queryFn: () => customFetch<AuditLog[]>("/api/platform/audit-logs"), staleTime: 30_000 });
  const logs = auditQ.data ?? [];
  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return logs;
    return logs.filter((log) => `${log.adminEmail} ${log.action} ${log.details}`.toLowerCase().includes(query));
  }, [logs, search]);
  const today = new Date().toDateString();
  const todayCount = logs.filter((log) => new Date(log.createdAt).toDateString() === today).length;
  const actionCount = new Set(logs.map((log) => log.action)).size;

  return (
    <ProtectedRoute requireRole="superadmin">
      <DashboardLayout>
        <div className="mx-auto max-w-6xl space-y-6 p-6">
          <div><div className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">{t("platformLogs.title")}</h1></div><p className="mt-1 text-sm text-muted-foreground">{t("platformLogs.subtitle")}</p></div>
          <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-xl border border-border bg-card p-5"><History className="h-4 w-4 text-primary" /><p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{t("platformLogs.total")}</p><p className="mt-1 text-2xl font-bold">{logs.length}</p></div><div className="rounded-xl border border-border bg-card p-5"><Calendar className="h-4 w-4 text-blue-600" /><p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{t("platformLogs.today")}</p><p className="mt-1 text-2xl font-bold text-blue-600">{todayCount}</p></div><div className="rounded-xl border border-border bg-card p-5"><Activity className="h-4 w-4 text-green-600" /><p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{t("platformLogs.actionTypes")}</p><p className="mt-1 text-2xl font-bold text-green-600">{actionCount}</p></div></div>
          <section className="overflow-hidden rounded-xl border border-border bg-card"><div className="flex flex-col gap-3 border-b border-border bg-muted/20 p-5 sm:flex-row sm:items-center"><div className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /><div><h2 className="font-semibold">{t("platformLogs.historyTitle")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("platformLogs.historySubtitle")}</p></div></div><div className="relative sm:ms-auto"><Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="h-9 w-full ps-9 sm:w-72" placeholder={t("platformLogs.search")} value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>{auditQ.isLoading ? <div className="py-14 text-center text-sm text-muted-foreground">{t("platformLogs.loading")}</div> : filteredLogs.length === 0 ? <div className="py-14 text-center text-sm text-muted-foreground">{t("platformLogs.empty")}</div> : <div className="divide-y divide-border">{filteredLogs.map((log) => <div key={log.id} className="px-5 py-4 hover:bg-muted/20"><div className="flex flex-col gap-2 sm:flex-row sm:items-start"><div className="flex min-w-0 flex-1 items-start gap-3"><div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary"><Activity className="h-4 w-4" /></div><div className="min-w-0"><p className="text-sm font-semibold">{log.action}</p><p className="mt-1 text-sm text-muted-foreground">{log.details}</p><p className="mt-2 text-xs text-muted-foreground">{log.adminEmail}</p></div></div><span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(log.createdAt)}</span></div></div>)}</div>}</section>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><h2 className="font-semibold">{t("platformLogs.securityTitle")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("platformLogs.securityText")}</p></div><Button className="ms-auto hidden sm:inline-flex" variant="outline" onClick={() => auditQ.refetch()}>{t("platformLogs.refresh")}</Button></div></div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
