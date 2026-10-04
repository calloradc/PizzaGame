// Raster sprite frames: original generated PNGs are preserved unchanged.
// Bounds keep each subject isolated even when an atlas has unequal cells.
const towerFrames={pepper:[157,13,284,325],cheese:[620,44,280,278],basil:[1075,16,344,321],oven:[137,354,331,322],soda:[613,338,346,327],sniper:[1078,362,342,308],farm:[116,687,363,306],pizza:[609,679,289,330],shop:[1037,678,424,329]};
const enemyFrames={tomato:[65,48,355,367],olive:[482,56,290,365],mush:[824,53,401,362],healer:[47,414,415,402],pepper:[456,417,330,376],dough:[846,493,373,320],shield:[39,844,380,379],boss:[414,791,522,424],crumb:[957,956,282,262]};
const iconNames=['coin','heart','flag','bomb','freeze','trap','rally','repair','i-build','i-intel','i-gear','i-pause','i-play','i-close','i-full','medal'];
const iconBounds=[[63,68,286,294],[372,98,592,279],[686,66,911,295],[988,45,1196,300],[48,353,306,602],[400,364,599,595],[681,362,905,594],[980,386,1209,584],[57,659,295,892],[373,660,604,903],[671,664,902,895],[1012,677,1184,940],[96,966,279,1173],[378,969,580,1165],[683,953,904,1166],[984,940,1205,1191]];
const ammoNames=['pepper','cheese','basil','oven','soda','sniper','farm','heal','star'];
const ammoBounds=[[125,141,349,357],[526,154,730,345],[930,127,1127,363],[124,522,352,748],[524,528,733,739],[912,523,1146,738],[158,921,319,1117],[515,931,739,1111],[931,909,1129,1125]];
const frame=b=>[b[0]-3,b[1]-3,b[2]-b[0]+6,b[3]-b[1]+6];
const prepared=new Map();
export function artFor(id){
 id=({blizzard:"freeze",chili:"rally","i-target":"i-full"})[id]||id;
 if(prepared.has(id))return prepared.get(id);
 let name=id==='pizza'||id==='shop'?id:id.startsWith('t-')?id.slice(2):null;
 if(name&&towerFrames[name])return{url:'./assets/towers-atlas.png',size:[1536,1024],box:towerFrames[name]};
 if(id.startsWith('e-')&&enemyFrames[id.slice(2)])return{url:'./assets/enemies-atlas.png',size:[1254,1254],box:enemyFrames[id.slice(2)]};
 let i=iconNames.indexOf(id);if(i>=0)return{url:'./assets/icons-atlas.png',size:[1254,1254],box:frame(iconBounds[i])};
 i=id.startsWith('a-')?ammoNames.indexOf(id.slice(2)):-1;if(i>=0)return{url:'./assets/ammo-atlas.png',size:[1254,1254],box:frame(ammoBounds[i])};return null;
}
let clipSerial=0;
function fit(a,w,h){const [x,y,cw,ch]=a.box,k=Math.min(w/cw,h/ch);return{x:(w-cw*k)/2-x*k,y:(h-ch*k)/2-y*k,width:a.size[0]*k,height:a.size[1]*k}}
export function rasterIcon(id,cls=''){const a=artFor(id);if(!a)return null;const c='spriteClip'+(++clipSerial),f=fit(a,64,64);return `<svg class="rasterSprite ${cls}" viewBox="0 0 64 64" aria-hidden="true"><defs><clipPath id="${c}" clipPathUnits="userSpaceOnUse"><rect width="64" height="64"/></clipPath></defs><g clip-path="url(#${c})"><image href="${a.url}" x="${f.x}" y="${f.y}" width="${f.width}" height="${f.height}"/></g></svg>`}
export function placeArt(el,id,attrs,parent){const a=artFor(id);if(!a)return el('use',{href:'#'+id,...attrs},parent);const {x=0,y=0,width=64,height=64,...rest}=attrs,c='spriteClip'+(++clipSerial),n=el('g',{...rest,transform:`translate(${x} ${y})`,'data-raster':id},parent),d=el('defs',{},n),clip=el('clipPath',{id:c,clipPathUnits:'userSpaceOnUse'},d);el('rect',{x:0,y:0,width,height},clip);const clipped=el('g',{'clip-path':`url(#${c})`},n);el('image',{href:a.url,...fit(a,width,height)},clipped);return n}

// Convert atlas frames to independent textures before creating any scene nodes.
// A cropped bitmap has its own alpha and bounds, so filters and transforms never see neighboring cells.
export async function prepareRasterImages(){const images=new Map(),ids=[...Object.keys(towerFrames).map(n=>n==='pizza'||n==='shop'?n:'t-'+n),...Object.keys(enemyFrames).map(n=>'e-'+n),...iconNames,...ammoNames.map(n=>'a-'+n)];
 const load=url=>{if(!images.has(url))images.set(url,new Promise((resolve,reject)=>{let im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=url}));return images.get(url)};
 await Promise.all(ids.map(async id=>{let a=artFor(id),im=await load(a.url),[x,y,w,h]=a.box,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(im,x,y,w,h,0,0,w,h);prepared.set(id,{url:canvas.toDataURL('image/png'),size:[w,h],box:[0,0,w,h]})}));
}
