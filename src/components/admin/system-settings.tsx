"use client";

// ============================================================================
// SystemSettings — super-admin-only tab showing live system info.
//
// Cards:
//   1. AI Provider     — current provider, model, key status, SDK installed,
//                        "Test Connection" button with live result
//   2. Storage         — disk usage, file count, largest file, directory path
//   3. Database        — SQLite file size, path, connection URL
//   4. Sync & Data     — chemical/SDS/user/audit counts, last update, max version
//   5. System Runtime  — Node/Next.js versions, environment, uptime, timezone
// ============================================================================

import { useEffect, useState, useCallback } from "react";
import {
  RefreshCw,
  Loader2,
  Cpu,
  Database as DatabaseIcon,
  HardDrive,
  Brain,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types — mirror the API response
// ---------------------------------------------------------------------------

interface SystemInfo {
  ai: {
    provider: string;
    model: string;
    apiKeyConfigured: boolean;
    apiKeyHint: string | null;
    sdkInstalled: boolean;
    notes: string;
  };
  storage: {
    dir: string;
    totalBytes: number;
    fileCount: number;
    largestFile: { name: string; size: number } | null;
    averageBytes: number;
  };
  sync: {
    totalChemicals: number;
    deletedChemicals: number;
    availableSds: number;
    placeholderSds: number;
    totalSds: number;
    totalUsers: number;
    totalAuditLogs: number;
    lastUpdatedAt: number | null;
    maxServerVersion: number;
  };
  database: {
    type: string;
    path: string;
    sizeBytes: number;
    url: string;
  };
  system: {
    nodeVersion: string;
    platform: string;
    arch: string;
    environment: string;
    nextjsVersion: string;
    uptimeSeconds: number;
    currentTime: number;
    timezone: string;
  };
}

interface TestResult {
  ok: boolean;
  provider: string;
  model: string;
  latencyMs: number;
  responsePreview: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const v = bytes / Math.pow(1024, i);
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ${seconds % 60}s`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function formatTime(ts: number | null): string {
  if (!ts) return "never";
  return new Date(ts).toLocaleString();
}

const PROVIDER_COLORS: Record<string, string> = {
  zai: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200",
  gemini: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  openai: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  anthropic: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SystemSettings() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/system/info", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load system info");
      const data = await res.json();
      setInfo(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load system info");
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/system/test-ai", { method: "POST" });
      const data = await res.json();
      setTestResult(data);
      if (data.ok) {
        toast.success(
          `Connection OK — ${data.provider}/${data.model} (${data.latencyMs}ms)`
        );
      } else {
        toast.error(`Connection failed — ${data.error ?? "unknown error"}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setTestResult({
        ok: false,
        provider: info?.ai.provider ?? "?",
        model: "",
        latencyMs: 0,
        responsePreview: "",
        error: msg,
      });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  }

  if (loading && !info) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!info) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Failed to load system info.{" "}
        <Button variant="link" size="sm" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  const { ai, storage, sync, database, system } = info;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">System Settings</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Cards grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* AI Provider */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-violet-600" />
              AI Provider
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Provider</span>
              <Badge
                className={cn(
                  "font-mono",
                  PROVIDER_COLORS[ai.provider] ?? "bg-muted"
                )}
              >
                {ai.provider}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Model</span>
              <span className="font-mono text-xs">{ai.model}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">API key</span>
              {ai.apiKeyConfigured ? (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="font-mono text-xs">{ai.apiKeyHint}</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <XCircle className="h-3.5 w-3.5" />
                  <span className="text-xs">not set</span>
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">SDK installed</span>
              {ai.sdkInstalled ? (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="text-xs">yes</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <XCircle className="h-3.5 w-3.5" />
                  <span className="text-xs">missing</span>
                </span>
              )}
            </div>
            <p className="rounded bg-muted/40 p-2 text-xs text-muted-foreground">
              {ai.notes}
            </p>

            {/* Test Connection */}
            <div className="space-y-2 border-t pt-3">
              <Button
                size="sm"
                onClick={handleTestConnection}
                disabled={testing}
                className="w-full gap-2"
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Test Connection
              </Button>
              {testResult && (
                <div
                  className={cn(
                    "rounded border p-2 text-xs",
                    testResult.ok
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300"
                  )}
                >
                  <div className="flex items-center gap-1 font-medium">
                    {testResult.ok ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    {testResult.ok
                      ? `OK — ${testResult.latencyMs}ms`
                      : "FAILED"}
                  </div>
                  {testResult.ok && (
                    <div className="mt-1 font-mono text-[11px] opacity-80">
                      {testResult.responsePreview || "(empty response)"}
                    </div>
                  )}
                  {testResult.error && (
                    <div className="mt-1 font-mono text-[11px] opacity-80">
                      {testResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Storage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="h-4 w-4 text-sky-600" />
              Storage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">SDS files</span>
              <span className="font-mono">{storage.fileCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total size</span>
              <span className="font-mono">{formatBytes(storage.totalBytes)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Average file</span>
              <span className="font-mono">
                {formatBytes(storage.averageBytes)}
              </span>
            </div>
            {storage.largestFile && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Largest file</span>
                <span className="truncate font-mono text-xs" title={storage.largestFile.name}>
                  {storage.largestFile.name}{" "}
                  <span className="text-muted-foreground">
                    ({formatBytes(storage.largestFile.size)})
                  </span>
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Directory</span>
              <span
                className="truncate font-mono text-xs text-muted-foreground"
                title={storage.dir}
              >
                {storage.dir}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Database */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <DatabaseIcon className="h-4 w-4 text-navy-600" />
              Database
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Type</span>
              <Badge variant="secondary" className="font-mono uppercase">
                {database.type}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">File size</span>
              <span className="font-mono">{formatBytes(database.sizeBytes)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Path</span>
              <span
                className="truncate font-mono text-xs text-muted-foreground"
                title={database.path}
              >
                {database.path}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Connection URL</span>
              <span
                className="truncate font-mono text-xs text-muted-foreground"
                title={database.url}
              >
                {database.url}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Sync & Data */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4 text-amber-600" />
              Sync &amp; Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border p-2">
                <div className="text-xs text-muted-foreground">Chemicals</div>
                <div className="font-mono text-lg">{sync.totalChemicals}</div>
                <div className="text-[11px] text-muted-foreground">
                  {sync.deletedChemicals} deleted
                </div>
              </div>
              <div className="rounded border p-2">
                <div className="text-xs text-muted-foreground">SDS docs</div>
                <div className="font-mono text-lg">{sync.totalSds}</div>
                <div className="text-[11px] text-muted-foreground">
                  {sync.availableSds} available · {sync.placeholderSds} placeholder
                </div>
              </div>
              <div className="rounded border p-2">
                <div className="text-xs text-muted-foreground">Users</div>
                <div className="font-mono text-lg">{sync.totalUsers}</div>
              </div>
              <div className="rounded border p-2">
                <div className="text-xs text-muted-foreground">Audit entries</div>
                <div className="font-mono text-lg">{sync.totalAuditLogs}</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last chemical update</span>
              <span className="text-xs">{formatTime(sync.lastUpdatedAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Max server version</span>
              <span className="font-mono">{sync.maxServerVersion}</span>
            </div>
          </CardContent>
        </Card>

        {/* System Runtime */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-4 w-4 text-rose-600" />
              System Runtime
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Cpu className="h-3 w-3" />
                Node.js
              </div>
              <div className="font-mono">{system.nodeVersion}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Next.js</div>
              <div className="font-mono">{system.nextjsVersion}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Environment</div>
              <Badge
                variant={system.environment === "production" ? "default" : "secondary"}
                className="font-mono uppercase"
              >
                {system.environment}
              </Badge>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Platform</div>
              <div className="font-mono">
                {system.platform}/{system.arch}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Uptime
              </div>
              <div className="font-mono">
                {formatDuration(system.uptimeSeconds)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Timezone</div>
              <div className="font-mono text-xs">{system.timezone}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Current time</div>
              <div className="font-mono text-xs">
                {new Date(system.currentTime).toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
