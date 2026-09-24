// A bounded 2D wave equation, shared by the WGSL compute path and CPU fallback.
// Published samples feed both the render texture and bobber buoyancy.
export const RIPPLE = Object.freeze({ size:128, span:26, minX:-13, minZ:0, dt:1/60, speed:2.4, damping:.8 });
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export function createState(ground, size=RIPPLE.size) {
  const data=new Float32Array(size*size*4),cell=RIPPLE.span/(size-1);
  for(let z=0;z<size;z++)for(let x=0;x<size;x++) {
    const at=(z*size+x)*4;
    data[at+2]=ground(RIPPLE.minX+x*cell,RIPPLE.minZ+z*cell)<-.025?1:0;
  }
  return data;
}

export function stepField(source,target,impulses=[],size=RIPPLE.size) {
  const cell=RIPPLE.span/(size-1),coefficient=RIPPLE.speed**2/cell**2;
  for(let z=0;z<size;z++)for(let x=0;x<size;x++) {
    const at=(z*size+x)*4, h=source[at],wet=source[at+2];
    target[at+2]=wet;target[at+3]=0;
    if(!wet){target[at]=0;target[at+1]=0;continue;}
    const sample=(xx,zz)=>{const p=(clamp(zz,0,size-1)*size+clamp(xx,0,size-1))*4;return source[p+2]?source[p]:h;};
    const lap=sample(x-1,z)+sample(x+1,z)+sample(x,z-1)+sample(x,z+1)-4*h;
    const boundary=Math.max(0,1-Math.min(x,z,size-1-x,size-1-z)/9);
    let v=(source[at+1]+lap*coefficient*RIPPLE.dt)*Math.exp(-(RIPPLE.damping+boundary*8)*RIPPLE.dt);
    for(const hit of impulses){const dx=RIPPLE.minX+x*cell-hit.x,dz=RIPPLE.minZ+z*cell-hit.z;v-=hit.strength*18*Math.exp(-(dx*dx+dz*dz)/(2*hit.radius**2));}
    target[at]=clamp(h+v*RIPPLE.dt,-.5,.5);target[at+1]=v;
  }
}

export function sampleField(data,x,z,size=RIPPLE.size) {
  const u=(x-RIPPLE.minX)/RIPPLE.span*(size-1),v=(z-RIPPLE.minZ)/RIPPLE.span*(size-1);
  if(u<0||v<0||u>size-1||v>size-1)return 0;
  const a=Math.floor(u),b=Math.floor(v),fx=u-a,fz=v-b;
  const get=(xx,zz)=>data[(Math.min(size-1,zz)*size+Math.min(size-1,xx))*4];
  return (get(a,b)*(1-fx)+get(a+1,b)*fx)*(1-fz)+(get(a,b+1)*(1-fx)+get(a+1,b+1)*fx)*fz;
}

export const rippleWGSL=`
struct Params { dt:f32, coefficient:f32, damping:f32, size:u32, cell:f32, count:u32, pad:vec2f, hits:array<vec4f,8> }
@group(0) @binding(0) var<storage,read> source:array<vec4f>;
@group(0) @binding(1) var<storage,read_write> nextState:array<vec4f>;
@group(0) @binding(2) var<uniform> p:Params;
fn heightAt(x:i32,z:i32,h:f32)->f32 {
  let point=source[u32(clamp(z,0,i32(p.size)-1))*p.size+u32(clamp(x,0,i32(p.size)-1))];
  return select(h,point.x,point.z>.5);
}
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id:vec3u) {
  if(id.x>=p.size||id.y>=p.size){return;}
  let at=id.y*p.size+id.x;let current=source[at];
  if(current.z<.5){nextState[at]=vec4f(0);return;}
  let x=i32(id.x);let z=i32(id.y);let h=current.x;
  let lap=heightAt(x-1,z,h)+heightAt(x+1,z,h)+heightAt(x,z-1,h)+heightAt(x,z+1,h)-4*h;
  let edge=min(min(id.x,id.y),min(p.size-1-id.x,p.size-1-id.y));
  let boundary=max(0.0,1.0-f32(edge)/9.0);
  var velocity=(current.y+lap*p.coefficient*p.dt)*exp(-(p.damping+boundary*8)*p.dt);
  let world=vec2f(-13.0,0.0)+vec2f(id.xy)*p.cell;
  for(var i=0u;i<p.count;i++) {let hit=p.hits[i];let d=world-hit.xy;velocity-=hit.z*18*exp(-dot(d,d)/(2*hit.w*hit.w));}
  nextState[at]=vec4f(clamp(h+velocity*p.dt,-.5,.5),velocity,current.z,0);
}`;

async function gpuBackend(initial) {
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'low-power'});
  if(!adapter)throw new Error('No WebGPU adapter');
  const device=await adapter.requestDevice();
  let pipeline;
  device.pushErrorScope('validation');
  try {
    const module=device.createShaderModule({code:rippleWGSL});
    const info=await module.getCompilationInfo();
    const errors=info.messages.filter(message=>message.type==='error');
    if(errors.length)throw new Error(errors.map(message=>`WGSL line ${message.lineNum}: ${message.message}`).join('\n'));
    pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
  } catch(error) {
    await device.popErrorScope();device.destroy();throw error;
  }
  const error=await device.popErrorScope();if(error){device.destroy();throw new Error(error.message);}
  const bytes=initial.byteLength;
  const buffers=Array.from({length:2},()=>device.createBuffer({size:bytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}));
  buffers.forEach(buffer=>device.queue.writeBuffer(buffer,0,initial));
  const parameters=device.createBuffer({size:512,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  const staging=device.createBuffer({size:bytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  const bindings=buffers.map((buffer,i)=>[0,256].map(offset=>device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
    {binding:0,resource:{buffer}},{binding:1,resource:{buffer:buffers[1-i]}},{binding:2,resource:{buffer:parameters,offset,size:160}},
  ]})));
  let current=0,failed=null;
  device.addEventListener('uncapturederror',event=>{event.preventDefault();failed=event.error.message;});
  device.lost.then(info=>{failed=info.message||'WebGPU device lost';});
  return {
    reset(state){buffers.forEach(buffer=>device.queue.writeBuffer(buffer,0,state));},
    async step(impulses,steps=1) {
      if(failed)throw new Error(failed);
      const packed=new ArrayBuffer(512),floats=new Float32Array(packed),uints=new Uint32Array(packed),cell=RIPPLE.span/(RIPPLE.size-1);
      floats[0]=RIPPLE.dt;floats[1]=RIPPLE.speed**2/cell**2;floats[2]=RIPPLE.damping;uints[3]=RIPPLE.size;floats[4]=cell;uints[5]=impulses.length;
      impulses.forEach((hit,i)=>floats.set([hit.x,hit.z,hit.strength,hit.radius],8+i*4));
      floats.set(floats.subarray(0,40),64);uints[69]=0;
      device.queue.writeBuffer(parameters,0,packed);
      const encoder=device.createCommandEncoder();
      for(let tick=0;tick<steps;tick++){
        const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bindings[current][tick===0?0:1]);
        pass.dispatchWorkgroups(RIPPLE.size/8,RIPPLE.size/8);pass.end();current=1-current;
      }
      encoder.copyBufferToBuffer(buffers[current],0,staging,0,bytes);device.queue.submit([encoder.finish()]);
      await staging.mapAsync(GPUMapMode.READ);
      const result=new Float32Array(staging.getMappedRange()).slice();staging.unmap();
      if(failed)throw new Error(failed);
      return result;
    },
    dispose(){buffers.forEach(buffer=>buffer.destroy());parameters.destroy();staging.destroy();device.destroy();},
  };
}

export function createRippleField(ground,{onChange=()=>{},preferGPU=true}={}) {
  let data=createState(ground),scratch=new Float32Array(data.length),gpu=null,pending=false,disposed=false,debt=0;
  let backend='cpu',reason=preferGPU?'WebGPU unavailable':'CPU requested',ticks=0,impulseCount=0,published=0;
  const queue=[];
  const ready=(async()=>{
    if(!preferGPU||!globalThis.navigator?.gpu)return;
    try {const candidate=await gpuBackend(data);if(disposed){candidate.dispose();return;}candidate.reset(data);gpu=candidate;backend='webgpu';reason=null;}
    catch(error){reason=error.message;}
  })();
  return {
    get data(){return data;},ready,
    impulse(x,z,strength=.09,radius=.22) {
      if(![x,z,strength,radius].every(Number.isFinite)||radius<=0)return false;
      if(x<RIPPLE.minX||x>RIPPLE.minX+RIPPLE.span||z<RIPPLE.minZ||z>RIPPLE.minZ+RIPPLE.span||ground(x,z)>=-.025)return false;
      if(queue.length===8)queue.shift();queue.push({x,z,strength:clamp(strength,-.4,.4),radius:clamp(radius,.15,1)});impulseCount++;return true;
    },
    step() {
      if(disposed)return;
      debt=Math.min(4,debt+1);if(pending)return;
      const hits=queue.splice(0),steps=debt;debt=0;ticks+=steps;
      if(!gpu){for(let i=0;i<steps;i++){stepField(data,scratch,i===0?hits:[]);[data,scratch]=[scratch,data];}published+=steps;onChange(data);return;}
      pending=true;
      gpu.step(hits,steps).then(result=>{if(disposed)return;data=result;published+=steps;onChange(data);}).catch(error=>{
        if(disposed)return;
        reason=error.message;backend='cpu';gpu?.dispose();gpu=null;
        // Last published state is authoritative; replay only the failed impulses.
        queue.unshift(...hits);queue.splice(8);debt=Math.min(4,debt+steps);
      }).finally(()=>{pending=false;});
    },
    height(x,z){return sampleField(data,x,z);},
    snapshot(){let peak=0;for(let i=0;i<data.length;i+=4)peak=Math.max(peak,Math.abs(data[i]));return {backend,reason,resolution:RIPPLE.size,ticks,published,pending,queuedSteps:debt,impulseCount,peak};},
    dispose(){disposed=true;gpu?.dispose();},
  };
}
