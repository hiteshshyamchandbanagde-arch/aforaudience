const { chromium } = require('playwright');

const BASE = 'http://localhost:3001';
const EVENT_ID = 'qa-general-event-01'; // Nimbahera Showcase #1 - free, GA, upcoming, 80/80 available

async function login(page) {
  await page.addInitScript(() => sessionStorage.setItem('introShown', '1'));
  await page.goto(`${BASE}/login/`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="AFA code"]', 'atul.audience@aforaudience.qa');
  await page.locator('input[type="password"]').fill('QaPass!2026');
  await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In")').first().dispatchEvent('click');
  await page.waitForTimeout(2000);
}

(async () => {
  const browser = await chromium.launch();

  for (const [name, viewport] of [['mobile', { width: 375, height: 812 }], ['desktop', { width: 1440, height: 900 }]]) {
    const page = await browser.newPage({ viewport });
    page.on('console', (msg) => { if (msg.type() === 'error') console.log(`[${name} console]`, msg.text()); });
    await login(page);
    console.log(name, 'post-login url:', page.url());

    await page.goto(`${BASE}/events/${EVENT_ID}/seats/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Bump the GA "seats" quantity stepper to 1, then click the book button.
    const plusButtons = page.locator('button:has-text("+")');
    const count = await plusButtons.count();
    console.log(name, 'plus buttons found:', count);
    if (count > 0) {
      await plusButtons.first().click();
      await page.waitForTimeout(300);
    }

    const bookBtn = page.locator('.afa-book-btn');
    await bookBtn.waitFor({ state: 'visible', timeout: 10000 });
    await bookBtn.dispatchEvent('click');

    // Wait for the contribution moment to mount (up to ~10s for the
    // booking POST + detail GET round-trip).
    await page.waitForSelector('text=You’re going.', { timeout: 15000 }).catch((e) => console.log(name, 'wait error:', e.message));
    await page.waitForTimeout(800);
    await page.screenshot({ path: `scratch-real-${name}.png` });
    await page.close();
  }

  await browser.close();
  console.log('done');
})();
