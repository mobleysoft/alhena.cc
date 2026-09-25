import * as THREE from './vendor/three.module.min.js';

export function eveningPreset(time,weather='calm') {
  const levels={dawn:.25,noon:0,sunset:.18,night:1};
  const level=Object.hasOwn(levels,time)?levels[time]:0;
  const warmth=level+(1-level)*(weather==='storm'?.16:0);
  return {level:warmth,window:2.8*warmth,bulb:.08+warmth*3.2,
    bar:2+16*warmth,porch:9*warmth,festoon:16*warmth,dock:7*warmth};
}

export function createWindowMaterial() {
  // Woven curtains behind frosted glazing, not a fake claim of a modeled room.
  const size=64,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const u=x/(size-1),v=y/(size-1),edge=Math.abs(u-.5)*2;
    const curtain=THREE.MathUtils.smoothstep(edge,.28+.25*v,.62+.2*v);
    const fold=.8+.2*Math.cos(u*75),weave=((x+y)%3===0?.96:1);
    const value=(1-curtain*.58*fold)*(.78+.22*Math.sin(v*Math.PI))*weave;
    const i=(y*size+x)*4;data[i]=255*value;data[i+1]=232*value;data[i+2]=179*value;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size);texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
  return new THREE.MeshStandardMaterial({color:'#37635c',map:texture,roughness:.32,metalness:.05,
    emissive:'#ffb868',emissiveMap:texture,emissiveIntensity:0});
}

export function createEveningLights(world,{cottage,bar,dock,windowMaterial}) {
  const fixtures=new THREE.Group();fixtures.name='Cove evening fixtures';world.add(fixtures);
  const brass=new THREE.MeshStandardMaterial({color:'#9c7950',roughness:.48,metalness:.35});
  const jade=new THREE.MeshStandardMaterial({color:'#254b44',roughness:.56});
  const glow=new THREE.MeshStandardMaterial({color:'#fff1d1',emissive:'#ffc481',emissiveIntensity:0,roughness:.38});
  const materials=[brass,jade,glow];
  const mesh=(parent,geometry,material,x=0,y=0,z=0)=>{
    const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  };
  function lantern(parent,position,scale=1) {
    const g=new THREE.Group();g.position.fromArray(position);g.scale.setScalar(scale);parent.add(g);
    mesh(g,new THREE.CylinderGeometry(.17,.2,.07,24),jade,0,.025);
    mesh(g,new THREE.CylinderGeometry(.2,.13,.13,24),jade,0,.5);
    mesh(g,new THREE.SphereGeometry(.115,20,12),glow,0,.26).scale.y=1.5;
    for(const x of [-.12,.12])for(const z of [-.12,.12])mesh(g,new THREE.CylinderGeometry(.013,.013,.39,6),brass,x,.265,z);
    const handle=mesh(g,new THREE.TorusGeometry(.115,.015,6,20,Math.PI),brass,0,.59);handle.rotation.z=0;
    return g;
  }
  // Real scene geometry is reflected, refracted and occluded with the other props.
  const porch=lantern(cottage,[1.7,1.73,1.98],.8);
  mesh(porch,new THREE.BoxGeometry(.11,.44,.06),jade,0,.22,-.25);
  mesh(porch,new THREE.BoxGeometry(.07,.06,.27),brass,0,.02,-.13);
  const pier=lantern(dock,[-.78,.83,-4.12],1.1);
  const pendant=new THREE.Group();pendant.position.set(.4,2.89,.65);bar.add(pendant);
  mesh(pendant,new THREE.CylinderGeometry(.013,.013,.5,8),brass,0,.23);
  mesh(pendant,new THREE.ConeGeometry(.3,.18,32),jade,0,-.08);
  mesh(pendant,new THREE.SphereGeometry(.09,16,12),glow,0,-.2);
  const festoonGeometry=new THREE.SphereGeometry(1,12,10);
  for(let i=0;i<13;i++){
    const x=-2.8+i*.46,y=2.7+.8*(x/3)**2,z=1.8-(x/3)**2*.8;
    mesh(fixtures,festoonGeometry,glow,x,y,z).scale.set(.055,.09,.055);
    mesh(fixtures,new THREE.CylinderGeometry(.037,.037,.06,8),brass,x,y+.093,z);
  }
  function point(name,parent,position,intensity,range) {
    const l=new THREE.PointLight('#ffce90',intensity,range,2);l.name=name;
    l.position.fromArray(position);parent.add(l);return l;
  }
  // One bounded light represents the festoon group instead of 13 per-bulb lights.
  const lights={
    bar:point('bar',bar,[.4,2.66,.65],0,7),
    porch:point('porch',cottage,[-.65,1.92,2.55],0,6),
    festoon:point('festoon',fixtures,[0,2.9,1.65],0,7),
    dock:point('dock',pier,[0,.32,0],0,5),
  };
  let preset=eveningPreset('noon');
  function setEnvironment(time,weather) {
    preset=eveningPreset(time,weather);
    windowMaterial.emissiveIntensity=preset.window;
    windowMaterial.color.set('#37635c').lerp(new THREE.Color('#fff0cc'),preset.level);
    glow.emissiveIntensity=preset.bulb;
    for(const [name,light] of Object.entries(lights))light.intensity=preset[name];
  }
  setEnvironment('noon','calm');
  return {fixtures,materials,windowMaterial,setEnvironment,
    evidence:()=>({preset:{...preset},windowEmission:windowMaterial.emissiveIntensity,
      bulbEmission:glow.emissiveIntensity,lightCount:Object.keys(lights).length,
      shadowLights:Object.values(lights).filter(l=>l.castShadow).length,
      lights:Object.values(lights).map(l=>({name:l.name,intensity:l.intensity,range:l.distance,
        position:l.getWorldPosition(new THREE.Vector3()).toArray()}))}),
  };
}
