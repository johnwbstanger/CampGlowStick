import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO='agentkaerf/FreeModels';
const SHA='db3df04d1e4714298a09510b26fb6de6645138a2';
const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..','..','public','assets','models','quaternius','camp-characters');
const selected=[
  { id:'male_casual2', path:'Ultimate Modular Men- Feb 2022/Individual Characters/glTF/Casual_2.gltf', source:'Ultimate Modular Men' },
  { id:'male_beach', path:'Ultimate Modular Men- Feb 2022/Individual Characters/glTF/Beach.gltf', source:'Ultimate Modular Men' },
  { id:'male_farmer', path:'Ultimate Modular Men- Feb 2022/Individual Characters/glTF/Farmer.gltf', source:'Ultimate Modular Men' },
  { id:'female_casual', path:'Ultimate Modular Women - April 2022/Individual Characters/glTF/Casual.gltf', source:'Ultimate Modular Women' },
  { id:'female_adventurer', path:'Ultimate Modular Women - April 2022/Individual Characters/glTF/Adventurer.gltf', source:'Ultimate Modular Women' },
];
const exists=p=>access(p).then(()=>true,()=>false);
const raw=path=>`https://raw.githubusercontent.com/${REPO}/${SHA}/${path.split('/').map(encodeURIComponent).join('/')}`;
for(const item of selected){
  const out=join(ROOT,`${item.id}.gltf`); if(await exists(out)) continue;
  const r=await fetch(raw(item.path)); if(!r.ok) throw new Error(`${r.status} ${item.path}`);
  await mkdir(dirname(out),{recursive:true}); await writeFile(out,Buffer.from(await r.arrayBuffer()));
  console.log('fetched character',item.id);
}
await mkdir(ROOT,{recursive:true});
await writeFile(join(ROOT,'catalog.json'),JSON.stringify({repository:REPO,commit:SHA,license:'CC0-1.0',entries:selected.map(x=>({...x,file:`models/quaternius/camp-characters/${x.id}.gltf`,author:'Quaternius',license:'CC0-1.0'}))},null,2));
console.log(`Quaternius character variants ready: ${selected.length}`);
