export const species = [
  { name:'Silver mullet', weight:36 }, { name:'Blue runner', weight:24 },
  { name:'Spotted sea bass', weight:16 }, { name:'Golden bream', weight:10 },
  { name:'Reef snapper', weight:7 }, { name:'Moon wrasse', weight:4 },
  { name:'Atlantic mackerel', weight:2 }, { name:'Amberjack', weight:1 },
];
const KEY='paradise_cove_catches';
export const catchCount=records=>records.reduce((total,c)=>total+(c.count||1),0);
export function chooseFish(weather,time,random=Math.random){
  const weights=species.map((s,i)=>s.weight*(i>=4&&weather==='storm'?1.8:1)*(i===5&&time==='night'?2:1));
  let roll=random()*weights.reduce((a,b)=>a+b,0);
  for(let i=0;i<species.length;i++){roll-=weights[i];if(roll<=0)return species[i].name;}
  return species.at(-1).name;
}
export function readCatches(storage){
  try{
    const raw=storage.getItem(KEY);
    if(raw!==null){const data=JSON.parse(raw);return Array.isArray(data)?data.filter(c=>c&&typeof c.name==='string'&&(c.count===undefined||(Number.isSafeInteger(c.count)&&c.count>0))):[];}
    // Preserve the canvas edition's count-based journal without touching its key.
    const old=JSON.parse(storage.getItem('paradise_fish_log')||'{}');
    const records=Object.entries(old||{}).filter(([name,count])=>name.length&&Number.isSafeInteger(count)&&count>0).map(([name,count])=>({name,count,legacy:true}));
    if(records.length){try{storage.setItem(KEY,JSON.stringify(records));}catch{ /* Keep the readable journal even when storage is full. */ }}
    return records;
  }catch{return [];}
}
export function recordCatch(records,name,storage){
  const existing=records.find(c=>c.name===name);
  if(existing){existing.count=(existing.count||1)+1;existing.at=new Date().toISOString();}
  else records.push({name,count:1,at:new Date().toISOString()});
  try{storage.setItem(KEY,JSON.stringify(records));}catch{}
}
