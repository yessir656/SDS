"use client";

// ============================================================================
// AdminOverview — KPI cards + recent activity table
// ============================================================================

import { useEffect, useState } from "react";
import {
  FlaskConical,
  FileText,
  FileCheck,
  FileWarning,
  RefreshCw,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DashboardData {
  totalChemicals: number;
  deletedChemicals: number;
  totalSds: number;
  availableSds: number;
  placeholderSds: number;
  byDepartment: Record<string, number>;
  bySignalWord: Record<string, number>;
  recent: Array<{
    id: string;
    chemicalName: string;
    updatedAt: number;
    serverVersion: number;
    updatedByEmail: string | null;
    sdsStatus: string;
    sdsVersion: number;
  }>;
}

export function AdminOverview() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/dashboard");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-teal-600" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <Button onClick={fetchDashboard} variant="outline" className="mt-4 gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<FlaskConical className="h-4 w-4" />} label="Total Chemicals" value={data.totalChemicals} accent="teal" />
        <StatCard icon={<FileText className="h-4 w-4" />} label="Total SDS" value={data.totalSds} accent="slate" />
        <StatCard icon={<FileCheck className="h-4 w-4" />} label="Available SDS" value={data.availableSds} accent="emerald" />
        <StatCard icon={<FileWarning className="h-4 w-4" />} label="Placeholder SDS" value={data.placeholderSds} accent="amber" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-teal-600" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Chemical</th>
                  <th className="pb-2 pr-4 font-medium">SDS Status</th>
                  <th className="pb-2 pr-4 font-medium">Version</th>
                  <th className="pb-2 pr-4 font-medium">Updated By</th>
                  <th className="pb-2 font-medium">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{r.chemicalName}</td>
                    <td className="py-2 pr-4">
                      {r.sdsStatus === "available" ? (
                        <Badge className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Available</Badge>
                      ) : (
                        <Badge className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">Placeholder</Badge>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">v{r.serverVersion}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{r.updatedByEmail ?? "—"}</td>
                    <td className="py-2 text-muted-foreground">
                      {new Date(r.updatedAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const ACCENT_STYLES: Record<string, string> = {
  teal: "border-teal-200 bg-teal-50/50 dark:border-teal-900 dark:bg-teal-950/30",
  slate: "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30",
  emerald: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30",
  amber: "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30",
};

const ACCENT_ICON: Record<string, string> = {
  teal: "bg-teal-600 text-white",
  slate: "bg-slate-600 text-white",
  emerald: "bg-emerald-600 text-white",
  amber: "bg-amber-500 text-white",
};

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: keyof typeof ACCENT_STYLES }) {
  return (
    <Card className={ACCENT_STYLES[accent]}>
      <CardContent className="flex items-center gap-3 p-4">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ACCENT_ICON[accent]}`}>{icon}</span>
        <div className="min-w-0">
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="mt-1 truncate text-xs font-medium text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
