const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const base = process.env.APP_URL || "http://localhost:3000";
const outDir = path.join(__dirname, "..", "output", "screenshots");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function login(page, username, password) {
  await page.goto(base + "/login.html", { waitUntil: "networkidle" });
  await page.fill("#username", username);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard.html");
  await page.waitForSelector(".survey-item, .empty");
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(chromePath) ? chromePath : undefined
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 860 },
    deviceScaleFactor: 1.5,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai"
  });
  const page = await context.newPage();

  await page.goto(base + "/login.html", { waitUntil: "networkidle" });
  await page.screenshot({
    path: path.join(outDir, "00-login.png"),
    fullPage: false
  });

  await login(page, "demo", "demo123");
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(outDir, "01-dashboard.png"),
    fullPage: false
  });

  await page.goto(base + "/questions.html", {
    waitUntil: "networkidle"
  });
  await page.waitForSelector("#libraryList .survey-item");
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(outDir, "05-library.png"),
    fullPage: true
  });

  await page.goto(
    base + "/builder.html?id=66f100000000000000000002",
    { waitUntil: "networkidle" }
  );
  await page.waitForSelector("#questionList .question-block");
  await page.click("#questionList button[data-edit]");
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(outDir, "02-builder.png"),
    fullPage: true
  });

  await page.goto(
    base + "/stats.html?id=66f100000000000000000001",
    { waitUntil: "networkidle" }
  );
  await page.waitForSelector(".question-block");
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(outDir, "03-stats.png"),
    fullPage: true
  });

  const studentContext = await browser.newContext({
    viewport: { width: 1440, height: 860 },
    deviceScaleFactor: 1.5,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai"
  });
  const studentPage = await studentContext.newPage();
  await login(studentPage, "xiaoming", "123456");
  await studentPage.goto(base + "/survey/campus26", {
    waitUntil: "networkidle"
  });
  await studentPage.waitForSelector("#startButton");
  await studentPage.click("#startButton");
  await studentPage.waitForSelector("#questionCard h2");
  await studentPage.check('input[name="answer"][value="B"]');
  await studentPage.click("#nextButton");
  await studentPage.waitForTimeout(400);
  await studentPage.screenshot({
    path: path.join(outDir, "04-fill.png"),
    fullPage: false
  });

  await browser.close();
  console.log("截图已保存到 " + outDir);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
