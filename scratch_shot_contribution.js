const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();

  const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await mobile.addInitScript(() => sessionStorage.setItem('introShown', '1'));
  await mobile.goto('http://localhost:3001/dev/contribution-moment-preview', { waitUntil: 'networkidle' });
  await mobile.screenshot({ path: 'scratch-mobile.png' });
  await mobile.close();

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.addInitScript(() => sessionStorage.setItem('introShown', '1'));
  await desktop.goto('http://localhost:3001/dev/contribution-moment-preview', { waitUntil: 'networkidle' });
  await desktop.screenshot({ path: 'scratch-desktop.png' });
  await desktop.close();

  await browser.close();
  console.log('done');
})();
