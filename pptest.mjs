import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE ERROR: " + m.text()); });
page.on("pageerror", (e) => errors.push("PAGE ERROR: " + e.message));
await page.goto("http://localhost:3210/chattest", { waitUntil: "networkidle0" });

// Type a message in the PASSENGER chat input and submit.
const passInput = await page.$('[data-testid="passenger"] input');
await passInput.type("hello from passenger");
await passInput.press("Enter");
await new Promise(r => setTimeout(r, 800));

// Read message bubbles in both panes.
const read = async (sel) => page.$$eval(`[data-testid="${sel}"] .rounded-2xl`, els => els.map(e => e.textContent));
const passMsgs = await read("passenger");
const drvMsgs = await read("driver");
console.log("PASSENGER pane bubbles:", JSON.stringify(passMsgs));
console.log("DRIVER pane bubbles:", JSON.stringify(drvMsgs));
console.log("ERRORS:", errors.length ? errors : "none");
await browser.close();
