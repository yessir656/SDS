"use client";

// ============================================================================
// /admin/change-password
//
// Shown when a user's `passwordChangeRequired` flag is true (set by a
// super-admin when creating the account with a temp password, or when
// resetting a password). The user cannot navigate away to the dashboard until
// they change their password.
// ============================================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Lock, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export default function ChangePasswordPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  // If the user is no longer required to change their password (e.g. they
  // already did in another tab), send them to the dashboard.
  useEffect(() => {
    if (status === "authenticated" && !session?.user?.passwordChangeRequired) {
      router.replace("/admin");
    }
  }, [status, session, router]);

  // If not signed in, middleware will redirect to /admin/login.
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-navy-600" />
      </div>
    );
  }

  if (!session) {
    return null; // middleware handles redirect
  }

  const passwordsMatch = newPassword === confirmPassword;
  const newPasswordLongEnough = newPassword.length >= 8;
  const canSubmit =
    currentPassword.length > 0 &&
    newPasswordLongEnough &&
    passwordsMatch &&
    newPassword !== currentPassword &&
    !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to change password");
      }
      toast.success("Password changed. Redirecting to dashboard…");
      // Refresh the JWT so passwordChangeRequired=false is picked up.
      // Without this, the PasswordGuard would redirect back here because the
      // old JWT still has passwordChangeRequired=true.
      try {
        await update({});
      } catch {
        // Non-critical — the hard navigation below will still work, and the
        // session will refresh on the next request.
      }
      // Hard-navigate to /admin. The PasswordGuard will see the refreshed
      // session (passwordChangeRequired=false) and allow access.
      setTimeout(() => {
        window.location.href = "/admin";
      }, 500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <Lock className="h-5 w-5 text-amber-700 dark:text-amber-300" />
          </div>
          <CardTitle className="text-xl">Change your password</CardTitle>
          <CardDescription>
            Your account was created with a temporary password. Choose a new
            password to secure your account and continue to the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">Current password</Label>
              <div className="relative">
                <Input
                  id="current"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showCurrent ? "Hide password" : "Show password"}
                >
                  {showCurrent ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new">New password</Label>
              <div className="relative">
                <Input
                  id="new"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showNew ? "Hide password" : "Show password"}
                >
                  {showNew ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {newPassword.length > 0 && newPassword.length < 8 && (
                <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3 w-3" />
                  Must be at least 8 characters
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type={showNew ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  Passwords do not match
                </p>
              )}
              {confirmPassword.length > 0 && passwordsMatch && newPasswordLongEnough && (
                <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Passwords match
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={!canSubmit}
              className="w-full gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Change password &amp; continue
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="w-full text-muted-foreground"
            >
              Sign out instead
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
