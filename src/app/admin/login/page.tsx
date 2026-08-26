"use client";

// ============================================================================
// Admin Login Page — /admin/login
// ============================================================================

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminLoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the user is already authenticated, skip the login form and send them
  // straight to the dashboard. Previously, an authed admin visiting /admin/login
  // would see the login form again, which is confusing.
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/admin");
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password.");
      setLoading(false);
    } else if (result?.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      setError("Login failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    // Flat poster: solid navy block, geometric shapes, white color-block card.
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-navy-900 px-4">
      {/* Geometric decoration — low-opacity shapes, no depth */}
      <div className="absolute -left-28 -top-28 h-80 w-80 rounded-full bg-mirdc-cyan/10" />
      <div className="absolute -bottom-32 -right-24 h-96 w-96 rotate-12 rounded-3xl bg-white/5" />
      <div className="absolute right-14 top-12 h-20 w-20 rounded-full bg-white/5" />
      <div className="absolute bottom-20 left-16 h-10 w-10 rotate-45 rounded-md bg-mirdc-cyan/15" />

      {/* MIRDC logo + agency name */}
      <div className="relative mb-6 flex flex-col items-center gap-3 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-white">
          <Image
            src="/dost-mirdc-logo.png"
            alt="DOST-MIRDC logo"
            width={64}
            height={64}
            className="h-16 w-16 object-contain"
            priority
          />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            SDS-CHEM
          </h1>
          <p className="text-xs font-medium uppercase tracking-wider text-navy-200">
            DOST-MIRDC · Administrator Sign In
          </p>
        </div>
      </div>

      <Card className="relative w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldAlert className="h-5 w-5 text-navy-600" />
            Administrator Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                placeholder="admin@mirdc.dost.gov.ph"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full gap-2 text-base"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs">
            <a
              href="/"
              className="font-medium text-navy-200 hover:text-white hover:underline"
            >
              ← Back to public catalog
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
