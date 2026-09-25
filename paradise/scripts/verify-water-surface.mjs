import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const engines=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PARADISE_BROWSER||'chromium';
const url=process.env.PARADISE_URL||'http://127.0.0.1:8796/';
const output=process.env.PARADISE_REPORT_DIR||new URL('../verification/water-surface-current/',import.meta.url).pathname;
await mkdir(output,{recursive:true});
const browser=await engines[engine].launch({headless:true,args:engine==='chromium'?['--use-angle=metal','--enable-gpu']:[]});
const report={at:new Date().toISOString(),url,engine,errors:[]};
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(url,{waitUntil:'networkidle'});await page.waitForSelector('body[data-ready=true]');await page.waitForTimeout(1200);
  report.surface=await page.evaluate(()=>window.__paradise.surface());
  assert.equal(report.surface.normalMode,'per-pixel central difference');
  assert.ok(report.surface.reflection.width*report.surface.reflection.height<=1048576);
  report.gpu=await page.evaluate(async()=>{
    const T=await import('/island/vendor/three.module.min.js');
    const {spectrum,SHORT_WAVES,normalSteps,NORMAL_EPSILON,heightGLSL,surfaceNormalGLSL,causticWindowGLSL,createReflectionTarget}=await import('/island/ocean.js');
    const renderer=new T.WebGLRenderer();renderer.setSize(32,32);renderer.setClearColor(0,1);
    const field=new Float32Array(128*128*4);
    for(let z=0;z<128;z++)for(let x=0;x<128;x++)field[(z*128+x)*4]=.06*Math.sin(x*.3)*Math.cos(z*.2);
    const texture=new T.DataTexture(field,128,128,T.RGBAFormat,T.FloatType);texture.minFilter=texture.magFilter=T.LinearFilter;texture.needsUpdate=true;
    const points=[[-170,-120],[-70,-40],[-25,20],[-13,2],[-8,10],[0,3],[0,9],[5,12],[8,17],[0,19],[12,24],[12.98,25.98],[14,27],[50,90],[160,120],[.3,.5]];
    const uniforms={uTime:{value:0},uChop:{value:1.2},uWaves:{value:[]},uFrequencies:{value:[]},uWaveSteps:{value:[]},
      uShortWaves:{value:SHORT_WAVES.map(w=>new T.Vector4(w.kx,w.kz,w.amplitude,w.frequency))},uShortSteps:{value:SHORT_WAVES.map(normalSteps)},
      uRippleWind:{value:1},uRipples:{value:texture},uPoints:{value:points.map(p=>new T.Vector2(...p))},uReference:{value:0}};
    const scene=new T.Scene(),camera=new T.Camera(),geometry=new T.PlaneGeometry(2,2);
    const material=new T.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,vertexShader:'void main(){gl_Position=vec4(position.xy,0,1);}',
      fragmentShader:`${heightGLSL}${surfaceNormalGLSL}uniform vec2 uPoints[16];uniform float uReference;
      void main(){vec2 p=uPoints[int(floor(gl_FragCoord.x))];vec3 n=surfaceNormal(p);
        if(uReference>.5){vec2 dx=vec2(${NORMAL_EPSILON},0.0),dz=dx.yx;n=normalize(vec3(heightAt(p-dx)-heightAt(p+dx),${NORMAL_EPSILON*2},heightAt(p-dz)-heightAt(p+dz)));}
        gl_FragColor=vec4(n*.5+.5,1);}`});
    const quad=new T.Mesh(geometry,material);scene.add(quad);
    const target=new T.WebGLRenderTarget(16,1,{type:T.HalfFloatType,depthBuffer:false});
    const cases=[];let maxNormalError=0;
    function read(target){renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);const p=new Uint16Array(target.width*target.height*4);renderer.readRenderTargetPixels(target,0,0,target.width,target.height,p);return Array.from(p,T.DataUtils.fromHalfFloat);}
    try {
      for(const wind of [8,12,18])for(const time of [0,13.7,301.2]){
        const waves=spectrum(wind);uniforms.uTime.value=time;uniforms.uRippleWind.value=wind/12;
        uniforms.uWaves.value=waves.map(w=>new T.Vector4(w.kx,w.kz,w.amplitude,w.phase));uniforms.uFrequencies.value=waves.map(w=>w.freq);uniforms.uWaveSteps.value=waves.map(normalSteps);
        uniforms.uReference.value=0;const optimized=read(target);uniforms.uReference.value=1;const reference=read(target);
        const error=Math.max(...optimized.map((v,i)=>i%4===3?0:Math.abs(v-reference[i])*2));
        maxNormalError=Math.max(maxNormalError,error);cases.push({wind,time,error,samples:points.length});
      }
      const uvs=[[-.01,.5],[0,.5],[.01,.5],[.035,.5],[.07,.5],[.5,.5],[.93,.5],[1,.5],[1.01,.5],[.5,0],[.5,1],[.01,.01],[.99,.99],[.5,-.1],[.5,1.1],[.5,.5]];
      const edgeMaterial=new T.ShaderMaterial({uniforms:{uvs:{value:uvs.map(p=>new T.Vector2(...p))}},depthTest:false,depthWrite:false,
        vertexShader:'void main(){gl_Position=vec4(position.xy,0,1);}',fragmentShader:`${causticWindowGLSL}uniform vec2 uvs[16];void main(){gl_FragColor=vec4(vec3(causticCoverage(uvs[int(floor(gl_FragCoord.x))])),1);}`});
      quad.material=edgeMaterial;const edge=read(target).filter((_,i)=>i%4===0);edgeMaterial.dispose();
      const edgeSamples=uvs.map((uv,i)=>{const t=Math.max(0,Math.min(1,Math.min(...uv,1-uv[0],1-uv[1])/.07));return {uv,actual:edge[i],expected:t*t*(3-2*t)};});
      const triangle=new T.BufferGeometry();triangle.setAttribute('position',new T.Float32BufferAttribute([-.93,-.81,0,.79,-.62,0,-.27,.91,0],3));
      const flat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});quad.geometry=triangle;quad.material=flat;
      const coverage=[];
      for(const antialias of [false,true]){
        const rt=createReflectionTarget(renderer,32,32);if(!antialias)rt.samples=0;
        renderer.setRenderTarget(rt);renderer.render(scene,camera);renderer.setRenderTarget(null);
        const pixels=new Uint8Array(32*32*4);renderer.readRenderTargetPixels(rt,0,0,32,32,pixels);
        let partial=0,area=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i]>0&&pixels[i]<255)partial++;area+=pixels[i]/255;}
        coverage.push({samples:rt.samples,partial,area});rt.dispose();
      }
      flat.dispose();triangle.dispose();
      return {cases,maxNormalError,edgeSamples,coverage};
    }finally{texture.dispose();target.dispose();geometry.dispose();material.dispose();renderer.dispose();renderer.forceContextLoss();}
  });
  assert.ok(report.gpu.maxNormalError<.006,'rendered normals must match direct central differences of the unchanged height field');
  for(const sample of report.gpu.edgeSamples)assert.ok(Math.abs(sample.actual-sample.expected)<.001,'actual caustic shader must fade continuously at its boundary');
  assert.equal(report.gpu.coverage[0].partial,0);
  if(report.gpu.coverage[1].samples>0)assert.ok(report.gpu.coverage[1].partial>20,'MSAA must generate real fractional edge coverage');
  assert.ok(Math.abs(report.gpu.coverage[0].area-report.gpu.coverage[1].area)<6,'MSAA preserves projected object area');
  await page.waitForTimeout(1200);await page.screenshot({path:join(output,'landing.png')});
  report.landing=await page.evaluate(()=>window.__paradise.snapshot());
  await page.locator('#begin').click();await page.locator('#cast').click();await page.waitForFunction(()=>window.__paradise.snapshot().phase==='hunt');await page.waitForTimeout(1600);
  await page.screenshot({path:join(output,'fishing.png')});report.active=await page.evaluate(()=>window.__paradise.snapshot());
  await page.locator('#menu-button').click();await page.locator('button[data-time="night"]').click();await page.locator('button[data-weather="storm"]').click();await page.locator('#close-settings').click();await page.waitForTimeout(1600);
  await page.screenshot({path:join(output,'night-storm.png')});
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;process.exitCode=1;}
finally{await browser.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
