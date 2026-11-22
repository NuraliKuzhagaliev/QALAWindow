import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = new URL('../../', import.meta.url);
const current = new URL('data/snapshots/', root);
const stageArgument = process.argv.find((arg) => arg.startsWith('--staged-refresh='));
const out = stageArgument
  ? new URL('./', pathToFileURL(resolve(stageArgument.slice('--staged-refresh='.length), 'snapshot-root')))
  : current;
if (stageArgument && out.href === current.href)
  throw new Error('A fresh extract must be normalized in a separate staging directory');
await mkdir(out, {recursive:true});
let previousSnapshot=null;try{previousSnapshot=JSON.parse(await readFile(new URL('pois.json',current),'utf8'));}catch{}
const stamp = new Date().toISOString();
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const endpoints=['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter'];
async function query(name, body) {
  const failures=[];
  for (const endpoint of endpoints) {
    try {
      const response=await fetch(endpoint+'?data='+encodeURIComponent(body),{headers:{'User-Agent':'QALAWindow/0.1 (noncommercial hackathon data collector)'},signal:AbortSignal.timeout(90000)});
      if(!response.ok) throw new Error(`HTTP ${response.status} ${(await response.text()).slice(0,300)}`);
      const result=await response.json();
      if(result.remark) throw new Error(result.remark);
      const raw={endpoint,query:body,retrieved_at:stamp,hash:hash(result),...result};
      await writeFile(new URL(`${name}.raw.json`,out),JSON.stringify(raw));
      console.log(name,result.elements.length,endpoint);
      return raw;
    }catch(e){failures.push(`${endpoint}: ${e.message}`);}
  }
  await writeFile(new URL(`${name}.failure.json`,out),JSON.stringify({retrieved_at:stamp,failures},null,2));
  throw new Error(failures.join('; '));
}
const reuse=process.argv.includes('--normalize') || !!stageArgument;
const readRaw = async (name) => JSON.parse(await readFile(new URL(name+'.raw.json',out),'utf8'));
let stagedNetwork;
if(stageArgument){
  const raws = await Promise.all(['boundary','pois','network'].map(readRaw));
  if(!raws[0].source_timestamp || !raws[0].source_sha256 || !raws.every(
    (source) => source.source_timestamp===raws[0].source_timestamp && source.source_sha256===raws[0].source_sha256 && Array.isArray(source.elements) && source.elements.length>0,
  )) throw new Error('Fresh boundary, POIs and graph must come from the same extract');
  stagedNetwork=raws[2];
}
let boundary;try{boundary=JSON.parse(await readFile(new URL('boundary.raw.json',out),'utf8'));}catch{boundary=await query('boundary','[out:json][timeout:45];rel[boundary=administrative][wikidata=Q1520];out meta bb;');}
const city=boundary.elements.find(x=>x.type==='relation');
if(!city?.bounds || !/Астана|Astana/i.test(JSON.stringify(city.tags))) throw new Error('Verified Astana administrative boundary unavailable');
const area=3600000000+city.id;
let raw;try{raw=JSON.parse(await readFile(new URL('pois.raw.json',out),'utf8'));}catch{raw=await query('pois',`[out:json][timeout:60];area(${area})->.city;(nwr(area.city)[name][tourism~"^(museum|attraction|artwork|gallery|viewpoint)$"];nwr(area.city)[name][amenity~"^(cafe|restaurant|library|arts_centre)$"];nwr(area.city)[name][leisure~"^(park|playground|garden)$"];nwr(area.city)[name][shop=mall];);out meta center;`);}
const hav=(a,b)=>{const r=Math.PI/180,dlat=(b[1]-a[1])*r,dlon=(b[0]-a[0])*r;return 12742000*Math.asin(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dlon/2)**2));};
const getCoord=e=>[e.lon??e.center?.lon,e.lat??e.center?.lat];
const priorAnchor = (i) => raw.elements.find(e=>`${e.type}/${e.id}`===previousSnapshot?.anchors[i]?.id);
const mega=priorAnchor(0)||raw.elements.find(e=>/MEGA Silk Way|Mega Silk Way|MEGA Silkway/i.test(JSON.stringify(e.tags)));
const bay=priorAnchor(1)||raw.elements.find(e=>/Байтерек|Бәйтерек|Bayterek|Baiterek/i.test(e.tags?.name||''))||raw.elements.find(e=>/^(Keruen|Керуен)$/i.test(e.tags?.name||''));
if(!mega||!bay) throw new Error('Source-backed flagship landmark coordinates not found');
const anchors=[{id:`${mega.type}/${mega.id}`,name:mega.tags.name,coordinates:getCoord(mega),aliases:['Expo','Экспо','ЭКСПО','Mega Silk Way','Мега']},{id:`${bay.type}/${bay.id}`,name:bay.tags.name,coordinates:getCoord(bay),aliases:['Bayterek','Baiterek','Байтерек','Бәйтерек','Nurzhol','Нұржол','Нуржол']}];
const rejects=[],duplicateCandidates=[];
const pois=raw.elements.flatMap(e=>{
 const t=e.tags||{},c=getCoord(e), id=`${e.type}/${e.id}`;
 if(!c.every(Number.isFinite)||t.access==='private'){rejects.push({id,reason:'invalid coordinates or private access'});return[];}
 const distance=Math.min(...anchors.map(a=>hav(a.coordinates,c)));
 if(distance>2200){rejects.push({id,reason:'outside flagship coverage'});return[];}
 const category=t.shop==='mall'?'mall':t.tourism||t.leisure||t.amenity;
 const record={id,url:`https://www.openstreetmap.org/${id}`,retrieved_at:raw.retrieved_at,source_updated_at:e.timestamp??null,raw_tags:t,hash:hash(e),license:'ODbL-1.0'};
 const field=(value,transform='OSM tag')=>({value:value??null,source_id:id,retrieved_at:raw.retrieved_at,source_updated_at:e.timestamp??null,transformation:transform,state:value==null?'unknown':'source'});
 return [{id,name:t.name,coordinates:c,category,tags:[category,t.cuisine,t.tourism,t.leisure,t.amenity].filter(Boolean),aliases:[t['name:en'],t['name:ru'],t['name:kk'],t.alt_name,t.old_name].filter(Boolean),description:`${t.name} · ${category}`,description_kind:'generated from name and category',hours:t.opening_hours??null,contact:t.website??t['contact:website']??t.phone??null,rating:null,popularity:null,indoor:t.indoor==='yes'?true:t.indoor==='no'?false:null,entranceAccess:t.wheelchair==='yes'?'tagged':t.wheelchair==='no'?'no':'unknown',sockets:t.socket==='yes'?true:null,quiet:null,childSuitable:t['kids_area']==='yes'?true:null,price:t.fee==='no'?'free':null,visitSeconds:[300,category==='museum'?1800:category==='cafe'||category==='restaurant'?900:600],fields:{name:field(t.name),coordinates:field(c,'OSM node or element center'),category:field(category),hours:field(t.opening_hours),contact:field(t.website??t.phone),indoor:field(t.indoor),entranceAccess:field(t.wheelchair),sockets:field(t.socket),quiet:field(null),childSuitable:field(t.kids_area),price:field(t.fee)},sources:[record],distance}];
}).sort((a,b)=>Number(!!b.hours)-Number(!!a.hours)||a.distance-b.distance);
for(let i=0;i<pois.length;i++)for(let j=i+1;j<pois.length;j++)if(pois[i].name.toLowerCase()===pois[j].name.toLowerCase()&&hav(pois[i].coordinates,pois[j].coordinates)<60)duplicateCandidates.push([pois[i].id,pois[j].id]);
const seen=new Set();
const selected=pois.filter(p=>{if(seen.has(p.id))return false;seen.add(p.id);return true}).slice(0,120).map(({distance,...p})=>p);
const snapshot={version:`osm-${(raw.source_timestamp??raw.retrieved_at).slice(0,10)}-${hash(stagedNetwork?[selected,stagedNetwork.source_sha256]:selected).slice(0,8)}`,retrieved_at:raw.retrieved_at,generated_at:stamp,source_timestamp:raw.source_timestamp,source_sha256:raw.source_sha256,boundary:{id:city.id,bounds:city.bounds,source_url:`https://www.openstreetmap.org/relation/${city.id}`},anchors,attribution:'© OpenStreetMap contributors, ODbL 1.0',pois:selected};
await writeFile(new URL('pois.json',out),JSON.stringify(snapshot));
const audit={retrieved_at:stamp,source_count:raw.elements.length,accepted:selected.length,rejected:rejects.length,eligible_before_limit:pois.length,capped:Math.max(0,pois.length-120),categories:Object.fromEntries([...new Set(selected.map(p=>p.category))].map(c=>[c,selected.filter(p=>p.category===c).length])),missing_hours:selected.filter(p=>!p.hours).length,access_unknown:selected.filter(p=>p.entranceAccess==='unknown').length,duplicate_candidates:duplicateCandidates,merges:[],rejected_records:rejects,coverage:anchors,boundary:snapshot.boundary,dataset_version:snapshot.version,hash:hash(snapshot)};
await writeFile(new URL('DATA_AUDIT.json',out),JSON.stringify(audit,null,2));
await writeFile(new URL('DATA_AUDIT.md',out),`# Automated collection audit\n\n${JSON.stringify({...audit,rejected_records:undefined},null,2)}\n\nDuplicate candidates retained for review; no speculative branch merges. Source refresh does not verify current operation.\n`);
const previousById=new Map((previousSnapshot?.pois||[]).map(p=>[p.id,p]));
const currentById=new Map(selected.map(p=>[p.id,p]));
const contentHash = (record) => hash(record.sources?.[0]?.raw_tags ?? record.fields);
const changes={generated_at:stamp,from_version:previousSnapshot?.version??null,to_version:snapshot.version,added:selected.filter(p=>!previousById.has(p.id)).map(p=>p.id),removed:[...previousById.keys()].filter(id=>!currentById.has(id)),changed:selected.filter(p=>previousById.has(p.id)&&contentHash(previousById.get(p.id))!==contentHash(p)).map(p=>p.id),source_refetched:!!stageArgument,source_timestamp:raw.source_timestamp,source_sha256:raw.source_sha256};
await writeFile(new URL('CHANGE_REPORT.json',out),JSON.stringify(changes,null,2));
const immutable=new URL('archive/'+snapshot.version+'/',out);await mkdir(immutable,{recursive:true});
try{await writeFile(new URL('pois.json',immutable),JSON.stringify(snapshot),{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
for(const name of ['boundary','pois','network']){try{const bytes=await readFile(new URL(name+'.raw.json',out));const directory=new URL('raw/',out);await mkdir(directory,{recursive:true});try{await writeFile(new URL(name+'-'+createHash('sha256').update(bytes).digest('hex')+'.json',directory),bytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}}catch(error){if(error.code!=='ENOENT')throw error;}}
console.log('Change report',changes.added.length,'added',changes.removed.length,'removed',changes.changed.length,'changed');
console.log('accepted',selected.length,'missing hours',audit.missing_hours,'anchors',anchors);
const writeNetwork = async (net) => {
 const ways=net.elements.filter(e=>e.geometry?.length>1&&e.geometry.length===e.nodes.length).map(e=>({id:e.id,nodes:e.nodes,coordinates:e.geometry.map(g=>[g.lon,g.lat]),tags:e.tags,updated_at:e.timestamp}));
 if(!ways.length) throw new Error('Walking network has no complete geometry');
 await writeFile(new URL('network.json',out),JSON.stringify({version:snapshot.version,retrieved_at:net.retrieved_at,source_timestamp:net.source_timestamp,source_sha256:net.source_sha256,source:net.endpoint,attribution:snapshot.attribution,ways}));
 console.log('walking network ways',ways.length);
};
if(stagedNetwork) await writeNetwork(stagedNetwork);
if(!reuse){
 const spatial=anchors.map(a=>`way(around:1250,${a.coordinates[1]},${a.coordinates[0]})[highway~"^(footway|pedestrian|path|living_street|residential|service|steps)$"][access!=private][foot!=no];`).join('');
 let net;
 try{net=await query('network',`[out:json][timeout:25];(${spatial});out body geom;`);}catch(error){
  console.log('Overpass network unavailable; bounded OSM map API fallback');
  const elements=[],sourceRecords=[];
  for(const anchor of anchors){const [lon,lat]=anchor.coordinates;const bbox=[lon-.012,lat-.008,lon+.012,lat+.008];const url='https://api.openstreetmap.org/api/0.6/map.json?bbox='+bbox.join(',');const response=await fetch(url,{headers:{'User-Agent':'QALAWindow/0.1 noncommercial data collector'},signal:AbortSignal.timeout(45000)});if(!response.ok)throw new Error(`OSM map API HTTP ${response.status}`,{cause:error});const data=await response.json();sourceRecords.push({url,hash:hash(data),retrieved_at:new Date().toISOString()});elements.push(...data.elements);}
  const nodes=new Map(elements.filter(e=>e.type==='node').map(e=>[e.id,e]));const seenWays=new Set();net={endpoint:'https://api.openstreetmap.org/api/0.6/map.json',retrieved_at:new Date().toISOString(),source_records:sourceRecords,elements:elements.filter(e=>e.type==='way'&&e.tags?.highway&&!seenWays.has(e.id)&&seenWays.add(e.id)).map(e=>({...e,geometry:e.nodes.map(id=>nodes.get(id)).filter(Boolean).map(n=>({lat:n.lat,lon:n.lon}))}))};
  await writeFile(new URL('network.raw.json',out),JSON.stringify(net));
 }
 await writeNetwork(net);
}
