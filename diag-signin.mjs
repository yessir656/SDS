// One-off: diagnose the signin callback response in detail.
const base = "http://localhost:3000";

const r1 = await fetch(`${base}/api/auth/csrf`);
const csrfSetCookies = r1.headers.getSetCookie();
const { csrfToken } = await r1.json();
console.log("csrf ok:", csrfToken ? "yes" : "no", "| csrf cookies:", csrfSetCookies.length);

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
console.log("signin status:", r2.status);
console.log("signin body:", (await r2.text()).slice(0, 300));
console.log("signin set-cookies:", r2.headers.getSetCookie().map((c) => c.split("=")[0]));
