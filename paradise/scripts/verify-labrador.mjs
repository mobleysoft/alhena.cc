import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
const engines=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PARADISE_BROWSER||'webkit',url=process.env.PARADISE_URL||'http://127.0.0.1:8798/';
const output=process.env.PARADISE_REPORT_DIR||'paradise/verification/labrador-current';
const baseline=process.env.PARADISE_DOG_BASELINE==='1';
await mkdir(output,{recursive:true});
const browser=await engines[engine].launch({headless:true,args:engine==='chromium'?['--use-angle=metal','--enable-gpu']:[]});
const report={at:new Date().toISOString(),url,engine,baseline,errors:[]};
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  if(baseline){const source=execFileSync('git',['show','47bb405:paradise/public/island/models.js'],{encoding:'utf8'});
    await page.route('**/island/models.js',r=>r.fulfill({contentType:'text/javascript',body:source}));}
  await page.route('**/__dog-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0;background:#e9e1ce"><h1 style="position:absolute;left:32px;top:15px;color:#244b43;font:32px Georgia">Black Labrador / sculpted clay companion</h1></body></html>'}));
  await page.goto(new URL('/__dog-fixture',url).href);
  report.fixture=await page.evaluate(async()=>{
    const T=await import('/island/vendor/three.module.min.js'),{createIsland}=await import('/island/models.js');
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1440,800);renderer.domElement.style.marginTop='90px';document.body.append(renderer.domElement);
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
    const scene=new T.Scene();scene.background=new T.Color('#e9e1ce');scene.add(new T.HemisphereLight('#fff3dc','#5e7064',2.1));
    const sun=new T.DirectionalLight('#fff2db',3.4);sun.position.set(-2,4,4);scene.add(sun);
    const island=createIsland(scene,{value:0},{caustics:{value:new T.Texture()},light:{value:1},sun:{value:sun.position.clone().normalize()}});
    island.update(0,0,1,{reducedMotion:true});scene.remove(island.world);const dog=island.dog;
    dog.g.removeFromParent();scene.add(dog.g);dog.g.position.set(0,0,0);dog.g.rotation.y=0;
    const camera=new T.PerspectiveCamera(30,480/800,.01,30);
    const views=[{position:[10.8,3,0],target:[0,.8,-.25]},{position:[4.3,2.7,6],target:[0,.8,.08]},{position:[1.4,1.6,3.3],target:[0,1.22,.91]}];
    renderer.setScissorTest(true);const calls=[];views.forEach((view,i)=>{
      renderer.setViewport(i*480,0,480,800);renderer.setScissor(i*480,0,480,800);camera.position.fromArray(view.position);camera.lookAt(...view.target);renderer.render(scene,camera);calls.push(renderer.info.render.calls);
    });
    let meshes=0,triangles=0;dog.g.traverse(o=>{if(o.isMesh){meshes++;triangles+=o.geometry.index.count/3;}});
    const result={meshes,triangles,calls};
    window.__dogGallery={renderer,scene,island,dog,camera};return result;
  });
  await page.screenshot({path:join(output,'dog-gallery.png')});
  if(!baseline){
    assert.equal(report.fixture.meshes,8);assert.ok(report.fixture.triangles<50000);
    report.poses=await page.evaluate(()=>{
      const {renderer,scene,island,dog,camera}=window.__dogGallery;
      camera.position.set(10.8,3,0);camera.lookAt(0,.8,-.25);const poses=[];let t=0;
      for(let i=0;i<3;i++){
        for(let step=0;step<90;step++){t+=1/60;island.update(t,1/60);}
        const pose=island.actors();dog.g.position.set(0,0,0);dog.g.rotation.y=0;
        renderer.setViewport(i*480,0,480,800);renderer.setScissor(i*480,0,480,800);renderer.render(scene,camera);
        poses.push({time:t,mode:pose.mode,steps:pose.stepCount,swing:pose.feet.map(f=>f.swing)});
      }
      return poses;
    });
    await page.screenshot({path:join(output,'dog-walking.png')});
    assert.ok(report.poses.at(-1).steps>report.poses[0].steps);
    await page.evaluate(()=>window.__dogGallery.renderer.dispose());
    await page.goto(url,{waitUntil:'networkidle'});await page.waitForSelector('body[data-ready=true]');await page.waitForTimeout(1200);
    await page.screenshot({path:join(output,'landing.png')});
    report.motion=await page.evaluate(async()=>{
      let minBlink=1,maxBlink=0,minTail=Infinity,maxTail=-Infinity,maxFootError=0,frames=0;const start=performance.now();
      while(performance.now()-start<5700){await new Promise(requestAnimationFrame);const a=window.__paradise.actors();
        minBlink=Math.min(minBlink,a.dog.blink);maxBlink=Math.max(maxBlink,a.dog.blink);minTail=Math.min(minTail,a.dog.tailYaw);maxTail=Math.max(maxTail,a.dog.tailYaw);
        a.renderedFeet.forEach((foot,i)=>{maxFootError=Math.max(maxFootError,Math.hypot(...foot.position.map((v,j)=>v-a.feet[i].foot[j])));});frames++;
      }
      return {minBlink,maxBlink,tailRange:maxTail-minTail,maxFootError,frames,actors:window.__paradise.actors()};
    });
    assert.ok(report.motion.minBlink<.3&&report.motion.maxBlink>.99);assert.ok(report.motion.tailRange>.2);
    assert.ok(report.motion.maxFootError<1e-5,'rendered paws agree with the unchanged terrain-aware solver');
    assert.ok(report.motion.actors.stepCount>1&&report.motion.frames>50);
    await page.locator('#begin').click();await page.locator('#cast').click();await page.waitForFunction(()=>window.__paradise.snapshot().phase==='hunt');await page.waitForTimeout(1000);
    await page.screenshot({path:join(output,'fishing.png')});
    await page.emulateMedia({reducedMotion:'reduce'});await page.reload({waitUntil:'networkidle'});await page.waitForSelector('body[data-ready=true]');await page.waitForTimeout(300);
    report.reduced=await page.evaluate(()=>window.__paradise.actors().dog);assert.equal(report.reduced.blink,1);assert.equal(report.reduced.tailYaw,0);
  }
  if(baseline)await page.evaluate(()=>window.__dogGallery.renderer.dispose());
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;process.exitCode=1;}
finally{await browser.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
