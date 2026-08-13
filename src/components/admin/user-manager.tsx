"use client";

// ============================================================================
// UserManager — super-admin-only UI for managing admin accounts.
//
// Features:
//   • List every admin user (email, name, role, status, last login)
//   • Add a new admin (email + temp password + role)
//   • Edit a user (name, role, reset password, disable/enable)
//   • Delete a user (with last-super-admin guard)
//   • Lockout prevention: cannot disable/delete self or downgrade own role
// ============================================================================

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  UserPlus,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Shield,
  Ban,
  CheckCircle2,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types — mirror the API responses.
// ---------------------------------------------------------------------------

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  disabled: boolean;
  passwordChangeRequired: boolean;
  lastLoginAt: number | null;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelative(ts: number | null): string {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserManager() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.users);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = (users ?? []).filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.name?.toLowerCase().includes(q) ?? false) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const superAdminCount = (users ?? []).filter(
    (u) => u.role === "SUPER_ADMIN" && !u.disabled
  ).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">User Management</h2>
          <Badge variant="secondary" className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            {superAdminCount} super-admin{superAdminCount !== 1 ? "s" : ""}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full pl-8 sm:w-64"
            />
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
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Add User</span>
          </Button>
        </div>
      </div>

      {/* Hint card */}
      <Card className="border-dashed bg-muted/30">
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <div className="text-muted-foreground">
            <strong className="text-foreground">SUPER_ADMIN</strong> can create,
            edit, disable, and delete admin accounts. You cannot disable or
            delete your own account, remove your own super-admin role, or remove
            the last active super-admin. All actions are written to the audit log.
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading && !users ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No users found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">
                      Last Login
                    </th>
                    <th className="hidden px-4 py-3 font-medium lg:table-cell">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => {
                    const isSelf = u.id === currentUserId;
                    return (
                      <tr
                        key={u.id}
                        className="border-b last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {u.name ?? u.email}
                              {isSelf && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  (you)
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {u.email}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {u.role === "SUPER_ADMIN" ? (
                            <Badge className="gap-1 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200">
                              <ShieldCheck className="h-3 w-3" />
                              Super Admin
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <Shield className="h-3 w-3" />
                              Admin
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {u.disabled ? (
                            <Badge variant="destructive" className="gap-1">
                              <Ban className="h-3 w-3" />
                              Disabled
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="gap-1 border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Active
                            </Badge>
                          )}
                          {u.passwordChangeRequired && !u.disabled && (
                            <Badge
                              variant="outline"
                              className="ml-1 gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                              title="User must change their password on next login"
                            >
                              <KeyRound className="h-3 w-3" />
                              PW change
                            </Badge>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                          {formatRelative(u.lastLoginAt)}
                        </td>
                        <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditTarget(u)}
                              className="gap-1"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(u)}
                              disabled={isSelf}
                              className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                              title={isSelf ? "You cannot delete your own account" : "Delete user"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Delete</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          setCreateOpen(false);
          void load();
        }}
      />

      {/* Edit dialog */}
      <EditUserDialog
        target={editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          void load();
        }}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <strong>{deleteTarget?.email}</strong>. Their audit log entries
              will be preserved (with the email denormalized). This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  const res = await fetch(
                    `/api/admin/users/${deleteTarget.id}`,
                    { method: "DELETE" }
                  );
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || "Delete failed");
                  }
                  toast.success(`Deleted ${deleteTarget.email}`);
                  setDeleteTarget(null);
                  void load();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Delete failed");
                }
              }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CreateUserDialog
// ---------------------------------------------------------------------------

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "SUPER_ADMIN">("ADMIN");
  const [requirePasswordChange, setRequirePasswordChange] = useState(true);
  const [saving, setSaving] = useState(false);

  function reset() {
    setEmail("");
    setName("");
    setPassword("");
    setRole("ADMIN");
    setRequirePasswordChange(true);
  }

  async function handleCreate() {
    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim() || undefined,
          password,
          role,
          passwordChangeRequired: requirePasswordChange,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Create failed");
      }
      toast.success(`Created ${role} account for ${email}`);
      reset();
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Admin User</DialogTitle>
          <DialogDescription>
            Create a new admin account. The user can sign in immediately with
            the temporary password you set.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cu-email">Email</Label>
            <Input
              id="cu-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@mirdc.dost.gov.ph"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-name">Display name (optional)</Label>
            <Input
              id="cu-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan Dela Cruz"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-pass">Temporary password</Label>
            <Input
              id="cu-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              Communicate this securely to the user.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(v: "ADMIN" | "SUPER_ADMIN") => setRole(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin — manage chemicals & SDS</SelectItem>
                <SelectItem value="SUPER_ADMIN">
                  Super Admin — full access + user management
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label
            className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/30"
            htmlFor="cu-force-pw"
          >
            <input
              id="cu-force-pw"
              type="checkbox"
              checked={requirePasswordChange}
              onChange={(e) => setRequirePasswordChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input"
            />
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Require password change on next login</div>
              <div className="text-xs text-muted-foreground">
                User will be redirected to a password-change page before they
                can reach the dashboard. Recommended for temporary passwords.
              </div>
            </div>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// EditUserDialog
// ---------------------------------------------------------------------------

function EditUserDialog({
  target,
  onOpenChange,
  onSaved,
}: {
  target: AdminUser | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { data: session } = useSession();
  const isSelf = target?.id === session?.user?.id;

  const [name, setName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "SUPER_ADMIN">("ADMIN");
  const [disabled, setDisabled] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [requirePwChange, setRequirePwChange] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync form state when target changes.
  useEffect(() => {
    if (target) {
      setName(target.name ?? "");
      setRole(target.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN");
      setDisabled(target.disabled);
      setRequirePwChange(target.passwordChangeRequired);
      setNewPassword("");
    }
  }, [target]);

  async function handleSave() {
    if (!target) return;
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {
        // Send undefined (omitted from JSON) when name is empty so the server
        // preserves the existing name instead of overwriting it with null.
        // The server schema also accepts null for defense-in-depth (see
        // updateUserSchema in /api/admin/users/[id]/route.ts).
        ...(name.trim() ? { name: name.trim() } : {}),
        role,
        disabled,
        passwordChangeRequired: requirePwChange,
      };
      if (newPassword) {
        if (newPassword.length < 8) {
          toast.error("New password must be at least 8 characters");
          setSaving(false);
          return;
        }
        patch.password = newPassword;
      }
      const res = await fetch(`/api/admin/users/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Update failed");
      }
      toast.success(`Updated ${target.email}`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (!target) return null;

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {target.email}</DialogTitle>
          <DialogDescription>
            Update display name, role, account status, or reset the password.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="eu-name">Display name</Label>
            <Input
              id="eu-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="(no name set)"
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(v: "ADMIN" | "SUPER_ADMIN") => setRole(v)}
              disabled={isSelf && role === "SUPER_ADMIN"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
              </SelectContent>
            </Select>
            {isSelf && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                You cannot remove your own super-admin role.
              </p>
            )}
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Account status</div>
              <div className="text-xs text-muted-foreground">
                Disabled accounts cannot sign in.
              </div>
            </div>
            <Button
              variant={disabled ? "outline" : "destructive"}
              size="sm"
              disabled={isSelf}
              onClick={() => setDisabled(!disabled)}
              className="gap-2"
            >
              <Ban className="h-3.5 w-3.5" />
              {disabled ? "Enable account" : "Disable account"}
            </Button>
            {isSelf && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Cannot disable self
              </span>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="eu-pass" className="flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5" />
              Reset password (optional)
            </Label>
            <Input
              id="eu-pass"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
              autoComplete="new-password"
            />
            {newPassword && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Resetting the password will automatically require a change on
                next login unless you toggle that off below.
              </p>
            )}
          </div>
          <label
            className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/30"
            htmlFor="eu-force-pw"
          >
            <input
              id="eu-force-pw"
              type="checkbox"
              checked={requirePwChange}
              onChange={(e) => setRequirePwChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input"
            />
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Require password change on next login</div>
              <div className="text-xs text-muted-foreground">
                User will be redirected to a password-change page before they
                can reach the dashboard.
              </div>
            </div>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
