import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const engines=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PARADISE_BROWSER||'chromium';
const url=process.env.PARADISE_URL||'http://127.0.0.1:8796/';
const output=process.env.PARADISE_REPORT_DIR||new URL('../verification/fish-current/',import.meta.url).pathname;
await mkdir(output,{recursive:true});
const browser=await engines[engine].launch({headless:true,args:engine==='chromium'?['--use-angle=metal','--enable-gpu']:[]});
const report={at:new Date().toISOString(),url,engine,errors:[]};
function observe(page){page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});}
try{
  const gallery=await browser.newPage({viewport:{width:1440,height:760}});observe(gallery);
  await gallery.route('**/__fish-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0;background:#dfdfd2;color:#234244"><h1 style="position:absolute;left:35px;top:8px;font:32px Georgia">The shallows / sculpted miniatures</h1><div id="labels"></div></body></html>'}));
  await gallery.goto(new URL('/__fish-fixture',url).href);
  report.gpu=await gallery.evaluate(async()=>{
    const T=await import('/island/vendor/three.module.min.js'),{makeFish}=await import('/island/fish.js');
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1440,660);renderer.domElement.style.marginTop='90px';document.body.append(renderer.domElement);
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
    const scene=new T.Scene();scene.background=new T.Color('#dfdfd2');scene.add(new T.HemisphereLight('#fff3d9','#457d80',3));
    const light=new T.DirectionalLight('#fff4de',3.5);light.position.set(2,4,3);scene.add(light);
    const camera=new T.OrthographicCamera(-.97,.97,.88,-.88,.01,20);camera.position.set(2.2,.9,1.1);camera.lookAt(0,0,-.18);
    const fish=Array.from({length:8},(_,i)=>makeFish(scene,i));
    fish.forEach((f,i)=>{const p=document.createElement('div');p.textContent=f.name;p.style.cssText=`position:absolute;left:${i%4*360+32}px;top:${Math.floor(i/4)*330+389}px;font:18px Georgia`;document.querySelector('#labels').append(p);});
    function render(t){renderer.setScissorTest(true);let calls=0,triangles=0;
      fish.forEach((f,i)=>{fish.forEach(x=>x.g.visible=x===f);f.update(t);const x=i%4*360,y=(1-Math.floor(i/4))*330;renderer.setViewport(x,y,360,330);renderer.setScissor(x,y,360,330);renderer.render(scene,camera);calls+=renderer.info.render.calls;triangles+=renderer.info.render.triangles;});
      return {calls,triangles};
    }
    const gl=renderer.getContext(),pixels=()=>{const a=new Uint8Array(1440*660*4);gl.readPixels(0,0,1440,660,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
    const stats=render(0),a=pixels();render(.24);const b=pixels();let changed=0;
    for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>12)changed++;
    render(.12);return {...stats,changedPixels:changed,fish:fish.map(f=>f.evidence())};
  });
  assert.equal(report.gpu.calls,8);assert.ok(report.gpu.changedPixels>1000,'GPU skin animation must visibly change the rendered silhouette');
  await gallery.screenshot({path:join(output,'fish-gallery.png')});await gallery.close();
  const page=await browser.newPage({viewport:{width:1440,height:900}});observe(page);
  await page.goto(url,{waitUntil:'networkidle'});await page.waitForSelector('body[data-ready=true]');await page.waitForTimeout(1700);
  const first=await page.evaluate(()=>window.__paradise.fish());await page.waitForTimeout(230);
  const second=await page.evaluate(()=>window.__paradise.fish());
  assert.equal(first.length,14);assert.equal(new Set(first.map(f=>f.name)).size,8);
  assert.ok(first.every(f=>f.skinned&&f.bones===6));
  assert.ok(first.some((f,i)=>Math.abs(f.tail[0]-second[i].tail[0])>.01));
  assert.ok(first.every((f,i)=>f.head.every((v,j)=>Math.abs(v-second[i].head[j])<1e-10)),'head stays rigid within matrix roundoff');report.school=second;
  await page.screenshot({path:join(output,'landing.png')});
  await page.locator('#begin').click();await page.locator('#cast').click();await page.waitForFunction(()=>window.__paradise.snapshot().phase==='hunt');await page.waitForTimeout(1400);
  await page.screenshot({path:join(output,'fishing.png')});report.active=await page.evaluate(()=>window.__paradise.snapshot());
  await page.waitForFunction(()=>window.__paradise.snapshot().phase==='strike',null,{timeout:25000});await page.waitForTimeout(850);
  await page.screenshot({path:join(output,'strike.png')});
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;process.exitCode=1;}
finally{await browser.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,failure:report.failure,errors:report.errors,gpu:report.gpu&&{calls:report.gpu.calls,triangles:report.gpu.triangles,changedPixels:report.gpu.changedPixels},active:report.active},null,2));}
