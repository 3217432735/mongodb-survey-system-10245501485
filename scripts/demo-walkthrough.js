const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const base = "http://localhost:3000";
const outDir = path.join(__dirname, "..", "output", "demo");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function login(page, username, password) {
  await page.goto(base + "/login.html", { waitUntil: "networkidle" });
  await page.fill("#username", username);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard.html");
}

async function shot(page, name) {
  await page.waitForTimeout(350);
  await page.screenshot({
    path: path.join(outDir, name),
    fullPage: false
  });
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(chromePath) ? chromePath : undefined
  });
  const options = {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.2,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai"
  };

  const ownerContext = await browser.newContext(options);
  const owner = await ownerContext.newPage();
  await owner.goto(base + "/login.html", { waitUntil: "networkidle" });
  await owner.fill("#username", "demo");
  await owner.fill("#password", "demo123");
  await shot(owner, "01-login.png");

  await owner.click("button[type=submit]");
  await owner.waitForURL("**/dashboard.html");
  await owner.waitForSelector(".survey-item");
  await shot(owner, "02-dashboard.png");

  await owner.goto(
    base + "/builder.html?id=66f100000000000000000002",
    { waitUntil: "networkidle" }
  );
  await owner.waitForSelector("#questionList .question-block");
  await owner.click("#questionList button[data-edit]");
  await owner.waitForTimeout(400);
  await shot(owner, "03-builder.png");

  const fillerContext = await browser.newContext(options);
  const filler = await fillerContext.newPage();
  await login(filler, "xiaoming", "123456");
  await filler.goto(base + "/survey/campus26", { waitUntil: "networkidle" });
  await filler.click("#startButton");
  await filler.waitForSelector("#questionCard h2");
  await shot(filler, "04-fill-q1.png");

  await filler.check('input[name="answer"][value="B"]');
  await filler.click("#nextButton");
  await filler.waitForTimeout(300);
  await filler.check('input[name="answer"][value="A"]');
  await filler.click("#nextButton");
  await filler.waitForSelector("#fillError:not(:empty)");
  await shot(filler, "05-validation.png");

  await filler.check('input[name="answer"][value="D"]');
  await filler.click("#nextButton");
  await filler.waitForFunction(
    () => document.querySelector("#questionCard h2")?.textContent.includes("食堂打几分")
  );
  await shot(filler, "06-jump.png");

  await filler.fill("#numberAnswer", "8");
  await filler.click("#nextButton");
  await filler.waitForSelector("#doneBox:not(.hidden)");
  await shot(filler, "07-success.png");

  await owner.goto(
    base + "/stats.html?id=66f100000000000000000001",
    { waitUntil: "networkidle" }
  );
  await owner.waitForSelector(".question-block");
  await shot(owner, "08-stats.png");

  await browser.close();
  console.log("演示截图已保存到 " + outDir);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
