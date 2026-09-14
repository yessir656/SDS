// One-off staging verification (not part of the app).
const base = "http://localhost:3000";

const r1 = await fetch(`${base}/api/auth/csrf`);
const csrfSetCookies = r1.headers.getSetCookie();
const { csrfToken } = await r1.json();
const r2 = await fetch(`${base}/api/auth/callback/credentials`, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    cookie: csrfSetCookies.map((c) => c.split(";")[0]).join("; "),
  },
  body: new URLSearchParams({
    csrfToken,
    email: "admin@mirdc.dost.gov.ph",
    password: "BakalBoi",
    json: "true",
  }),
  redirect: "manual",
});
const cookie = [...csrfSetCookies, ...r2.headers.getSetCookie()]
  .map((c) => c.split(";")[0])
  .join("; ");
console.log("auth (DB: User table):", r2.status, r2.status === 200 ? "OK" : "FAIL");

const r3 = await fetch(`${base}/api/admin/chemicals`, { headers: { cookie } });
const j = await r3.json().catch(() => null);
console.log(
  "chemicals (DB: Chemical table):",
  r3.status,
  Array.isArray(j?.chemicals) ? `OK (${j.chemicals.length} rows)` : j?.error ?? "FAIL"
);
