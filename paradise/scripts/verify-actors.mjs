import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const engines=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PARADISE_BROWSER||'chromium',url=process.env.PARADISE_URL||'http://127.0.0.1:8794/';
const output=process.env.PARADISE_REPORT_DIR||fileURLToPath(new URL('../verification/actors-current/',import.meta.url));
await mkdir(output,{recursive:true});
const browser=await engines[engine].launch({headless:true,args:engine==='chromium'?['--use-angle=metal','--enable-gpu']:[]});
const report={at:new Date().toISOString(),url,engine,errors:[],screenshots:[]};
try{
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.body.dataset.ready==='true');
  const sample=page.evaluate(async()=>{
    const {groundHeight}=await import('/island/ocean.js');
    const result={frames:0,states:{},maxRenderedError:0,maxStanceSlip:0,maxGroundError:0,maxReachError:0,minContacts:4,steps:0};
    const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));let previous=null;
    const start=performance.now();
    while(performance.now()-start<22000){
      await new Promise(requestAnimationFrame);const p=window.__paradise.actors();
      result.frames++;result.states[p.mode]=(result.states[p.mode]||0)+1;result.steps=p.stepCount;
      result.minContacts=Math.min(result.minContacts,p.feet.filter(f=>f.stance).length);
      for(let i=0;i<4;i++){
        const f=p.feet[i],rendered=p.renderedFeet[i].position;
        result.maxRenderedError=Math.max(result.maxRenderedError,distance(f.foot,rendered));
        result.maxReachError=Math.max(result.maxReachError,f.reachError);
        if(f.stance){
          result.maxGroundError=Math.max(result.maxGroundError,Math.abs(rendered[1]-groundHeight(rendered[0],rendered[2])-.065));
          if(previous?.feet[i].stance)result.maxStanceSlip=Math.max(result.maxStanceSlip,distance(rendered,previous.renderedFeet[i].position));
        }
      }
      previous=p;
    }
    return result;
  });
  for(const [name,delay] of [['walking',1000],['turning',6000],['sniffing',8000]]){
    await page.waitForTimeout(delay);await page.screenshot({path:join(output,`${name}.png`)});report.screenshots.push(`${name}.png`);
  }
  report.motion=await sample;
  assert.ok(report.motion.frames>300);assert.ok(report.motion.steps>20);assert.ok(report.motion.minContacts>=3);
  assert.ok(report.motion.states.walking>0&&report.motion.states.sniffing>0);
  assert.ok(report.motion.maxRenderedError<.00001,'rendered bone endpoints must match IK');
  assert.ok(report.motion.maxStanceSlip<.001,'rendered planted paws must not skate');
  assert.ok(report.motion.maxGroundError<.001,'stance paws must contact terrain');
  assert.ok(report.motion.maxReachError<.001,'pose stays inside limb reach');
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>document.body.dataset.ready==='true');
  const a=await page.evaluate(()=>window.__paradise.actors());await page.waitForTimeout(1000);const b=await page.evaluate(()=>window.__paradise.actors());
  assert.deepEqual(a.root,b.root);assert.equal(b.stepCount,0);assert.equal(b.speed,0);report.reducedMotion=true;
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;process.exitCode=1;}
finally{await browser.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
