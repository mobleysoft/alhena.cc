import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const engines=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PARADISE_BROWSER||'webkit',base=process.env.PARADISE_URL||'http://127.0.0.1:8798/';
const out=process.env.PARADISE_REPORT_DIR||'paradise/verification/ocean-inspection';
await mkdir(out,{recursive:true});
const browser=await engines[engine].launch({headless:true,args:engine==='chromium'?['--use-angle=metal','--enable-gpu']:[]});
const report={at:new Date().toISOString(),base,engine,errors:[],views:[]};
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  for(const [name,params] of [['normal',''],['no-volume','&volume=off'],['reflection','&water-debug=2'],['bed','&water-debug=3'],['depth','&water-debug=4'],['transmitted','&water-debug=5']]){
    await page.goto(`${base}?time=night&weather=calm${params}`,{waitUntil:'networkidle'});
    await page.waitForSelector('body[data-ready=true]');await page.waitForTimeout(1300);
    await page.screenshot({path:join(out,`${name}.png`)});
    report.views.push({name,state:await page.evaluate(()=>window.__paradise.snapshot())});
  }
  report.ok=report.errors.length===0;if(!report.ok)process.exitCode=1;
}finally{await browser.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,errors:report.errors,views:report.views.length}));}
