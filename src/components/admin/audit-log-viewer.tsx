"use client";

// ============================================================================
// AuditLogViewer — super-admin-only UI for browsing the audit log.
//
// Features:
//   • Paginated table (newest first) with cursor pagination
//   • Filter by entity type and action prefix
//   • Expandable rows showing before/after JSON snapshots
//   • Color-coded action badges per entity type
// ============================================================================

import { useEffect, useState, useCallback, Fragment } from "react";
import {
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  Filter,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditEntry {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  before: string | null;
  after: string | null;
  ipAddress: string | null;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENTITY_COLORS: Record<string, string> = {
  chemical: "bg-teal-100 text-teal-900 dark:bg-teal-900/40 dark:text-teal-200",
  sds: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  user: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  session: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200",
};

function entityBadgeClass(entityType: string): string {
  return ENTITY_COLORS[entityType] ?? "bg-muted text-muted-foreground";
}

function prettyJson(raw: string | null): string {
  if (!raw) return "—";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuditLogViewer() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Filters
  const [entityType, setEntityType] = useState<string>("all");
  const [actionPrefix, setActionPrefix] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (entityType !== "all") params.set("entityType", entityType);
      if (actionPrefix !== "all") params.set("action", actionPrefix);
      const res = await fetch(`/api/admin/audit?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load audit log");
      const data = await res.json();
      setEntries(data.entries);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      console.error(err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, actionPrefix]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        limit: "50",
        cursor: nextCursor,
      });
      if (entityType !== "all") params.set("entityType", entityType);
      if (actionPrefix !== "all") params.set("action", actionPrefix);
      const res = await fetch(`/api/admin/audit?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load more");
      const data = await res.json();
      setEntries((prev) => [...prev, ...data.entries]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Audit Log</h2>
          <Badge variant="secondary" className="gap-1">
            <Activity className="h-3 w-3" />
            {entries.length} shown
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="al-entity" className="sr-only">
              Filter by type
            </Label>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger id="al-entity" className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="chemical">Chemicals</SelectItem>
                <SelectItem value="sds">SDS</SelectItem>
                <SelectItem value="user">Users</SelectItem>
                <SelectItem value="session">Sessions</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionPrefix} onValueChange={setActionPrefix}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                <SelectItem value="chemical.">Chemical ops</SelectItem>
                <SelectItem value="sds.">SDS ops</SelectItem>
                <SelectItem value="user.">User ops</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No audit entries yet. Try creating, editing, or deleting a
              chemical to see activity here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left">
                  <tr>
                    <th className="w-8 px-2 py-3" />
                    <th className="px-3 py-3 font-medium">When</th>
                    <th className="px-3 py-3 font-medium">Actor</th>
                    <th className="px-3 py-3 font-medium">Action</th>
                    <th className="px-3 py-3 font-medium">Summary</th>
                    <th className="hidden px-3 py-3 font-medium md:table-cell">
                      IP
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => {
                    const isOpen = expanded.has(e.id);
                    const hasDetail = !!e.before || !!e.after;
                    return (
                      <Fragment key={e.id}>
                        <tr
                          className={cn(
                            "border-b last:border-0 hover:bg-muted/30",
                            hasDetail && "cursor-pointer"
                          )}
                          onClick={() => hasDetail && toggleRow(e.id)}
                        >
                          <td className="px-2 py-3 text-center">
                            {hasDetail ? (
                              isOpen ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )
                            ) : null}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">
                            {formatTime(e.createdAt)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {e.actorEmail ?? (
                              <span className="text-muted-foreground">system</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge
                                variant="outline"
                                className={cn("font-mono text-xs", entityBadgeClass(e.entityType))}
                              >
                                {e.entityType}
                              </Badge>
                              <span className="font-mono text-xs text-muted-foreground">
                                {e.action}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3">{e.summary}</td>
                          <td className="hidden px-3 py-3 text-xs text-muted-foreground md:table-cell">
                            {e.ipAddress ?? "—"}
                          </td>
                        </tr>
                        {isOpen && hasDetail && (
                          <tr className="border-b bg-muted/20">
                            <td />
                            <td colSpan={5} className="px-3 py-3">
                              <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Before
                                  </div>
                                  <pre className="max-h-64 overflow-auto rounded bg-background p-3 text-xs">
                                    {prettyJson(e.before)}
                                  </pre>
                                </div>
                                <div>
                                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    After
                                  </div>
                                  <pre className="max-h-64 overflow-auto rounded bg-background p-3 text-xs">
                                    {prettyJson(e.after)}
                                  </pre>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="gap-2"
          >
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            Load older entries
          </Button>
        </div>
      )}
    </div>
  );
}
