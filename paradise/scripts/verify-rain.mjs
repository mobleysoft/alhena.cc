import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PARADISE_URL||'http://127.0.0.1:8798/?fluid=cpu';
const output=process.env.PARADISE_REPORT_DIR||'paradise/verification/task-7e79a431/rain';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:process.platform==='darwin'?['--use-angle=metal','--enable-gpu']:[]});
const report={url:base,checks:[],errors:[],samples:[]};
try{
  for(const [name,viewport,reducedMotion] of [
    ['desktop',{width:1440,height:900},'no-preference'],
    ['mobile',{width:390,height:844},'no-preference'],
    ['reduced-motion',{width:1440,height:900},'reduce']]){
    const context=await browser.newContext({viewport,reducedMotion});
    const page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
    await page.goto(base);await page.waitForSelector('body[data-ready="true"]');
    assert.equal((await page.evaluate(()=>window.__paradise.rain())).drops,0);
    await page.locator('#menu-button').click();
    await page.locator('[data-weather="storm"]').click();
    await page.locator('#close-settings').click();
    if(reducedMotion==='reduce'){
      await page.waitForTimeout(2000);
      const state=await page.evaluate(()=>window.__paradise.rain());
      assert.equal(state.drops,0);assert.equal(state.renderedRings,0);
    }else{
      await page.waitForFunction(()=>window.__paradise.rain().contacts>100&&window.__paradise.rain().renderedRings>0);
      const a=await page.evaluate(()=>window.__paradise.rain());
      await page.waitForTimeout(400);
      const b=await page.evaluate(()=>window.__paradise.rain());
      assert.ok(b.contacts>a.contacts);assert.ok(b.renderedRings<=64);
      report.samples.push({name,...b});
    }
    await page.screenshot({path:join(output,`${name}-storm.png`)});
    await page.locator('#menu-button').click();
    await page.locator('[data-time="night"]').click();
    await page.locator('#close-settings').click();
    await page.waitForTimeout(700);
    await page.screenshot({path:join(output,`${name}-night.png`)});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.locator('#menu-button').click();
    await page.locator('[data-weather="calm"]').click();
    await page.locator('#close-settings').click();
    await page.waitForFunction(()=>window.__paradise.rain().drops===0&&window.__paradise.rain().renderedRings===0);
    report.checks.push(`${name}: storm, moonlight, calm transition, no overflow`);
    await context.close();
  }
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;process.exitCode=1;}
finally{await browser.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
