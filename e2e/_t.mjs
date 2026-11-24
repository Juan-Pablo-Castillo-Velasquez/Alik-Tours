import { chromium } from "@playwright/test";
const pref = process.argv[2] || "antes";
const b = await chromium.launch();
for (const [n,w,h] of [["d",1440,900],["m",390,844]]) {
  const c = await b.newContext({viewport:{width:w,height:h}});
  await c.addInitScript(()=>{sessionStorage.setItem("alectours_welcome_splash_visto","1");localStorage.setItem("cookie_consent_ack","1");});
  await c.route(/unsplash|cloudinary/,r=>r.abort());
  const p = await c.newPage();
  for (const r of ["login","register"]) {
    await p.goto("http://localhost:5173/"+r); await p.waitForTimeout(2500);
    await p.screenshot({path:`/tmp/flujo/auth/${pref}-${r}-${n}.png`});
  }
  await c.close();
}
await b.close();
