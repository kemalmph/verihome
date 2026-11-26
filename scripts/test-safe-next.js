#!/usr/bin/env node
/** safeNext: unit test, no server needed. node scripts/test-safe-next.js */
(async () => {
  const path = require("path");
  const { safeNext } = await import(path.join(process.cwd(), "src/lib/auth/safe-next.ts"));
  let bad = 0;
  const eq = (input, want, fallback) => {
    const got = safeNext(input, fallback);
    const ok = got === want;
    if (!ok) bad++;
    console.log(`${ok ? "  ok  " : "  FAIL"} ${JSON.stringify(input)} -> ${JSON.stringify(got)}`);
  };
  const F = "/dashboard";
  eq("//evil.com", F);
  eq("/\\evil.com", F);
  eq("/\\\\evil.com", F);
  eq("/%5Cevil.com", F);
  eq("/%5cevil.com", F);
  eq("/%2F%2Fevil.com", F);
  eq("/%255Cevil.com", F);
  eq("/\t/evil.com", F);
  eq("/\n/evil.com", F);
  eq("/%09/evil.com", F);
  eq("/%0d%0a/evil.com", F);
  eq("/%zz", F);
  eq("https://evil.com", F);
  eq("javascript:alert(1)", F);
  eq("evil.com", F);
  eq("", F);
  eq(null, F);
  eq(undefined, "", "");
  eq("//evil.com", "", "");
  eq("/listings/abc?x=1", "/listings/abc?x=1");
  eq("/admin/users?tab=admins", "/admin/users?tab=admins");
  eq("/listings/a%20b", "/listings/a%20b");
  console.log(bad ? `\n${bad} failed` : "\nall passed");
  process.exit(bad ? 1 : 0);
})();
