"use client";

// ============================================================================
// Admin Dashboard — /admin
// Single-page dashboard with three tabs:
//   1. Overview — KPIs + recent activity
//   2. Chemicals — CRUD table for all chemicals
//   3. SDS — Upload / replace / view SDS documents
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import {
  FlaskConical,
  LayoutDashboard,
  Beaker,
  FileText,
  LogOut,
  Loader2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AdminOverview } from "@/components/admin/admin-overview";
import { ChemicalManager } from "@/components/admin/chemical-manager";
import { SdsManager } from "@/components/admin/sds-manager";

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState("overview");

  // While the session is loading, show a spinner.
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  // If no session, the middleware should have redirected. But as a fallback:
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Redirecting to login…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white">
            <FlaskConical className="h-5 w-5" />
          </span>
          <div className="hidden flex-col leading-none sm:flex">
            <span className="text-base font-bold">SDS-CHEM Admin</span>
            <span className="text-[11px] text-muted-foreground">
              {session.user.email}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/" target="_blank">
              <Button variant="outline" size="sm" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">View Site</span>
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="chemicals" className="gap-2">
              <Beaker className="h-4 w-4" />
              Chemicals
            </TabsTrigger>
            <TabsTrigger value="sds" className="gap-2">
              <FileText className="h-4 w-4" />
              SDS Documents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <AdminOverview />
          </TabsContent>
          <TabsContent value="chemicals">
            <ChemicalManager />
          </TabsContent>
          <TabsContent value="sds">
            <SdsManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
