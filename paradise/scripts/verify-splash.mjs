import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const engines=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PARADISE_BROWSER||'chromium';
const base=process.env.PARADISE_URL||'http://127.0.0.1:8794/';
const output=process.env.PARADISE_REPORT_DIR||'verification/splash-current';
await mkdir(output,{recursive:true});
const browser=await engines[engine].launch({headless:true,args:engine==='chromium'&&process.platform==='darwin'?['--use-angle=metal','--enable-gpu']:[]});
const report={at:new Date().toISOString(),url:base,engine,errors:[],screenshots:[]};
async function capture(page,name){await page.screenshot({path:join(output,name)});report.screenshots.push(name);}
async function open(options={}){
  const context=await browser.newContext({viewport:{width:1440,height:900},...options});
  const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(base,{waitUntil:'networkidle'});await page.waitForSelector('body[data-ready="true"]');
  await page.locator('#begin').click();return {context,page};
}
try{
  const {context,page}=await open();
  await page.locator('#menu-button').click();await page.locator('#sound').click();await page.locator('#close-settings').click();
  await page.locator('#cast').click();
  await page.waitForFunction(()=>window.__paradise.spray().bursts===1);
  await page.waitForTimeout(120);report.impact=await page.evaluate(()=>window.__paradise.spray());
  assert.ok(report.impact.active>0&&report.impact.rendered>0&&report.impact.renderedCrowns>0);
  await capture(page,'cast-impact.png');
  await page.waitForFunction(()=>window.__paradise.spray().active===0&&window.__paradise.spray().crowns===0);
  report.settled=await page.evaluate(()=>window.__paradise.spray());
  assert.ok(report.settled.returned>0&&report.settled.feedback>0);
  assert.equal(report.settled.emitted,report.settled.returned+report.settled.expired);
  report.fluid=await page.evaluate(()=>window.__paradise.snapshot().fluid);
  assert.ok(report.fluid.impulseCount>1,'droplet contacts must enter the actual wave solver');
  await page.waitForFunction(()=>window.__paradise.snapshot().phase==='strike');
  await page.waitForTimeout(180);report.strike=await page.evaluate(()=>window.__paradise.spray());
  assert.ok(report.strike.bursts>=2&&report.strike.rendered>0);await capture(page,'strike-impact.png');
  assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true');
  await context.close();
  const reduced=await open({reducedMotion:'reduce'});await reduced.page.locator('#cast').click();
  await reduced.page.waitForFunction(()=>window.__paradise.snapshot().phase==='hunt');
  report.reduced=await reduced.page.evaluate(()=>({spray:window.__paradise.spray(),fluid:window.__paradise.snapshot().fluid}));
  assert.equal(report.reduced.spray.emitted,0);assert.ok(report.reduced.fluid.impulseCount>=1,'water feedback remains available in reduced motion');
  await reduced.context.close();assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;process.exitCode=1;}
finally{await browser.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
