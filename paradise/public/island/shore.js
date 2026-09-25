// First-order Saint-Venant transects with Rusanov flux and hydrostatic
// reconstruction: Audusse et al. (2004), doi:10.1137/S1064827503431090.
// Independent transects model swash, not alongshore flow or overturning waves.
const G=9.81,DRY=1e-5;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const SHORE=Object.freeze({rays:48,cells:96,inner:.48,outer:1.28,xRadius:12.8,zRadius:9.2,zCenter:3.3});

export function createTransect(bed,dx,{closed=false,friction=.06,seaLevel=()=>0}={}){
  const n=bed.length,h=Float64Array.from(bed,z=>Math.max(0,-z)),q=new Float64Array(n);
  const wet=Float32Array.from(h,d=>d>.005?1:0),foam=new Float32Array(n),nextFoam=new Float32Array(n);
  const massFlux=new Float64Array(n+1),leftFlux=new Float64Array(n+1),rightFlux=new Float64Array(n+1);
  let t=0,substeps=0,minDepth=0,negativeCorrections=0,boundaryVolume=0;
  function flux(j,hl,ql,zl,hr,qr,zr){
    const ul=hl>DRY?ql/hl:0,ur=hr>DRY?qr/hr:0,z=Math.max(zl,zr);
    const l=Math.max(0,hl+zl-z),r=Math.max(0,hr+zr-z);
    const a=Math.max(Math.abs(ul)+Math.sqrt(G*l),Math.abs(ur)+Math.sqrt(G*r));
    massFlux[j]=.5*(l*ul+r*ur-a*(r-l));
    const momentum=.5*(l*ul*ul+.5*G*l*l+r*ur*ur+.5*G*r*r-a*(r*ur-l*ul));
    leftFlux[j]=momentum+.5*G*(hl*hl-l*l);rightFlux[j]=momentum+.5*G*(hr*hr-r*r);
  }
  function step(duration){
    if(!Number.isFinite(duration)||duration<=0)return;
    let remaining=Math.min(duration,.1);
    while(remaining>1e-9){
      const eta=clamp(seaLevel(t),-.8,.8),hb=Math.max(0,eta-bed[n-1]);
      const ub=closed?0:(h[n-1]>DRY?q[n-1]/h[n-1]:0)+2*(Math.sqrt(G*h[n-1])-Math.sqrt(G*hb));
      let speed=Math.abs(ub)+Math.sqrt(G*hb);
      for(let i=0;i<n;i++)speed=Math.max(speed,(h[i]>DRY?Math.abs(q[i]/h[i]):0)+Math.sqrt(G*h[i]));
      const dt=Math.min(remaining,.35*dx/Math.max(.1,speed));
      flux(0,h[0],-q[0],bed[0],h[0],q[0],bed[0]);
      for(let i=1;i<n;i++)flux(i,h[i-1],q[i-1],bed[i-1],h[i],q[i],bed[i]);
      flux(n,h[n-1],q[n-1],bed[n-1],closed?h[n-1]:hb,closed?-q[n-1]:hb*ub,bed[n-1]);
      for(let i=0;i<n;i++){
        const u=h[i]>DRY?q[i]/h[i]:0;
        const up=i>0&&h[i-1]>DRY?q[i-1]/h[i-1]:0,un=i<n-1&&h[i+1]>DRY?q[i+1]/h[i+1]:0;
        const front=Math.max(0,(up-un)/(2*dx)-.18),froude=Math.abs(u)/Math.sqrt(G*Math.max(.02,h[i]));
        const source=h[i]<.7&&h[i]>.003?(front*.5+Math.max(0,froude-.8)*.45):0;
        const gradient=u>=0?(foam[i]-(foam[i-1]||0))/dx:((foam[i+1]||0)-foam[i])/dx;
        nextFoam[i]=clamp(foam[i]-u*dt*gradient+dt*(source-foam[i]*.7),0,1);
      }
      boundaryVolume+=dt*(massFlux[0]-massFlux[n]);
      for(let i=0;i<n;i++){
        const depth=h[i]-dt/dx*(massFlux[i+1]-massFlux[i]);minDepth=Math.min(minDepth,depth);
        if(depth< -1e-9)negativeCorrections++;
        h[i]=Math.max(0,depth);
        q[i]=h[i]>DRY?(q[i]-dt/dx*(leftFlux[i+1]-rightFlux[i]))*Math.exp(-friction*dt/Math.max(.08,h[i])):0;
        wet[i]=h[i]>.008?1:Math.max(0,wet[i]-dt*.055);foam[i]=nextFoam[i];
      }
      t+=dt;remaining-=dt;substeps++;
    }
  }
  return {bed,h,q,wet,foam,dx,step,snapshot:()=>({time:t,substeps,minDepth,negativeCorrections,boundaryVolume,
    volume:h.reduce((s,d)=>s+d*dx,0),maxSpeed:q.reduce((m,v,i)=>Math.max(m,h[i]>DRY?Math.abs(v/h[i]):0),0)})};
}

export function createShore(ground,forcing){
  const {rays,cells,inner,outer,xRadius,zRadius,zCenter}=SHORE,dr=(outer-inner)/(cells-1);
  const data=new Float32Array((rays+1)*cells*4),strips=[];
  for(let row=0;row<rays;row++){
    const angle=row/rays*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle);
    const bed=Float64Array.from({length:cells},(_,i)=>ground(xRadius*(inner+i*dr)*c,zCenter+zRadius*(inner+i*dr)*s));
    const strip=createTransect(bed,dr*Math.hypot(xRadius*c,zRadius*s),{
      seaLevel:t=>forcing(xRadius*outer*c,zCenter+zRadius*outer*s,t),
    });strips.push(strip);
  }
  let time=0;
  function publish(){
    for(let row=0;row<rays;row++)for(let i=0;i<cells;i++){
      const s=strips[row],offset=(row*cells+i)*4;
      // Dry cells publish bed height; the render/CPU sampler clips by depth.
      data[offset]=s.h[i]+s.bed[i];data[offset+1]=s.wet[i];data[offset+2]=s.foam[i];data[offset+3]=s.h[i];
    }
    data.set(data.subarray(0,cells*4),rays*cells*4);
  }
  function sample(x,z){
    const r=Math.hypot(x/xRadius,(z-zCenter)/zRadius);
    if(r<inner||r>outer)return null;
    const angle=(Math.atan2((z-zCenter)/zRadius,x/xRadius)/(Math.PI*2)+1)%1;
    const u=(r-inner)/(outer-inner)*(cells-1),v=angle*rays;
    const i=Math.min(cells-2,Math.floor(u)),j=Math.min(rays-1,Math.floor(v)),a=u-i,b=v-j;
    const result=[];
    for(let c=0;c<4;c++){
      const p=(j*cells+i)*4+c,q=p+cells*4;
      result[c]=(data[p]*(1-a)+data[p+4]*a)*(1-b)+(data[q]*(1-a)+data[q+4]*a)*b;
    }
    return {height:result[0],wet:result[1],foam:result[2],depth:result[3],r};
  }
  function snapshot(){
    let newlyWet=0,foamPeak=0,wetSand=0,negativeCorrections=0,maxSpeed=0;
    for(const s of strips){for(let i=0;i<cells;i++){
      if(s.bed[i]>0&&s.h[i]>.008)newlyWet++;
      if(s.bed[i]>0&&s.h[i]<.008&&s.wet[i]>.05)wetSand++;
      foamPeak=Math.max(foamPeak,s.foam[i]);
    }const state=s.snapshot();negativeCorrections+=state.negativeCorrections;maxSpeed=Math.max(maxSpeed,state.maxSpeed);}
    return {time,transects:rays,cells,newlyWet,wetSand,foamPeak,maxSpeed,negativeCorrections};
  }
  publish();
  return {data,sample,snapshot,strips,step(dt){strips.forEach(s=>s.step(dt));time=strips[0].snapshot().time;publish();}};
}
