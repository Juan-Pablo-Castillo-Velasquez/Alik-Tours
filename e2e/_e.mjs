import { chromium } from "@playwright/test";
const b = await chromium.launch(); const p = await b.newPage();
p.on("console", m => { if (m.type()==="error") console.log("ERR", m.text().slice(0,400)); });
p.on("pageerror", e => console.log("PAGEERR", e.message.slice(0,400)));
await p.goto("http://localhost:5173/"); await p.waitForTimeout(3000); await b.close();
