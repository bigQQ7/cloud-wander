import {updateAssetDetails} from '../shared/web-assets.js?v=4';
import {configureGLTFLoader} from '../shared/web-assets.js?v=4';
import {createGameplay} from './gameplay.js?v=quality4';
import {checkClearance} from './clearance.js?v=1793348657994569199';
import {enhance} from './enhance.js?v=quality4';
import * as T from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {Reflector} from './vendor/Reflector.js';
import {createLake} from './water.js?v=1793348657994569199';
import {buildLane} from './lane.js?v=1793348657994569199';
import {applyLayout,createEditor} from './editor.js?v=1793348657994569199';
import {applyFixes} from './fixes.js?v=1793348657994569199';
import {setupAtmosphere} from './atmosphere.js?v=stableframe1';
const scene=new T.Scene();scene.background=new T.Color('#c7dffa');scene.fog=new T.Fog('#d6ddfb',65,170);
const renderer=new T.WebGLRenderer();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;document.body.prepend(renderer.domElement);
const camera=new T.PerspectiveCamera(38,innerWidth/innerHeight,.1,350);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.49;controls.target.set(0,0,-3);camera.position.set(0,43,65);
scene.add(new T.HemisphereLight('#ffe9f4','#e897c2',1.9));const sun=new T.DirectionalLight('#ffe6ee',2.6);sun.position.set(-25,45,20);scene.add(sun);const rim=new T.DirectionalLight('#accaff',1.3);rim.position.set(20,10,-25);scene.add(rim);
const world=new T.Group();world.name='Dream garden';scene.add(world);const assets=new Map(),placed=[];const loader=configureGLTFLoader(new GLTFLoader());let count=0;
const allAssets=await (await fetch('./assets.json?v=quality4')).json();
const assetById=new Map(allAssets.map(asset=>[asset.id,asset]));
const usedAssetIds=new Set([0,4,7,9,10,12,15,17,18,21,22,23,24,25,27,28,29,31,32,33,34,35,36,37,39,41,42]);
const manifest=allAssets.filter(asset=>usedAssetIds.has(asset.id));
// Limit parallel loading to bound texture decoding memory on mobile devices.
const assetConcurrency=matchMedia("(pointer:coarse)").matches?2:3;
let nextAsset=0;
async function loadAssetWorker(){
while(nextAsset<manifest.length){
const a=manifest[nextAsset++];
const g=await loader.loadAsync(a.file+'?v=hd2048');const maxAniso=renderer.capabilities.getMaxAnisotropy();g.scene.traverse(o=>{if(o.isMesh){for(const k of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap']){const t=o.material[k];if(t){t.anisotropy=maxAniso;t.needsUpdate=true;}}o.material.side=T.DoubleSide;o.material.roughness=Math.max(o.material.roughness||.7,.42);}});assets.set(a.id,g.scene);document.querySelector('#progress').textContent=`${++count} / ${manifest.length} · ${a.name.split('+3d')[0].replaceAll('+',' ')}`;}
}
await Promise.all(Array.from({length:Math.min(assetConcurrency,manifest.length)},loadAssetWorker));
function put(id,x,y,z,size=1,rot=0,stretch=null){const o=assets.get(id).clone(true);const b=new T.Box3().setFromObject(o),s=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3());const k=size/Math.max(s.x,s.z);o.position.set(-c.x,-b.min.y,-c.z);const wrap=new T.Group();wrap.add(o);wrap.scale.set(k,k,k);if(stretch)wrap.scale.multiply(new T.Vector3(...stretch));wrap.rotation.y=rot;wrap.position.set(x,y,z);wrap.name=assetById.get(id).name;wrap.userData.assetId=id;world.add(wrap);placed.push({id,x,y,z,size,rot});return wrap;}
const mat=(c,metal=0)=>new T.MeshStandardMaterial({color:c,roughness:.55,metalness:metal});const ivory=mat('#f0d6aa'),gold=mat('#d5aa42',.65),grass=mat('#7ca86b'),blue=mat('#70d8ff',.2);
function mesh(g,m,x,y,z){const o=new T.Mesh(g,m);o.position.set(x,y,z);world.add(o);return o;}
function disk(x,y,z,r){mesh(new T.CylinderGeometry(r,r,.4,64),ivory,x,y-.2,z);mesh(new T.TorusGeometry(r-.12,.055,8,96),gold,x,y+.02,z).rotation.x=Math.PI/2;}
function island(x,z,r,y=0){const h=y+.25,hi=y>.5,rb=r*(hi?.66:1.0);mesh(new T.CylinderGeometry(r*(hi?.84:.97),rb,h,64),hi?mat('#d8c3d9'):ivory,x,y-.4-h/2,z).name='lake terrace';mesh(new T.TorusGeometry(rb*1.01,.07,8,96),gold,x,LAKE_Y+.06,z).rotation.x=Math.PI/2;if(hi)mesh(new T.TorusGeometry(r*.85,.06,8,96),gold,x,y-.42,z).rotation.x=Math.PI/2;disk(x,y,z,r);
const lines=[];const step=1.35;for(let t=-r+step;t<r;t+=step){const reach=Math.sqrt(r*r-t*t);lines.push(x+t,y+.012,z-reach,x+t,y+.012,z+reach,x-reach,y+.012,z+t,x+reach,y+.012,z+t);}const lg=new T.BufferGeometry();lg.setAttribute('position',new T.Float32BufferAttribute(lines,3));world.add(new T.LineSegments(lg,new T.LineBasicMaterial({color:'#bda57f',transparent:true,opacity:.55})));}
const LAKE_Y=-.35;const lake=createLake({T,scene,Reflector,y:LAKE_Y});
island(0,0,9);island(-22,-12,6,2);island(0,-22,4,4);
put(25,0,.005,0,8,0,[1,.025,1]);put(17,7,.03,.9,3);put(15,3.4,.03,-5.5,3.7,Math.PI/2);put(22,-18.5,2.03,-14.2,2.5);put(39,5.8,.03,-6.2,1.35);put(4,-5,.03,3,4,Math.PI/2);put(21,0,.03,7.7,5.5,Math.PI/2);
put(12,-24,2.03,-14,7,Math.PI/2);put(10,-20,2.03,-16,2.4,-Math.PI/2);put(18,-24,2.03,-16,2.8,Math.PI/2);put(9,-22,2.28,-11,2.4,Math.PI/2);const rug=put(24,-21.5,2.18,-11,2);rug.rotation.z=Math.PI/2;put(37,-25,2.03,-10,1.4);put(28,-20,2.03,-14.2,1.5);
put(7,0,4,-23,4.5,Math.PI/2);put(0,-3,4,-24,2.7);put(0,3,4,-24,2.7);
// East island removed: the right route is now the side-scroll lily lane (lane.js).
const generatedChecks=[];
function path(points,width,material=ivory,rail=true){
 const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),N=80,vs=[],uv=[],ix=[],depth=material===ivory?.32:.16;
 for(let i=0;i<=N;i++){const p=curve.getPoint(i/N),t=curve.getTangent(i/N),side=new T.Vector3(-t.z,0,t.x).normalize();for(const [sign,dy] of [[-1,0],[1,0],[1,-depth],[-1,-depth]]){const v=p.clone().addScaledVector(side,width*.5*sign);v.y+=dy;vs.push(...v.toArray());uv.push(sign<0?0:1,i/N*12);}if(i<N){for(let k=0;k<4;k++){const a=i*4+k,b=i*4+(k+1)%4;ix.push(a,b,b+4,a,b+4,a+4);}}}
 ix.push(0,3,2,0,2,1);const q=N*4;ix.push(q,q+1,q+2,q,q+2,q+3);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vs,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();mesh(g,material,0,0,0);generatedChecks.push({name:'continuous deck',vertices:vs.length/3,triangles:ix.length/3,finite:vs.every(Number.isFinite),closed:closedMesh(ix)});
 for(const sign of [-1,1]){const pp=[],base=[];for(let i=0;i<=N;i++){const p=curve.getPoint(i/N),t=curve.getTangent(i/N);p.addScaledVector(new T.Vector3(-t.z,0,t.x).normalize(),sign*width*.49);base.push(p.clone().add(new T.Vector3(0,-depth*.5,0)));p.y+=rail?.8:.08;pp.push(p);if(rail&&i%8===0){mesh(new T.CylinderGeometry(.075,.12,.92,10),gold,p.x,p.y-.38,p.z);mesh(new T.SphereGeometry(.14,10,8),gold,p.x,p.y+.1,p.z);const col=mesh(new T.CylinderGeometry(.14,.18,.55,10),ivory,p.x,p.y-.55,p.z);}}
 mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pp),N,.065,6,false),gold,0,0,0);mesh(new T.TubeGeometry(new T.CatmullRomCurve3(base),N,.09,6,false),gold,0,0,0);
 if(rail){for(let i=0;i<10;i++){const t=(i+.5)/10,p=curve.getPoint(t),tan=curve.getTangent(t),normal=new T.Vector3(-tan.z,0,tan.x).normalize();p.addScaledVector(normal,sign*width*.49);const loop=[];for(let j=0;j<=24;j++){const a=j/24*Math.PI*2;loop.push(p.clone().addScaledVector(tan,Math.cos(a)*.47).add(new T.Vector3(0,.38+Math.sin(a)*.28,0)));}mesh(new T.TubeGeometry(new T.CatmullRomCurve3(loop),24,.025,5,false),gold,0,0,0);}}
 }
 if(material===ivory&&width>2){const grout=[];for(let i=0;i<=30;i++){const p=curve.getPoint(i/30),t=curve.getTangent(i/30),n=new T.Vector3(-t.z,0,t.x).normalize();p.y+=.009;grout.push(...p.clone().addScaledVector(n,-width*.48).toArray(),...p.clone().addScaledVector(n,width*.48).toArray());}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(grout,3));world.add(new T.LineSegments(g,new T.LineBasicMaterial({color:'#b5a17b'})));}return curve;
}

function decorateBridge(curve,width){
 const template=assets.get(41);template.updateMatrixWorld(true);const b=new T.Box3().setFromObject(template);const sourceLength=b.max.z-b.min.z;
 for(const side of [-1,1])template.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone();const source=g.getAttribute('position');if(source.normalized){const values=new Float32Array(source.count*3);for(let i=0;i<source.count;i++){values[i*3]=source.getX(i);values[i*3+1]=source.getY(i);values[i*3+2]=source.getZ(i);}g.setAttribute('position',new T.BufferAttribute(values,3));}g.applyMatrix4(o.matrixWorld);const p=g.getAttribute('position');const v=new T.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const t=T.MathUtils.clamp((v.z-b.min.z)/sourceLength,0,1),c=curve.getPoint(.04+.92*t),tan=curve.getTangent(.04+.92*t),n=new T.Vector3(-tan.z,0,tan.x).normalize();const lateral=side*(width*.49+(v.x-(b.min.x+b.max.x)/2)*2.3);c.addScaledVector(n,lateral);c.y+=(v.y-b.min.y-.075*Math.sin(Math.PI*t))*6-.08;p.setXYZ(i,c.x,c.y,c.z);}g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();const m=new T.Mesh(g,o.material);m.name='Tripo ornate bridge side '+side;world.add(m);});
}

function closedMesh(ix){const e=new Map();for(let i=0;i<ix.length;i+=3)for(const [a,b] of [[ix[i],ix[i+1]],[ix[i+1],ix[i+2]],[ix[i+2],ix[i]]]){const k=a<b?a+':'+b:b+':'+a;e.set(k,(e.get(k)||0)+1);}return [...e.values()].every(n=>n===2);}

const westBridge=path([[-6.4,.03,-5.0],[-10,1.5,-9],[-13,2.02,-11],[-16.8,2.02,-11]],2.7,ivory,false);decorateBridge(westBridge,2.7);
const returnBridge=new T.CatmullRomCurve3([[6,.03,5.8],[9,.3,7],[11.5,.2,6.8],[13.9,.03,5.8]].map(v=>new T.Vector3(...v)));// 旧东南桥已拆，出口改为 lane.js 的弧形栈桥
// Stair run is bounded by the actual hub and exit landing edges.
const stairStart=-8.6,stairEnd=-18.4,stairCount=24,stairRun=(stairStart-stairEnd)/stairCount,stairRise=4/stairCount;
const stairCurve=path([[0,-.2,stairStart],[0,3.8,stairEnd]],2.8,ivory,false);
for(let i=0;i<stairCount;i++){const top=(i+1)*stairRise;const step=mesh(new T.BoxGeometry(2.8,stairRise+.32,stairRun+.006),ivory,0,top-(stairRise+.32)/2,stairStart-(i+.5)*stairRun);step.name='bounded stair tread '+i;}
// Rails stop at the landing boundary, outside the flat island approach.
for(const side of [-1,1]){const pts=[];for(let i=0;i<=24;i++){const t=i/24;pts.push(new T.Vector3(side*1.48,.92+4*t,stairStart+(stairEnd-stairStart)*t));if(i%3===0)mesh(new T.CylinderGeometry(.065,.1,.85,8),gold,side*1.48,.45+4*t,stairStart+(stairEnd-stairStart)*t);}mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),32,.065,6,false),gold,0,0,0);}
// Outbound cloud route remains distinct from the high return bridge.
for(const [x,y,z] of [[-9,.15,3],[-12,.65,1],[-15,1.1,-2],[-18,1.55,-5]])put(29,x,y,z,2.8);
const cloudBeam=new T.CatmullRomCurve3([[-8,.3,3],[-12,.6,1],[-15,1.2,-2],[-20,2.15,-8]].map(v=>new T.Vector3(...v)));// 粉云下的小路已删，只能踩云过去

const ice=new T.MeshBasicMaterial({color:'#31c8ff',side:T.DoubleSide});const iceCurve=new T.CatmullRomCurve3([[23,5.03,-13],[27,4,-8],[25,1.4,0],[20,.03,4]].map(v=>new T.Vector3(...v)));
// Thin tile instances integrate with the structural deck without breaking the walkway.
// Removed the horizontal tile row that was floating below the rising stairs.
for(let i=0;i<9;i++){const a=i/9*Math.PI*2;put(27,Math.cos(a)*5.3,.04,Math.sin(a)*5.3,1.3,a,[1,.08,1]);}
// Ice rails and flowing white highlights follow the same continuous spline.
const cube=mesh(new T.BoxGeometry(1.2,1.2,1.2),new T.MeshStandardMaterial({color:'#059bea',emissive:'#0658ac',emissiveIntensity:.45,metalness:.4,roughness:.2}),19.5,6.55,-14.5);const edge=new T.LineSegments(new T.EdgesGeometry(cube.geometry),new T.LineBasicMaterial({color:'#dcfaff'}));cube.add(edge);
// Dense perimeter planting leaves travel surfaces clear.
function ring(cx,cz,r,y,n){for(let i=0;i<n;i++){const a=i/n*Math.PI*2,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;if(cx===0&&((z>5&&Math.abs(x)<3)||(z<-6&&Math.abs(x)<3)))continue;put(32,x,y,z,1.65+(i%3)*.22,a);if(i%2===0)put(32,x+Math.cos(a)*.7,y-.35,z+Math.sin(a)*.7,1.3,a+1);if(i%4===0)put(35,x+.35,y,z-.4,1.1,a);if(i%5===0)put(34,x,y,z,1.25,a);if(i%7===0)put(33,x,y+.02,z,0.65);if(i%6===0&&y>1)put(36,x,y-.9,z,1.8,a);}}
ring(0,0,8,.02,44);ring(-22,-12,5.3,2.02,28);ring(0,-22,3.4,4.02,18);
for(const [x,z] of [[-3,6],[3,6],[-3,-20],[3,-20]])put(23,x,x===-3||x===3?(z<0?4:0):5,z,.65);
// Floating sky rocks removed (mirror lake chapter).
// Clouds are replaced by soft layered billboards in enhance().
/*
const cloudM=[mat('#ffddf8'),mat('#f2b3e3'),mat('#d9c4f9')];const cloudG=new T.SphereGeometry(1,12,8);let seed=33;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<220;i++){const x=(rnd()-.5)*120,z=(rnd()-.5)*95,y=-16-rnd()*11;for(let j=0;j<3;j++){const m=mesh(cloudG,cloudM[(i+j)%3],x+j*1.7,y+rnd(),z);m.scale.set(3.7+rnd()*2,2.8+rnd()*1.5,3.5+rnd()*2);}}
*/
// Decorative sea clouds removed (mirror lake chapter).
const effects=enhance({T,scene,world,renderer,camera,controls,put,mesh,mat,ivory,gold,blue,assets,generatedChecks});
const lane=buildLane({T,world,assets,put});
const atmo=setupAtmosphere({T,scene,renderer,camera,lake});
const clearance=checkClearance({T,world,mesh,put,westBridge,returnBridge,iceCurve,stairStart,stairEnd,stairRun,stairRise,stairCount});
const fixLog=applyFixes({T,world,put});console.log('摆放修正',fixLog);
const layout=await fetch('./layout.json?v=quality4').then(r=>r.ok?r.json():null).catch(()=>null);const lay=applyLayout({world,put,layout});console.log('手动布局',lay.applied,'处');
const game=createGameplay({T,scene,world,camera,controls,renderer,westBridge,returnBridge,cloudBeam,stairStart,stairEnd,stairCount,cube,lane,lake});
await game.ready;
const editor=createEditor({T,scene,world,camera,controls,renderer,put,layout,isPlaying:()=>document.body.classList.contains('playing')});new MutationObserver(()=>{if(document.body.classList.contains('playing'))editor.exit();}).observe(document.body,{attributes:true,attributeFilter:['class']});
document.querySelector('#detail').innerHTML+=` <br><br>${manifest.length} 个模型载入完成<br>5 个区域 + 四向总览`;window.sceneState={ready:true,checks:generatedChecks,models:assets.size,instances:placed.length,scene,renderer,camera,controls,placed};document.querySelector('#load').remove();let invalidPositions=0;world.traverse(o=>{if(o.isMesh){const a=o.geometry.getAttribute('position');for(let i=0;i<a.array.length;i++)if(!Number.isFinite(a.array[i]))invalidPositions++;}});const check=document.createElement('span');check.id='integration-check';check.hidden=true;check.textContent=JSON.stringify({loaded:assets.size,newAssetInstances:placed.filter(p=>p.id>=38).length,invalidScenePositions:invalidPositions,bridgeSides:4});document.body.append(check);
const views={all:[[0,43,65],[0,0,-4]],center:[[12,18,23],[0,0,0]],left:[[-11,15,6],[-22,3,-12]],right:[[39,23,14],[20,2,-7]],stairs:[[15,14,-10],[0,2,-13]],top:[[0,66,-5],[0,0,-5]],bridge:[[-7,8,1],[-12,2,-9]],mechanism:[[26,12,-3],[20,5,-15]],exit:[[12,15,-7],[0,5,-22]],front:[[0,32,69],[0,-1,-4]],west:[[-65,34,20],[0,-1,-5]],east:[[65,34,20],[0,-1,-5]],back:[[0,33,-76],[0,-1,-5]]};function view(k){camera.position.fromArray(views[k][0]);controls.target.fromArray(views[k][1]);if(['front','west','east','back'].includes(k)){camera.position.sub(controls.target).multiplyScalar(Math.max(1,1.5/camera.aspect)).add(controls.target);}controls.update();}document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));let wire=false;document.querySelector('#wire').onclick=()=>{wire=!wire;world.traverse(o=>{if(o.isMesh)o.material.wireframe=wire;});};document.querySelector('#export').onclick=()=>{const blob=new Blob([JSON.stringify(world.toJSON())],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='dream-garden.three.json';a.click();URL.revokeObjectURL(a.href);};
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);atmo.resize();});let lastT=performance.now();renderer.setAnimationLoop(()=>{if(document.body.classList.contains('cu-paused')){lastT=performance.now();return;}updateAssetDetails(scene,camera);controls.update();effects.update(performance.now()*.001);game.update();{const now=performance.now();atmo.update(now*.001,Math.min(.05,(now-lastT)/1000));lastT=now;}atmo.render();});
