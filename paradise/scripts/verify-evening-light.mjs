import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const engines=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PARADISE_BROWSER||'webkit',url=process.env.PARADISE_URL||'http://127.0.0.1:8798/';
const output=process.env.PARADISE_REPORT_DIR||new URL('../verification/evening-current/',import.meta.url).pathname;
await mkdir(output,{recursive:true});
const browser=await engines[engine].launch({headless:true,args:engine==='chromium'?['--use-angle=metal','--enable-gpu']:[]});
const report={at:new Date().toISOString(),url,engine,errors:[],scenes:[]};
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).origin===new URL(url).origin)report.errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(url,{waitUntil:'networkidle'});await page.waitForSelector('body[data-ready=true]');
  for(const [time,weather] of [['noon','calm'],['sunset','breeze'],['night','calm'],['night','storm']]) {
    await page.locator('#menu-button').click();
    await page.locator(`button[data-time="${time}"]`).click();await page.locator(`button[data-weather="${weather}"]`).click();
    await page.locator('#close-settings').click();await page.waitForTimeout(1800);
    const state=await page.evaluate(()=>({scene:window.__paradise.snapshot(),lights:window.__paradise.lighting()}));
    assert.equal(state.scene.time,time);assert.equal(state.scene.weather,weather);assert.equal(state.lights.lightCount,4);assert.equal(state.lights.shadowLights,0);
    assert.equal(state.scene.phase,'idle');assert.equal(state.scene.waveComponents,32);
    if(time==='noon')assert.equal(state.lights.windowEmission,0);if(time==='night')assert.ok(state.lights.windowEmission>2);
    assert.ok(state.lights.lights.every(l=>l.position.every(Number.isFinite)));
    const image=`${time}-${weather}.png`;await page.screenshot({path:join(output,image)});report.scenes.push({...state,image});
  }
  await page.locator('#begin').click();await page.locator('#cast').click();
  await page.waitForFunction(()=>window.__paradise.snapshot().phase==='hunt');await page.waitForTimeout(1000);
  await page.screenshot({path:join(output,'night-fishing.png')});
  report.fishing=await page.evaluate(()=>window.__paradise.snapshot());assert.equal(report.fishing.phase,'hunt');
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload({waitUntil:'networkidle'});await page.waitForSelector('body[data-ready=true]');
  await page.locator('#menu-button').click();await page.locator('button[data-time="night"]').click();await page.locator('#close-settings').click();
  report.reduced=await page.evaluate(()=>window.__paradise.lighting());assert.ok(report.reduced.windowEmission>2);
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;process.exitCode=1;}
finally{await browser.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
