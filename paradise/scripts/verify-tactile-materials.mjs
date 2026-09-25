import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const engines=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PARADISE_BROWSER||'webkit',url=process.env.PARADISE_URL||'http://127.0.0.1:8798/';
const output=process.env.PARADISE_REPORT_DIR||new URL('../verification/tactile-current/',import.meta.url).pathname;
await mkdir(output,{recursive:true});
const browser=await engines[engine].launch({headless:true,args:engine==='chromium'?['--use-angle=metal','--enable-gpu']:[]});
const report={at:new Date().toISOString(),url,engine,errors:[]};
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.route('**/__materials',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0;background:#eee4cd"><h1 style="position:absolute;left:32px;top:15px;color:#244b43;font:30px Georgia">Paradise / timber, terracotta & linen</h1></body></html>'}));
  await page.goto(new URL('/__materials',url).href);
  report.fixture=await page.evaluate(async()=>{
    const T=await import('/island/vendor/three.module.min.js'),{createIsland}=await import('/island/models.js');
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1440,800);renderer.domElement.style.marginTop='90px';document.body.append(renderer.domElement);
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.14;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
    const scene=new T.Scene();scene.background=new T.Color('#eee4cd');scene.add(new T.HemisphereLight('#fff3dc','#44665a',1.8));
    const sun=new T.DirectionalLight('#fff2db',3.3);sun.position.set(-9,15,14);sun.castShadow=true;
    Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,far:60});sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.035;scene.add(sun);
    const island=createIsland(scene,{value:0},{});island.ground.visible=false;
    const camera=new T.PerspectiveCamera(29,480/800,.1,80),views=[{position:[10,7.5,13],target:[4.3,2.6,3.4]},{position:[6.6,6,17.5],target:[1,.6,12]},{position:[-10,8,13],target:[-5,2.8,3]}];
    const materials=new Set(),textures=new Set();scene.traverse(n=>{if(n.isMesh&&n.material.userData.tactile){materials.add(n.material);textures.add(n.material.map);textures.add(n.material.bumpMap);}});
    const settings=[...materials].map(m=>({m,map:m.map,bumpMap:m.bumpMap,roughnessMap:m.roughnessMap}));
    function render(){renderer.setScissorTest(true);const calls=[];views.forEach((v,i)=>{renderer.setViewport(i*480,0,480,800);renderer.setScissor(i*480,0,480,800);camera.position.fromArray(v.position);camera.lookAt(...v.target);renderer.render(scene,camera);calls.push(renderer.info.render.calls);});return calls;}
    const gl=renderer.getContext(),pixels=()=>{const p=new Uint8Array(1440*800*4);gl.readPixels(0,0,1440,800,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
    const calls=render(),textured=pixels();
    for(const {m}of settings){m.map=m.bumpMap=m.roughnessMap=null;m.needsUpdate=true;}render();const flat=pixels();
    let changed=0,delta=0;for(let i=0;i<flat.length;i+=4){const d=Math.abs(flat[i]-textured[i])+Math.abs(flat[i+1]-textured[i+1])+Math.abs(flat[i+2]-textured[i+2]);if(d>9)changed++;delta+=d;}
    window.fixture={restore(){for(const {m,...props} of settings){Object.assign(m,props);m.needsUpdate=true;}render();},dispose(){renderer.dispose();}};
    return {materials:materials.size,textures:textures.size,calls,changedPixels:changed,changedFraction:changed/(1440*800),meanChannelDelta:delta/(1440*800*3),textureBytesWithMipmaps:[...textures].reduce((sum,t)=>sum+t.image.data.byteLength*4/3,0)};
  });
  await page.screenshot({path:join(output,'flat-gallery.png')});
  await page.evaluate(()=>window.fixture.restore());await page.screenshot({path:join(output,'tactile-gallery.png')});
  assert.equal(report.fixture.textures,6);assert.ok(report.fixture.textureBytesWithMipmaps<=2*1024**2);assert.ok(report.fixture.changedFraction>.01,'material detail must affect actual rendered pixels');
  await page.evaluate(()=>window.fixture.dispose());
  await page.goto(url,{waitUntil:'networkidle'});await page.waitForSelector('body[data-ready=true]');await page.waitForTimeout(1800);
  await page.screenshot({path:join(output,'landing.png')});report.scene=await page.evaluate(()=>window.__paradise.snapshot());
  assert.equal(report.scene.canvases,1);assert.equal(report.scene.frames,0);assert.equal(report.scene.waveComponents,32);
  await page.locator('#begin').click();await page.locator('#cast').click();await page.waitForFunction(()=>window.__paradise.snapshot().phase==='hunt');
  await page.waitForTimeout(1200);await page.screenshot({path:join(output,'fishing.png')});
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;process.exitCode=1;}
finally{await browser.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
