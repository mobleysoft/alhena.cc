import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {groundHeight} from '../public/island/ocean.js';
const engines=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PARADISE_BROWSER||'webkit';
const out=process.env.PARADISE_REPORT_DIR||'paradise/verification/boundary-depth';await mkdir(out,{recursive:true});
const source=await readFile('paradise/public/island/ocean.js','utf8');
const hook=`let diagnosticCamera;window.__depthRead=()=>{
  const samples=Array.from({length:81},(_,i)=>new THREE.Vector2(.1+i*.01,.6));
  const rt=new THREE.WebGLRenderTarget(samples.length,1,{type:THREE.HalfFloatType,depthBuffer:false});
  const s=new THREE.Scene(),c=new THREE.Camera(),g=new THREE.PlaneGeometry(2,2);
  const m=new THREE.ShaderMaterial({uniforms:{d:uniforms.uRefractionDepth,inv:uniforms.uInverseViewProjection,pts:{value:samples}},depthTest:false,depthWrite:false,
    vertexShader:'void main(){gl_Position=vec4(position.xy,0,1);}',
    fragmentShader:'uniform sampler2D d;uniform mat4 inv;uniform vec2 pts[81];void main(){vec2 uv=pts[int(floor(gl_FragCoord.x))];float z=texture2D(d,uv).r;vec4 p=inv*vec4(uv*2.0-1.0,z*2.0-1.0,1.0);gl_FragColor=vec4(p.xyz/p.w,z);}'});
  s.add(new THREE.Mesh(g,m));const previous=renderer.getRenderTarget();
  try{renderer.setRenderTarget(rt);renderer.render(s,c);renderer.setRenderTarget(previous);const pixels=new Uint16Array(samples.length*4);renderer.readRenderTargetPixels(rt,0,0,samples.length,1,pixels);
    const result=samples.map((p,i)=>({uv:p.toArray(),hit:Array.from(pixels.slice(i*4,i*4+4),THREE.DataUtils.fromHalfFloat)}));
    const surfaceTarget=new THREE.WebGLRenderTarget(720,450,{type:THREE.HalfFloatType,depthBuffer:false});
    const surfaceMaterial=new THREE.ShaderMaterial({uniforms,vertexShader:material.vertexShader,fragmentShader:'varying vec3 vWorld;void main(){gl_FragColor=vec4(vWorld,1);}'});
    const surfaceScene=new THREE.Scene(),surfaceMesh=new THREE.Mesh(geometry,surfaceMaterial);surfaceMesh.frustumCulled=false;surfaceScene.add(surfaceMesh);
    try{
      renderer.setRenderTarget(surfaceTarget);renderer.render(surfaceScene,diagnosticCamera);
      for(const sample of result){const pixel=new Uint16Array(4);renderer.readRenderTargetPixels(surfaceTarget,Math.floor(sample.uv[0]*720),Math.floor(sample.uv[1]*450),1,1,pixel);sample.surface=Array.from(pixel,THREE.DataUtils.fromHalfFloat);sample.distance=Math.hypot(...sample.hit.slice(0,3).map((v,i)=>v-sample.surface[i]));}
      return result;
    }finally{surfaceTarget.dispose();surfaceMaterial.dispose();}
  }finally{renderer.setRenderTarget(previous);rt.dispose();g.dispose();m.dispose();}
};`;
const browser=await engines[engine].launch({headless:true,args:engine==='chromium'?['--use-angle=metal','--enable-gpu']:[]});
const report={at:new Date().toISOString(),engine,errors:[]};
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.route('**/island/ocean.js',r=>r.fulfill({contentType:'text/javascript',body:source.replace('  const mirrorCamera =',hook+'\n  const mirrorCamera =').replace('render(camera, outputTarget = null) {','render(camera, outputTarget = null) { diagnosticCamera=camera;')}));
  const url=new URL(process.env.PARADISE_URL||'http://127.0.0.1:8798/');url.search='time=night&weather=calm';report.url=url.href;
  await page.goto(url.href);await page.waitForSelector('body[data-ready=true]');await page.waitForTimeout(2000);
  report.samples=await page.evaluate(()=>window.__depthRead());
  // These two water-only regions bracket the observed shelf silhouettes. Avoid
  // real prop/fish silhouettes, where a discontinuous first hit is correct.
  report.regions=[[.28,.34],[.58,.62]].map(([lo,hi])=>{
    const samples=report.samples.filter(s=>s.uv[0]>=lo-1e-6&&s.uv[0]<=hi+1e-6);
    const jump=Math.max(...samples.slice(1).map((s,i)=>Math.abs(s.distance-samples[i].distance)));
    const terrainError=Math.max(...samples.map(s=>Math.abs(s.hit[1]-groundHeight(s.hit[0],s.hit[2]))));
    assert.ok(samples.length>=5&&samples.every(s=>Number.isFinite(s.distance)));
    assert.ok(jump<1.5,`optical path stays continuous across shelf: ${jump}`);
    assert.ok(terrainError<.12,`depth reconstruction matches rendered terrain: ${terrainError}`);
    return {lo,hi,jump,terrainError};
  });
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;process.exitCode=1;}
finally{await browser.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,regions:report.regions,errors:report.errors,failure:report.failure}));}
