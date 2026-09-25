import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const engines=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PARADISE_BROWSER||'webkit',url=process.env.PARADISE_URL||'http://127.0.0.1:8798/';
const output=process.env.PARADISE_REPORT_DIR||new URL('../verification/host-current/',import.meta.url).pathname;
await mkdir(output,{recursive:true});
const browser=await engines[engine].launch({headless:true,args:engine==='chromium'?['--use-angle=metal','--enable-gpu']:[]});
const report={at:new Date().toISOString(),url,engine,errors:[]};
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.route('**/__host-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0;background:#eee4cd"><h1 style="position:absolute;left:32px;top:15px;color:#244b43;font:32px Georgia">Alhena / a sculpted clay host</h1></body></html>'}));
  await page.goto(new URL('/__host-fixture',url).href);
  report.fixture=await page.evaluate(async()=>{
    const T=await import('/island/vendor/three.module.min.js'),{createHost}=await import('/island/host.js');
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1440,800);renderer.domElement.style.marginTop='90px';document.body.append(renderer.domElement);
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
    const scene=new T.Scene();scene.background=new T.Color('#eee4cd');scene.add(new T.HemisphereLight('#fff3dc','#44665a',2.2));
    const sun=new T.DirectionalLight('#fff2db',3.2);sun.position.set(-2,4,4);scene.add(sun);
    const host=createHost(scene),camera=new T.PerspectiveCamera(27,480/800,.01,30);
    const views=[{position:[0,1.65,7],target:[0,1.55,0]},{position:[4,2.3,6],target:[0,1.55,0]},{position:[.65,2.53,1.65],target:[0,2.5,.02]}];
    renderer.setScissorTest(true);const calls=[];
    views.forEach((view,i)=>{renderer.setViewport(i*480,0,480,800);renderer.setScissor(i*480,0,480,800);camera.position.fromArray(view.position);camera.lookAt(...view.target);renderer.render(scene,camera);calls.push(renderer.info.render.calls);});
    const result={...host.evidence(),calls};renderer.dispose();return result;
  });
  assert.equal(report.fixture.meshes,7);assert.deepEqual(report.fixture.calls.slice(0,2),[7,7]);
  assert.ok(report.fixture.calls[2]>=3&&report.fixture.calls[2]<=7,'close-up may cull off-screen limbs');
  await page.screenshot({path:join(output,'host-gallery.png')});
  await page.goto(url,{waitUntil:'networkidle'});await page.waitForSelector('body[data-ready=true]');await page.waitForTimeout(1600);
  await page.screenshot({path:join(output,'landing.png')});
  report.motion=await page.evaluate(async()=>{
    let min=1,max=0,minYaw=Infinity,maxYaw=-Infinity,frames=0;const start=performance.now();
    while(performance.now()-start<5200){await new Promise(requestAnimationFrame);const h=window.__paradise.actors().host;
      min=Math.min(min,h.blink);max=Math.max(max,h.blink);minYaw=Math.min(minYaw,h.headYaw);maxYaw=Math.max(maxYaw,h.headYaw);frames++;}
    return {minBlink:min,maxBlink:max,yawRange:maxYaw-minYaw,frames,host:window.__paradise.actors().host};
  });
  assert.ok(report.motion.minBlink<.3&&report.motion.maxBlink>.99);assert.ok(report.motion.yawRange>.01);assert.ok(report.motion.frames>50);
  await page.locator('#begin').click();await page.locator('#cast').click();await page.waitForFunction(()=>window.__paradise.snapshot().phase==='hunt');await page.waitForTimeout(1000);
  await page.screenshot({path:join(output,'fishing.png')});report.active=await page.evaluate(()=>window.__paradise.snapshot());
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload({waitUntil:'networkidle'});await page.waitForSelector('body[data-ready=true]');
  await page.waitForTimeout(300);report.reduced=await page.evaluate(()=>window.__paradise.actors().host);assert.equal(report.reduced.blink,1);
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;process.exitCode=1;}
finally{await browser.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
