import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.env.PARADISE_URL||'http://127.0.0.1:8794/';
const output=process.env.PARADISE_REPORT_DIR||fileURLToPath(new URL('../verification/fluid-current/',import.meta.url));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu']});
const report={at:new Date().toISOString(),url,errors:[]};
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  await page.goto(url,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.body.dataset.ready==='true');
  await page.waitForTimeout(2000);
  report.initial=await page.evaluate(()=>window.__paradise.snapshot());
  report.optics=await page.evaluate(()=>window.__paradise.optics());
  assert.ok(report.optics.max>2&&report.optics.focusedPixels>100,'surface refraction must focus real light samples');
  report.parity=await page.evaluate(async()=>{
    const {createRippleField,createState,stepField,sampleField}=await import('/island/ripple-field.js');
    const f=createRippleField(()=>-2);await f.ready;
    if(f.snapshot().backend!=='webgpu'){const state=f.snapshot();f.dispose();return {verified:false,...state};}
    let a=createState(()=>-2),b=new Float32Array(a.length);let maxError=0;
    try{
      for(let tick=0;tick<90;tick++){
        const hits=tick===0?[{x:.5,z:19,strength:.22,radius:.22}]:tick===30?[{x:1,z:18,strength:.15,radius:.22}]:[];
        hits.forEach(hit=>f.impulse(hit.x,hit.z,hit.strength,hit.radius));
        stepField(a,b,hits);[a,b]=[b,a];
        const before=f.snapshot().published;f.step();
        const start=performance.now();
        while(f.snapshot().published===before){if(performance.now()-start>3000)throw new Error('GPU publication timed out');await new Promise(resolve=>setTimeout(resolve,1));}
        if(f.snapshot().backend!=='webgpu')throw new Error(f.snapshot().reason);
        for(let i=0;i<a.length;i+=4)maxError=Math.max(maxError,Math.abs(a[i]-f.data[i]));
      }
      const singleStepError=maxError;
      f.impulse(.5,19,.2);f.step();f.step();f.step();
      while(f.snapshot().pending)await new Promise(resolve=>setTimeout(resolve,1));
      f.step();while(f.snapshot().pending)await new Promise(resolve=>setTimeout(resolve,1));
      for(let tick=0;tick<4;tick++){stepField(a,b,tick===0?[{x:.5,z:19,strength:.2,radius:.22}]:[]);[a,b]=[b,a];}
      for(let i=0;i<a.length;i+=4)maxError=Math.max(maxError,Math.abs(a[i]-f.data[i]));
      return {verified:true,singleStepError,maxHeightError:maxError,gpu:f.snapshot(),sampleError:Math.abs(f.height(.5,19)-sampleField(a,.5,19))};
    }finally{f.dispose();}
  });
  assert.equal(report.parity.verified,true,'WebGPU compute must actually execute on this verification host');
  assert.ok(report.parity.maxHeightError<.0001,'WGSL matches reference wave integration');
  await page.screenshot({path:join(output,'landing.png')});
  await page.locator('#begin').click();await page.locator('#cast').click();
  await page.waitForFunction(()=>window.__paradise.snapshot().phase==='hunt');
  await page.waitForTimeout(1000);
  report.cast=await page.evaluate(()=>window.__paradise.snapshot());
  assert.equal(report.cast.fluid.backend,'webgpu');assert.ok(report.cast.fluid.impulseCount>0);assert.ok(report.cast.fluid.peak>.001);
  await page.screenshot({path:join(output,'cast.png')});
  await page.goto(new URL('?fluid=cpu',url).href,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.body.dataset.ready==='true');
  await page.locator('#begin').click();await page.locator('#cast').click();
  await page.waitForFunction(()=>window.__paradise.snapshot().phase==='hunt');await page.waitForTimeout(1000);
  report.fallback=await page.evaluate(()=>window.__paradise.snapshot());
  assert.equal(report.fallback.fluid.backend,'cpu');assert.ok(report.fallback.fluid.peak>.001);
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;process.exitCode=1;}
finally{await browser.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
