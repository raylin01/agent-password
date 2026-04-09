import { chromium } from "playwright";

import { createAgentPassBrowser } from "../src/lib/browser-helper.mjs";

const browser = await chromium.launch({
  headless: false
});
const page = await browser.newPage();
const secrets = await createAgentPassBrowser();

await page.goto("https://example.com");

// Replace selectors and URL with a real site when you use this template.
await secrets.fillHandle(page, "#username", "COSTCO_USERNAME_1", "https://example.com");
await secrets.fillHandle(page, "#password", "COSTCO_PASSWORD_1", "https://example.com");

await browser.close();
