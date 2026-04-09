import { createAgentPassBrowser } from "../src/lib/browser-helper.mjs";

const filled = [];
const fakePage = {
  url() {
    return "https://www.costco.com/account/login";
  },
  async fill(selector, value) {
    filled.push({
      selector,
      value
    });
  }
};

const browser = await createAgentPassBrowser();

await browser.fillHandle(fakePage, "#username", "COSTCO_USERNAME_1");
await browser.fillHandle(fakePage, "#password", "COSTCO_PASSWORD_1");

console.log("Browser helper filled selectors:");
console.log(JSON.stringify(filled, null, 2));
