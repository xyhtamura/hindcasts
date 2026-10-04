// Run: node proteus/test-ui.cjs [screenshot-directory]
// Set PLAYWRIGHT_PATH and EDGE_PATH when they are outside the default locations.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async () => {
  const browser = await chromium.launch({headless: true,
    executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 1000}, acceptDownloads: true});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(__dirname, 'proteus.html')).href);
    let chooser = page.waitForEvent('filechooser');
    await page.locator('#dropA').click(); await chooser;
    await page.locator('#dropB').focus();
    chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter'); await chooser;
    await page.evaluate(() => __proteus.debugTones());
    for (const [slot, name] of [['A', 'source-220.wav'], ['B', 'donor-440.wav']]) {
      const bytes = await page.evaluate(async slot => Array.from(new Uint8Array(await encodeWAV(S[slot]).arrayBuffer())), slot);
      await page.locator('#file' + slot).setInputFiles({name, mimeType: 'audio/wav', buffer: Buffer.from(bytes)});
      await page.waitForFunction(({slot, name}) => document.getElementById('name' + slot).textContent === name, {slot, name});
    }
    const tl = await page.locator('#tl').boundingBox();
    await page.mouse.move(tl.x + tl.width * .35, tl.y + tl.height * .7);
    await page.mouse.down();
    await page.mouse.move(tl.x + tl.width * .43, tl.y + tl.height * .7, {steps: 12});
    await page.mouse.up();
    assert.ok(await page.evaluate(() => S.bOffset > 0));
    const cv = await page.locator('#curve').boundingBox();
    await page.mouse.click(cv.x + cv.width * .4, cv.y + cv.height * .35);
    assert.equal(await page.evaluate(() => S.curve.length), 3);
    await page.mouse.move(cv.x + cv.width * .4, cv.y + cv.height * .35);
    await page.mouse.down();
    await page.mouse.move(cv.x + cv.width * .5, cv.y + cv.height * .6, {steps: 10});
    await page.mouse.up();
    assert.ok(await page.evaluate(() => Math.abs(S.curve[1].t - .5) < .02));
    await page.mouse.dblclick(cv.x + cv.width * .5, cv.y + cv.height * .6);
    assert.equal(await page.evaluate(() => S.curve.length), 2);
    await page.locator('#render').click();
    await page.waitForFunction(() => !!S.out);
    const download = page.waitForEvent('download');
    await page.locator('#export').click(); await download;
    await page.locator('#play').click();
    await page.waitForFunction(() => S.playing && playheadTime() > 0, {timeout: 10000});
    assert.ok(await page.evaluate(() => S.playing && playheadTime() > 0));
    await page.locator('#stop').click();
    const shotDir = process.argv[2];
    if (shotDir) {
      fs.mkdirSync(shotDir, {recursive: true});
      await page.screenshot({path: path.join(shotDir, 'proteus-desktop.png'), fullPage: true});
    }
    for (const width of [320, 390, 700, 1024]) {
      await page.setViewportSize({width, height: 844});
      await page.waitForTimeout(100);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}`);
      assert.ok(await page.locator('#curve').isVisible());
    }
    if (shotDir) {
      await page.setViewportSize({width: 390, height: 844});
      await page.screenshot({path: path.join(shotDir, 'proteus-mobile.png'), fullPage: true});
    }
    assert.deepEqual(errors, []);
    console.log('Pass: file picker click/keyboard, donor drag, curve add/drag/remove, render/export/playback, 320–1024 px layout.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
