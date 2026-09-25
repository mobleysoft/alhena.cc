import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const engines = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.PARADISE_BROWSER || 'chromium';
const url = process.env.PARADISE_URL || 'http://127.0.0.1:8796/';
const output = process.env.PARADISE_REPORT_DIR || new URL('../verification/water-light-current/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
const browser = await engines[engine].launch({headless:true,args:engine==='chromium'?['--use-angle=metal','--enable-gpu']:[]});
const report = { at:new Date().toISOString(), url, engine, errors:[] };
try {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => {if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(url,{waitUntil:'networkidle'});await page.waitForSelector('body[data-ready=true]');
  await page.waitForTimeout(1200);
  report.scene = await page.evaluate(() => window.__paradise.volume());
  assert.ok(report.scene.frames > 10 && report.scene.enabled);
  assert.equal(report.scene.slices.length,4);
  for(const slice of report.scene.slices) {
    assert.ok(Number.isFinite(slice.max) && slice.max > 1.05 && slice.max < 100);
    assert.ok(slice.mean > .2 && slice.mean < 2);
  }
  report.gpu = await page.evaluate(async () => {
    const T = await import('/island/vendor/three.module.min.js');
    const { createWaterLight, waterLightGLSL, integrateWaterLight, WATER_LIGHT } = await import('/island/water-light.js');
    const renderer = new T.WebGLRenderer();renderer.setSize(8,1);renderer.setClearColor(0,0);
    const uniforms = {uSun:{value:new T.Vector3(0,1,0)},uLight:{value:1},uWarmth:{value:new T.Color(1,1,1)},uColor:{value:new T.Color(0,0,0)}};
    const volume = createWaterLight(renderer,'float heightAt(vec2 p){return 0.0;}float ground(vec2 p){return -30.0;}',uniforms);
    const target = new T.WebGLRenderTarget(8,1,{type:T.HalfFloatType,depthBuffer:false});
    const scene = new T.Scene(), camera = new T.Camera(), geometry = new T.PlaneGeometry(2,2);
    const material = new T.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,
      vertexShader:'void main(){gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader:`uniform vec3 uSun,uWarmth,uColor;uniform float uLight;${waterLightGLSL}
        void main(){float d=exp2(floor(gl_FragCoord.x)-3.0);gl_FragColor=vec4(waterRadiance(vec3(0,0,10),vec3(0,-d,10),vec3(0)),1);}`});
    scene.add(new T.Mesh(geometry,material));
    try {
      volume.render();const flat = volume.evidence();
      renderer.setRenderTarget(target);renderer.render(scene,camera);
      const pixels = new Uint16Array(32);renderer.readRenderTargetPixels(target,0,0,8,1,pixels);
      const g = WATER_LIGHT.anisotropy, phase = (1-g*g)/(1+g*g+2*g)**1.5;
      let maxError = 0;const samples = [];
      for(let i=0;i<8;i++) {
        const distance = 2**(i-3), expected = integrateWaterLight(distance,d=>WATER_LIGHT.extinction.map(s=>Math.exp(-s*d)*phase*.35)).radiance;
        const actual = Array.from({length:3},(_,c)=>T.DataUtils.fromHalfFloat(pixels[i*4+c]));
        actual.forEach((v,c)=>maxError=Math.max(maxError,Math.abs(v-expected[c])));samples.push({distance,actual,expected});
      }
      uniforms.uVolumeEnabled.value=0;renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,8,1,pixels);
      let disabledMax=0;for(let i=0;i<8;i++)for(let c=0;c<3;c++)disabledMax=Math.max(disabledMax,T.DataUtils.fromHalfFloat(pixels[i*4+c]));
      return {flat,maxError,samples,disabledMax};
    } finally {volume.dispose();target.dispose();geometry.dispose();material.dispose();renderer.dispose();renderer.forceContextLoss();}
  });
  for(const slice of report.gpu.flat.slices) {
    assert.ok(Math.abs(slice.mean-1)<.005 && Math.abs(slice.max-1)<.005,'flat water conserves the incident light field');
    assert.equal(slice.focused,0);
  }
  assert.ok(report.gpu.maxError<.001,'actual fragment-shader integration matches numerical reference');
  assert.equal(report.gpu.disabledMax,0,'disabled scattering contributes no radiance');
  await page.screenshot({path:join(output,'landing.png')});
  await page.locator('#begin').click();await page.locator('#cast').click();
  await page.waitForFunction(()=>window.__paradise.snapshot().phase==='hunt');await page.waitForTimeout(1100);
  await page.screenshot({path:join(output,'fishing.png')});
  report.active = await page.evaluate(()=>window.__paradise.snapshot());
  await page.locator('#menu-button').click();await page.locator('button[data-time="night"]').click();await page.locator('button[data-weather="storm"]').click();await page.locator('#close-settings').click();
  await page.waitForTimeout(1000);await page.screenshot({path:join(output,'night-storm.png')});
  assert.deepEqual(report.errors,[]);report.ok=true;
} catch(error) {report.ok=false;report.failure=error.stack;process.exitCode=1;}
finally {await browser.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
