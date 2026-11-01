import {levelUI} from '../../ui/config.js';
import {createBGM} from '../shared/bgm.js?v=bgm3';createBGM('sky');
import {createUISystem} from '../../ui/system.js?v=restart1';
let sharedUI, pausedAt=0,timeOffset=0;
import {createGameAudio} from '../shared/game-audio.js';
const gameAudio=createGameAudio();addEventListener('cloud-resonance',()=>gameAudio.event('resonance'));
import {createSwing} from './swing.js';
let swing;
import {createGardenPaths} from './garden-paths.js?v=mvp3';
import {createPond} from './pond.js?v=mvp11';
let pond;
import {createTreehouseRoom} from './treehouse-room.js?v=mvp9';
let treehouseRoom;
import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {zones,createPlayer,stepPlayer,respawn,setGroundProvider} from './physics.js?v=spawn2';
// MVP：真实地面高度（按格缓存的向下射线）
const groundCache=new Map(),groundRay=new THREE.Raycaster(),groundDown=new THREE.Vector3(0,-1,0),groundUp=new THREE.Vector3(0,1,0);let groundTargets=[];
function refreshGround(){groundCache.clear();groundTargets=[];scene.updateMatrixWorld(true);scene.traverse(o=>{if(!o.isMesh||!/sculpted Tripo cliff|复制树屋岛体|Central lower terrace|• meadow/.test(o.name))return;for(let a=o;a;a=a.parent)if(!a.visible)return;groundTargets.push(o);});canvas.dataset.groundTargets=String(groundTargets.length);}
function groundHeights(x,z){const key=Math.round(x/.35)+','+Math.round(z/.35);let list=groundCache.get(key);if(list)return list;groundRay.set(new THREE.Vector3(Math.round(x/.35)*.35,220,Math.round(z/.35)*.35),groundDown);groundRay.far=480;list=groundRay.intersectObjects(groundTargets,false).filter(h=>h.face&&Number.isFinite(h.point.y)&&h.face.normal.clone().transformDirection(h.object.matrixWorld).dot(groundUp)>.55).map(h=>h.point.y);groundCache.set(key,list);groundMisses++;return list;}let groundMisses=0;
import {addSkyLighting,createSkyDome,sunDirection,sunColor,hazeColor} from './lighting.js?v=mvp3';
import {configureSunShadows} from './sun-shadows.js?v=mvp3';
import {VolumeFog} from './volume-fog.js?v=mvp3';
import {createMeadow,styleMeadowGround} from './meadow.js?v=grass1';
import {createChapter} from './chapter.js?v=guide1';
import {createWindMechanism} from './wind-mechanism.js?v=cam1';
import {createHero} from './hero.js?v=mvp11';
import {createRiggedAssets} from './rigged-assets.js?v=mvp3';
let lastAnimationShadow=-1;
import {addTerrainFoundation} from './terrain-foundation.js?v=mvp3';
import {createSceneEditor} from './scene-editor.js?v=ground8';
import {makeEditorCollisionSync} from './editor-collision.js?v=mvp11';
let editor;const editableRecords=[],terrainBeds=[];
let meadow,trees,hero,windMechanism,chapter;const groundMeshes=[];
const $=s=>document.querySelector(s),canvas=$('#world');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer:coarse)').matches?1.3:1.6));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#9fbfe4');scene.fog=new THREE.FogExp2(hazeColor.clone().multiplyScalar(.92),.0024);
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.2,650);camera.position.set(-28,42,90);
const controls=new OrbitControls(camera,canvas);controls.target.set(3,8,17);controls.enableDamping=true;controls.dampingFactor=.07;controls.minDistance=8;controls.maxDistance=240;controls.maxPolarAngle=Math.PI*.48;controls.autoRotate=false;controls.autoRotateSpeed=.15;
const lightingEnvironment=addSkyLighting(scene,renderer);
const sun=new THREE.DirectionalLight(sunColor,2.5);sun.position.copy(sunDirection).multiplyScalar(125).add(new THREE.Vector3(0,0,10));sun.target.position.set(0,0,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-105;sun.shadow.camera.right=105;sun.shadow.camera.top=100;sun.shadow.camera.bottom=-100;sun.shadow.camera.near=5;sun.shadow.camera.far=250;sun.shadow.bias=-.0004;sun.shadow.normalBias=.08;scene.add(sun,sun.target);configureSunShadows(sun,renderer,matchMedia('(pointer:coarse)').matches);
// Clear atmospheric background; clouds are spatial volumes rather than a sky photo.
const sky=createSkyDome();
sky.renderOrder=-10;scene.add(sky);
const skyReady=Promise.resolve();canvas.dataset.skySource='Spatial volumetric clouds';
const atmosphere=new VolumeFog(renderer);
const p=createPlayer(),keys=new Set(),surfaces=zones.map(z=>({...z,island:true}));
for(let i=0;i<46;i++){const z=-25+i*.45;surfaces.push({x:-37,z,h:1.18+Math.max(0,Math.min(2.1,(z+23)*.21)),rx:11,rz:.34});}
surfaces.push({x:-8,z:4,h:3.21,rx:9.5,rz:7.5,island:true});
for(let i=0;i<10;i++)surfaces.push({x:-8,z:5+i*.65,h:3.31+i*.2,rx:1.0,rz:.43});
for(const [x,z,h,r] of [[-24,4,2.2,3.8],[9,22,6,3.3],[40,16,8.4,3.4]])surfaces.push({x,z,h:h+.13,rx:r*.95,rz:r*.8});
let mode='intro',ready=false,jumpQueued=false,lastTime=performance.now(),toastTimer,resetting=false,drag=null,joystick={x:0,z:0},modelCount=0;
let frameStart=performance.now(),frameCount=0;
const map=$('#map').getContext('2d');
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3200);}
function updateUI(){let nearest=0,best=Infinity;for(let i=0;i<zones.length;i++){const d=Math.hypot(p.pos.x-zones[i].x,p.pos.z-zones[i].z);if(d<best){best=d;nearest=i;}}$('#zone').textContent=mode==='orbit'?'云端全景':zones[nearest].name;$('#progress').textContent=`已探索 ${p.visited.size} / 4`;$('#overview').textContent=mode==='orbit'?'回到行走':'全景观察';}
function drawMap(){map.clearRect(0,0,220,152);const xy=(x,z)=>[18+(x+52)/120*184,136-(z+30)/80*118];map.strokeStyle='#9cb5bb';map.lineWidth=1;map.setLineDash([3,4]);map.beginPath();zones.forEach((z,i)=>{const [x,y]=xy(z.x,z.z);i?map.lineTo(x,y):map.moveTo(x,y);});map.stroke();map.setLineDash([]);
 zones.forEach((z,i)=>{const [x,y]=xy(z.x,z.z);map.beginPath();map.ellipse(x,y,z.rx*1.05,z.rz*.63,0,0,Math.PI*2);map.fillStyle=p.visited.has(i)?'#8eaa94':'#c7d5cb';map.fill();map.fillStyle='#fff';map.font='9px system-ui';map.textAlign='center';map.fillText(String(i+1).padStart(2,'0'),x,y+3);});
 if(mode==='walk'){const[x,y]=xy(p.pos.x,p.pos.z);map.save();map.translate(x,y);map.rotate(-p.yaw);map.beginPath();map.moveTo(0,6);map.lineTo(-4,-4);map.lineTo(4,-4);map.closePath();map.fillStyle='#bf8d3d';map.fill();map.restore();}}
let introCam=null,introDone=false;
function introShot(dt){introCam.t+=dt*(introCam.t>1&&keys.size?4:1);const T=7,k=Math.min(1,introCam.t/T),sm=x=>{x=Math.min(1,Math.max(0,x));return x*x*(3-2*x);};
 /* 出生运镜：先在高处环绕浮岛一圈，最后平滑推回主角身后的跟随视角 */
 const fc=introCam.fc??=new THREE.PerspectiveCamera();hero?.follow(fc,p,1,surfaces);
 const tgt=new THREE.Vector3(p.pos.x,p.pos.y+.95,p.pos.z),a=sm(k/.78),ang=p.yaw+(1-a)*Math.PI*1.7,r=THREE.MathUtils.lerp(28,10,a),el=THREE.MathUtils.lerp(.55,.42,a);
 const orbitPos=new THREE.Vector3(tgt.x+Math.sin(ang)*Math.cos(el)*r,tgt.y+Math.sin(el)*r,tgt.z+Math.cos(ang)*Math.cos(el)*r),b=sm((k-.62)/.38);
 camera.position.copy(orbitPos.lerp(fc.position,b));tgt.y+=(1-b)*1.5;camera.lookAt(tgt);
 if(k>=1){introCam=null;hero?.resetCamera();}}
function walk(){if(!ready||editor?.active)return;const safe=surfaces.slice(0,4).findIndex(s=>s.h>-1000);if(safe<0){toast('请在场景编辑中至少显示一座主岛');return;}if(surfaces[p.checkpoint].h<-1000&&topGround(zones[p.checkpoint].spawn.x,zones[p.checkpoint].spawn.z)===null){p.checkpoint=safe;respawn(p);}mode='walk';controls.enabled=false;document.body.className='walk';$('#intro').classList.add('closed');$('#walkHelp').hidden=false;$('#crosshair').hidden=true;hero?.resetCamera();if(!introDone&&!new URLSearchParams(location.search).has('testStart')){introDone=true;introCam={t:0};}canvas.focus();camera.fov=55;camera.updateProjectionMatrix();updateUI();toast('沿着云桥探索浮岛 · 掉落后会回到最近的落脚点');}
function orbit(){if(!ready||editor?.active)return;mode='orbit';document.exitPointerLock?.();document.body.className='orbit';$('#intro').classList.add('closed');$('#walkHelp').hidden=true;controls.enabled=true;const inspect=new URLSearchParams(location.search).get('inspect')==='foundation';if(new URLSearchParams(location.search).get('view')==='start'){camera.position.set(-25,10,-33);controls.target.set(-37,4,-13);controls.update();updateUI();return;}camera.position.set(...(inspect?[24,3,-24]:[-28,42,90]));controls.target.set(...(inspect?[24,0,4]:[3,8,17]));controls.autoRotate=false;camera.fov=55;camera.updateProjectionMatrix();controls.update();updateUI();}
function pause(){if(sharedUI){sharedUI.open();return;}if(!ready||editor?.active)return;if(mode==='intro'){walk();return;}document.exitPointerLock?.();mode='intro';controls.enabled=true;$('#intro').classList.remove('closed');$('#start').innerHTML='继续漫游 <span>↗</span>';$('#walkHelp').hidden=true;keys.clear();}
function resetPlayer(){if(resetting)return;resetting=true;p.falls++;$('#fade').classList.add('active');setTimeout(()=>{respawn(p);hero?.resetCamera();$('#fade').classList.remove('active');resetting=false;toast(`已回到${zones[p.checkpoint].name}`);updateUI();},250);}
$('#start').addEventListener('click',walk);$('#tour').addEventListener('click',orbit);$('#overview').addEventListener('click',()=>mode==='orbit'?walk():orbit());$('#reset').addEventListener('click',()=>{if(mode!=='walk')walk();resetPlayer();});$('#help').addEventListener('click',pause);
addEventListener('keydown',e=>{if(swing?.handleKey(e)||chapter?.handleKey(e)||windMechanism?.handleKey(e))return;if(editor?.active||/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='Space'&&!e.repeat)jumpQueued=true;if(e.code==='KeyR'&&mode==='walk')resetPlayer();if(e.code==='Escape')pause();});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();joystick={x:0,z:0};drag=null;});document.addEventListener('visibilitychange',()=>{lastTime=performance.now();keys.clear();});
canvas.addEventListener('pointerdown',e=>{if(mode!=='walk'||sharedUI?.paused)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(mode!=='walk'||sharedUI?.paused)return;if(document.pointerLockElement===canvas){p.yaw-=e.movementX*.0025*(sharedUI?.settings.sensitivity||1);p.pitch-=e.movementY*.0025*(sharedUI?.settings.sensitivity||1);}else if(drag?.id===e.pointerId){p.yaw-=(e.clientX-drag.x)*.004*(sharedUI?.settings.sensitivity||1);p.pitch-=(e.clientY-drag.y)*.004*(sharedUI?.settings.sensitivity||1);drag.x=e.clientX;drag.y=e.clientY;}p.pitch=Math.max(-1.25,Math.min(1.15,p.pitch));});canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);canvas.addEventListener('dblclick',()=>{if(mode==='walk'&&!matchMedia('(pointer:coarse)').matches)canvas.requestPointerLock?.()?.catch?.(()=>toast('拖动画面也可以转向'));});
let stickId=null;$('#joystick').addEventListener('pointerdown',e=>{stickId=e.pointerId;$('#joystick').setPointerCapture(e.pointerId);moveStick(e);});$('#joystick').addEventListener('pointermove',e=>{if(e.pointerId===stickId)moveStick(e);});function moveStick(e){const b=$('#joystick').getBoundingClientRect();let x=(e.clientX-b.x-b.width/2)/38,y=(e.clientY-b.y-b.height/2)/38;const l=Math.max(1,Math.hypot(x,y));x/=l;y/=l;joystick={x,z:-y};$('#stick').style.transform=`translate(${x*32}px,${y*32}px)`;}
for(const type of ['pointerup','pointercancel'])$('#joystick').addEventListener(type,()=>{stickId=null;joystick={x:0,z:0};$('#stick').style.transform='';});$('#jump').addEventListener('pointerdown',e=>{e.preventDefault();jumpQueued=true;});
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
function stonePlatform(cloud){cloud.computeBoundingBox();const bb=cloud.boundingBox,sx=(bb.max.x-bb.min.x)/2,sz=(bb.max.z-bb.min.z)/2,depth=Math.max(.9,(bb.max.y-bb.min.y)*1.1);
 const geo=new THREE.LatheGeometry([[0,0],[1,0],[.98,-.1],[.86,-.3],[.62,-.6],[.34,-.86],[.1,-1]].map(([r,y])=>new THREE.Vector2(r,y)),9);
 geo.scale(sx,depth,sz);geo.translate((bb.min.x+bb.max.x)/2,bb.max.y,(bb.min.z+bb.max.z)/2);
 const pos=geo.attributes.position,col=new Float32Array(pos.count*3),moss=new THREE.Color('#8daf68'),rock=new THREE.Color('#d6ccb2');
 for(let i=0;i<pos.count;i++){const c=pos.getY(i)>bb.max.y-depth*.12?moss:rock;col.set([c.r,c.g,c.b],i*3);}
 geo.setAttribute('color',new THREE.BufferAttribute(col,3));geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();return geo;}
const stoneMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,flatShading:true});
const cloudPlatform=/Jumping cloud bridge|Cloud crossing|Final ascent/;
// MVP：岛体顶面平滑（只动顶部区域，崖壁不动；按位置焊接，避免 UV 接缝开裂）
function smoothIslandTop(geom,iterations=30,lambda=.7){
 // 只平滑朝上的草坪面；侧面岩壁和草坪边缘不动，岩石纹理与草皮边界保持原样
 const pos=geom.attributes.position,nor=geom.attributes.normal,count=pos.count,index=geom.index.array;geom.computeBoundingBox();const bb=geom.boundingBox,height=bb.max.y-bb.min.y,limit=bb.max.y-.2*height;
 const key=i=>Math.round(pos.getX(i)*2000)+','+Math.round(pos.getY(i)*2000)+','+Math.round(pos.getZ(i)*2000);
 const ids=new Int32Array(count),map=new Map();let n=0;for(let i=0;i<count;i++){const k=key(i);let id=map.get(k);if(id===undefined){id=n++;map.set(k,id);}ids[i]=id;}
 const P=new Float32Array(n*3);for(let i=0;i<count;i++){const j=ids[i]*3;P[j]=pos.getX(i);P[j+1]=pos.getY(i);P[j+2]=pos.getZ(i);}
 const nbr=Array.from({length:n},()=>new Set());for(let t=0;t<index.length;t+=3){const a=ids[index[t]],b=ids[index[t+1]],c=ids[index[t+2]];nbr[a].add(b).add(c);nbr[b].add(a).add(c);nbr[c].add(a).add(b);}
 // 岩壁 = 从下半部分出发、沿陡峭的边（坡度>45°）往上能连到的点；其余顶部点都算草坪
 const va=new THREE.Vector3(),vb=new THREE.Vector3(),vc=new THREE.Vector3(),e1=new THREE.Vector3(),e2=new THREE.Vector3();
 const wall=new Uint8Array(n),queue=[];for(let v=0;v<n;v++)if(P[v*3+1]<=limit){wall[v]=1;queue.push(v);}
 while(queue.length){const v=queue.pop();for(const u of nbr[v]){if(wall[u])continue;const dy=Math.abs(P[u*3+1]-P[v*3+1]),dh=Math.hypot(P[u*3]-P[v*3],P[u*3+2]-P[v*3+2]);if(dy>dh){wall[u]=1;queue.push(u);}}}
 const top=new Uint8Array(n);for(let v=0;v<n;v++)top[v]=wall[v]?0:1;
 const movable=top;
 const Q=new Float32Array(P.length);
 for(let it=0;it<iterations;it++){Q.set(P);for(let v=0;v<n;v++){if(!movable[v])continue;let y=0;for(const u of nbr[v])y+=P[u*3+1];Q[v*3+1]+=(y/nbr[v].size-P[v*3+1])*lambda;}P.set(Q);}
 for(let i=0;i<count;i++){if(!movable[ids[i]])continue;const j=ids[i]*3;pos.setY(i,P[j+1]);}
 // 只给草坪面写平滑法线
 const N=new Float32Array(n*3);
 for(let t=0;t<index.length;t+=3){const a=ids[index[t]],b=ids[index[t+1]],c=ids[index[t+2]];if(!top[a]&&!top[b]&&!top[c])continue;va.fromArray(P,a*3);vb.fromArray(P,b*3);vc.fromArray(P,c*3);e1.subVectors(vb,va);e2.subVectors(vc,va);e1.cross(e2);for(const v of [a,b,c]){N[v*3]+=e1.x;N[v*3+1]+=e1.y;N[v*3+2]+=e1.z;}}
 for(let i=0;i<count;i++){const v=ids[i];if(!movable[v])continue;va.fromArray(N,v*3).normalize();nor.setXYZ(i,va.x,va.y,va.z);}
 pos.data.needsUpdate=true;geom.computeBoundingBox();geom.computeBoundingSphere();geom.userData.turfSmoothed={top:top.reduce((a,b)=>a+b,0),moved:movable.reduce((a,b)=>a+b,0),welded:n};return geom;}

// MVP：在两点之间的地面断口处自动铺浮空石台（可走、平缓过渡）
function bridgeGap(ax,az,bx,bz){const steps=Math.ceil(Math.hypot(bx-ax,bz-az)/.4),pts=[];for(let i=0;i<=steps;i++){const t=i/steps,x=ax+(bx-ax)*t,z=az+(bz-az)*t,l=groundHeights(x,z);pts.push({x,z,h:l.length?l[0]:null});}
 let made=0;for(let i=1;i<pts.length;i++){if(pts[i].h!==null||pts[i-1].h===null)continue;let j=i;while(j<pts.length&&pts[j].h===null)j++;if(j>=pts.length)break;
  const a=pts[i-1],b=pts[j],len=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(2,Math.ceil(len/1.3)+1);
  for(let k=0;k<=n;k++){const t=k/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,h=a.h+(b.h-a.h)*t;const g=stonePlatform(new THREE.BoxGeometry(2.3,.9,2.3).translate(0,-.45,0));const m=new THREE.Mesh(g,stoneMaterial);m.position.set(x,h,z);m.castShadow=m.receiveShadow=true;m.name='连接石台';scene.add(m);surfaces.push({x,z,h,rx:1.1,rz:1.1});made++;}
  i=j;}
 canvas.dataset.bridgeStones=String(Number(canvas.dataset.bridgeStones||0)+made);return made;}

// MVP：从地面边缘到一块高处石台补一段阶梯石台（每级升高不超过 0.9，可轻松跳上）
function stairTo(tx,tz,th,fx,fz){let ex=null,ez=null,eh=null;const len=Math.hypot(fx-tx,fz-tz);for(let s=0;s<=len;s+=.3){const x=tx+(fx-tx)*s/len,z=tz+(fz-tz)*s/len,l=groundHeights(x,z);if(l.length){ex=x;ez=z;eh=l[0];break;}}if(ex===null)return 0;
 const dist=Math.hypot(tx-ex,tz-ez),rise=th-eh,n=Math.max(Math.ceil(dist/1.7),Math.ceil(Math.abs(rise)/.9));let made=0;
 for(let k=1;k<n;k++){const t=k/n,x=ex+(tx-ex)*t,z=ez+(tz-ez)*t,h=eh+rise*t;const g=stonePlatform(new THREE.BoxGeometry(2.3,.9,2.3).translate(0,-.45,0));const m=new THREE.Mesh(g,stoneMaterial);m.position.set(x,h,z);m.castShadow=m.receiveShadow=true;m.name='连接石台';scene.add(m);surfaces.push({x,z,h,rx:1.1,rz:1.1});made++;}
 canvas.dataset.stairStones=String(made);return made;}

// 去云台后的路线修正：隐藏所有可踩云台、机关台贴地、在岛与岛之间生成连续石阶（每级 ≤0.3，可直接走上去）
const stairGroup=new THREE.Group();stairGroup.name='连接石阶';const stairMaterial=new THREE.MeshStandardMaterial({color:'#d9cfb6',roughness:.92});const stairTopMaterial=new THREE.MeshStandardMaterial({color:'#98b46e',roughness:.95});
function topGround(x,z){const l=groundHeights(x,z);return l.length?l[0]:null;}
// 石阶的碰撞是一条连续斜坡（画面仍是一级级台阶），上下楼梯不会一顿一顿
const stairRamps=[];function rampHeight(x,z){let best=null;for(const r of stairRamps){const dx=x-r.ax,dz=z-r.az,t=dx*r.ux+dz*r.uz,side=Math.abs(dx*r.uz-dz*r.ux);if(side>r.half||t<r.t0||t>r.t1)continue;const h=r.h1+(r.h2-r.h1)*Math.min(1,Math.max(0,(t-r.s1)/(r.s2-r.s1)));if(best===null||h>best)best=h;}return best;}
function buildStair(ax,az,bx,bz){
 const len=Math.hypot(bx-ax,bz-az),ux=(bx-ax)/len,uz=(bz-az)/len,pts=[];for(let s=0;s<=len;s+=.25)pts.push({s,h:topGround(ax+ux*s,az+uz*s)});
 let i=0;while(i<pts.length&&pts[i].h!==null)i++;if(i===0||i>=pts.length)return 0;let j=i;while(j<pts.length&&pts[j].h===null)j++;if(j>=pts.length)return 0;
 let s1=pts[i-1].s,h1=pts[i-1].h,s2=pts[j].s,h2=pts[j].h;const rise=h2-h1,steps=Math.max(2,Math.ceil(Math.abs(rise)/.28)+1,Math.ceil((s2-s1)/.65));
 const need=steps*.42;if(s2-s1<need){if(rise>0)s1=s2-need;else s2=s1+need;}
 const tread=(s2-s1)/steps,yaw=Math.atan2(ux,uz);let made=0;stairRamps.push({ax,az,ux,uz,half:1.25,t0:s1-.2-tread*.5,t1:s2+.25+tread*.6,s1:s1+tread*.5,s2:s2-tread*.5,h1,h2:h1+rise});
 for(let k=-1;k<=steps;k++){const kk=Math.max(0,Math.min(steps,k)),s=s1+tread*(k+.5)-(k<0?.2:0)+(k>=steps?.25:0),h=h1+rise*(kk/steps),x=ax+ux*s,z=az+uz*s;
  const g=topGround(x,z),depth=g!==null&&g<h&&h-g<1.4?Math.max(.55,h-g+.35):.55;/* 只把贴近地面的几级台阶补到地面；离地很高的不往下长，避免挡成一面墙 *//* 台阶一直落到地面，不再悬空 */
  const step=new THREE.Mesh(new THREE.BoxGeometry(2.6,depth,tread+(k<0||k>=steps?.7:.06)),stairMaterial);step.position.set(x,h-depth/2,z);step.rotation.y=yaw;step.castShadow=step.receiveShadow=true;
  const moss=new THREE.Mesh(new THREE.BoxGeometry(2.62,.06,tread+(k<0||k>=steps?.72:.08)),stairTopMaterial);moss.position.y=depth/2-.025;step.add(moss);stairGroup.add(step);
  made++;}
 {/* 台阶底下补一条斜梁，悬空段看起来是一座完整的石阶桥 */const run=s2-s1,L=Math.hypot(run,rise),mid=(s1+s2)/2;const beam=new THREE.Mesh(new THREE.BoxGeometry(2.5,.6,L),stairMaterial);beam.position.set(ax+ux*mid,h1+rise/2-.9,az+uz*mid);beam.rotation.set(-Math.atan2(rise,run),yaw,0,'YXZ');beam.castShadow=beam.receiveShadow=true;stairGroup.add(beam);}
 return made;}
function routeFixups(){
 scene.traverse(o=>{if(/Jumping cloud bridge|Cloud crossing|Final ascent/.test(o.name))o.visible=false;});
 for(const s of surfaces)if(s.editorKey&&/Jumping cloud bridge|Cloud crossing|Final ascent/.test(s.editorKey))s.h=-10000;
 for(let i=surfaces.length-1;i>=0;i--)if(surfaces[i].stair)surfaces.splice(i,1);stairRamps.length=0;
 for(const c of [...stairGroup.children]){stairGroup.remove(c);c.traverse(o=>o.geometry?.dispose());}
 if(!stairGroup.parent)scene.add(stairGroup);
 editor?.groundFloating?.();refreshGround();scene.updateMatrixWorld(true);
 // 场景根层级里编辑器没接管的装饰副本：旧石门光效、通往已隐藏平台的台阶隐藏；其余悬空的逐个落到岛面
 {for(const o of scene.children)if(/^Gate • (vertical light|star flare)|^01 • First memory beacon|^Central terrace stair/.test(o.name))o.visible=false;
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),nrm=new THREE.Vector3(),m=new THREE.Matrix4(),wm=new THREE.Matrix4(),inv=new THREE.Matrix4(),tr=new THREE.Matrix4(),b=new THREE.Box3(),c=new THREE.Vector3(),ps=new THREE.Vector3(),qt=new THREE.Quaternion(),sc=new THREE.Vector3();
  const skipRoot=/Sky archipelago|cloud|Cloud|ascent|mote|spark|spiral|beacon|Sun disk|• meadow|cliff|foundation|岛体|Waterfall/;
  const restOn=[...groundTargets];scene.traverse(o=>{if(o.isMesh&&/Sky archipelago/.test(o.name)){for(let a=o;a;a=a.parent)if(!a.visible)return;restOn.push(o);}});
  const groundBelow=(x,z,from)=>{ray.set(new THREE.Vector3(x,from,z),down);ray.far=80;const h=ray.intersectObjects(restOn,false).find(h=>h.face&&nrm.copy(h.face.normal).transformDirection(h.object.matrixWorld).y>.5);return h?h.point.y:null;};
  let fixed=0;
  for(const o of scene.children){if(!o.visible||!/^\d\d • |^Meadow • |^Path • |flowering-shrub|flower border|decor/.test(o.name)||skipRoot.test(o.name)||o.userData.meadowCapacity)continue;
   if(o.isInstancedMesh){o.geometry.computeBoundingBox();inv.copy(o.matrixWorld).invert();let changed=false;
    for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);m.decompose(ps,qt,sc);if(Math.abs(sc.x)<1e-4)continue;wm.multiplyMatrices(o.matrixWorld,m);b.copy(o.geometry.boundingBox).applyMatrix4(wm);b.getCenter(c);const g=groundBelow(c.x,c.z,b.max.y+.5);if(g===null){/* 下方没有岛面：隐藏这个副本 */m.copy(m).scale(new THREE.Vector3(0,0,0));o.setMatrixAt(i,m);changed=true;fixed++;continue;}const gap=b.min.y-g;if(gap<.15)continue;tr.makeTranslation(0,-(gap-.01),0);m.multiplyMatrices(inv,tr.multiply(wm));o.setMatrixAt(i,m);changed=true;fixed++;}
    if(changed){o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere?.();o.computeBoundingBox?.();}}
   else{b.setFromObject(o);if(b.isEmpty())continue;b.getCenter(c);const g=groundBelow(c.x,c.z,b.max.y+.5);if(g===null){o.visible=false;fixed++;continue;}const gap=b.min.y-g;if(gap<.15)continue;o.position.y-=gap-.01;o.updateMatrixWorld(true);fixed++;}}
  canvas.dataset.groundedRoot=String(fixed);}const v=new THREE.Vector3(),at=n=>{let o=null;scene.traverse(x=>{if(!o&&x.name===n)o=x});return o;};
 const station=at('风纹机关台');if(station){station.getWorldPosition(v);const g=topGround(v.x,v.z);if(g!==null&&Math.abs(g-v.y)>.05){v.y=g;station.position.copy(station.parent.worldToLocal(v.clone()));station.updateMatrixWorld(true);}}
 const pos=n=>{const o=at(n);return o?o.getWorldPosition(new THREE.Vector3()):null;};
 const gate=pos('第一段记忆 · 触碰点'),wind=pos('风纹机关台'),bell=pos('回声风铃 · 修复互动'),lift=pos('风托平台 · 塔顶升降台');let made=0;
 if(gate&&wind)made+=buildStair(gate.x,gate.z,wind.x,wind.z);
 if(bell&&lift)made+=buildStair(bell.x,bell.z,lift.x,lift.z);
 canvas.dataset.stairSteps=String(made);refreshGround();fillBareGrass();
 // 出生点放在苏醒草坡（石门所在的起点岛）：从石门往楼梯方向走 4 米、落在岛面上
 if(gate){const rp=stairRamps[0],low=rp?{x:rp.ax+rp.ux*rp.s1,z:rp.az+rp.uz*rp.s1}:null;let dx=low?low.x-gate.x:1,dz=low?low.z-gate.z:0;const L=Math.hypot(dx,dz)||1;dx/=L;dz/=L;
  for(const k of [4,3,5,2.5,6]){const x=gate.x+dx*k,z=gate.z+dz*k,g=topGround(x,z);if(g!==null){zones[0].spawn={x,y:g,z};zones[0].x=gate.x+dx*2;zones[0].z=gate.z+dz*2;zones[0].h=g;zones[0].rx=zones[0].rz=9;
   const t=levelUI[1].tutorial;for(const r of [t.look,t.move]){r.x=x;r.y=g;r.z=z;}if(p.checkpoint===0&&mode!=='walk')respawn(p);p.yaw=Math.atan2(-(gate.x-x),-(gate.z-z));break;}}}
}

// 补草：统计现有草叶密度，在岛面上偏秃的格子按周围平均密度补种同款草叶（避开石子路、水池、台阶）
const grassFill=new THREE.Group();grassFill.name='补种草丛';
function fillBareGrass(){
 for(const c of [...grassFill.children]){grassFill.remove(c);c.dispose?.();}if(!grassFill.parent)scene.add(grassFill);
 scene.updateMatrixWorld(true);const m=new THREE.Matrix4(),w=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),sc=new THREE.Vector3(),col=new THREE.Color();
 const tiles=[];scene.traverse(o=>{if(!o.isInstancedMesh||!o.userData.meadowCapacity||o.parent===grassFill)return;for(let a=o;a;a=a.parent)if(!a.visible)return;tiles.push(o);});if(!tiles.length)return 0;
 let tpl=tiles[0];for(const t of tiles)if(t.userData.meadowCapacity>tpl.userData.meadowCapacity)tpl=t;
 const density=new Map(),key=(x,z)=>Math.floor(x)+','+Math.floor(z);
 for(const o of tiles){const arr=o.instanceMatrix.array;for(let i=0;i<o.userData.meadowCapacity;i++){m.fromArray(arr,i*16);w.multiplyMatrices(o.matrixWorld,m);p.setFromMatrixPosition(w);const k=key(p.x,p.z);density.set(k,(density.get(k)||0)+1);}}
 const counts=[...density.values()].sort((a,b)=>a-b),target=Math.round((counts[counts.length>>1]||30)*.8);
 const samples=[];for(let i=0;i<Math.min(400,tpl.userData.meadowCapacity);i++){const j=Math.floor(Math.random()*tpl.userData.meadowCapacity);m.fromArray(tpl.instanceMatrix.array,j*16);w.multiplyMatrices(tpl.matrixWorld,m);w.decompose(p,q,sc);if(tpl.instanceColor)col.fromArray(tpl.instanceColor.array,j*3);samples.push({s:sc.clone(),c:col.clone()});}
 const blockers=[];scene.traverse(o=>{if(!o.isMesh)return;let named=false;for(let a=o;a&&a!==scene;a=a.parent)if(/Path • |花园石子路|staircase|石阶|镜湖水池|Memory stone|Waterfall/.test(a.name)){named=true;break;}if(!named)return;for(let a=o;a;a=a.parent)if(!a.visible)return;blockers.push(o);});
 for(const s of stairGroup.children)blockers.push(s);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),mask=new Map();
 const blocked=(x,z,g)=>{const k=Math.floor(x*2)+','+Math.floor(z*2);if(mask.has(k))return mask.get(k);ray.set(new THREE.Vector3(Math.floor(x*2)/2+.25,g+6,Math.floor(z*2)/2+.25),down);ray.far=7.5;const hit=ray.intersectObjects(blockers,false).some(h=>h.point.y>g-.4);mask.set(k,hit);return hit;};
 const chunks=new Map();let added=0;
 for(let x=-60;x<70;x++)for(let z=-40;z<50;z++){const g0=topGround(x+.5,z+.5);if(g0===null)continue;const have=density.get(x+','+z)||0;if(have>=target*.35)continue;
  for(let n=have;n<target;n++){const px=x+Math.random(),pz=z+Math.random(),g=topGround(px,pz);if(g===null||blocked(px,pz,g))continue;const smp=samples[Math.floor(Math.random()*samples.length)];
   q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,Math.random()*Math.PI*2);m.compose(p.set(px,g,pz),q,smp.s);const ck=Math.floor(px/8)+','+Math.floor(pz/8);if(!chunks.has(ck))chunks.set(ck,[]);chunks.get(ck).push({m:m.clone(),c:smp.c});added++;}}
 for(const [ck,list] of chunks){const im=new THREE.InstancedMesh(tpl.geometry,tpl.material,list.length);list.forEach((it,i)=>{im.setMatrixAt(i,it.m);im.setColorAt(i,it.c);});im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;im.computeBoundingSphere();im.computeBoundingBox?.();im.receiveShadow=tpl.receiveShadow;im.castShadow=false;im.userData.meadowCapacity=list.length;im.name='补种草丛 • '+ck;grassFill.add(im);}
 canvas.dataset.grassFilled=String(added);return added;}
function parseMesh(buffer,info){const view=new DataView(buffer);const nv=view.getInt32(0,true),nt=view.getInt32(4,true);const geom=new THREE.BufferGeometry(),raw=new Float32Array(buffer,8,nv*8),inter=new THREE.InterleavedBuffer(raw,8);geom.setAttribute('position',new THREE.InterleavedBufferAttribute(inter,3,0));geom.setAttribute('normal',new THREE.InterleavedBufferAttribute(inter,3,3));geom.setAttribute('uv',new THREE.InterleavedBufferAttribute(inter,2,6));const indices=nv>65535?new Uint32Array(nt*3):new Uint16Array(nt*3);let lastSlot=-1,start=0;
 for(let i=0;i<nt;i++){const base=8+nv*32+i*16;for(let j=0;j<3;j++)indices[i*3+j]=view.getInt32(base+j*4,true);const slot=view.getInt32(base+12,true);if(slot!==lastSlot){if(lastSlot>=0)geom.addGroup(start,i*3-start,lastSlot);start=i*3;lastSlot=slot;}}if(lastSlot>=0)geom.addGroup(start,nt*3-start,lastSlot);geom.setIndex(new THREE.BufferAttribute(indices,1));geom.computeBoundingBox();geom.computeBoundingSphere();return geom;}
async function load(){await skyReady;const response=await fetch('./assets/scene.json?v=start-relief1');if(!response.ok)throw new Error('场景读取失败');const data=await response.json(),materials=new Map(),tl=new THREE.TextureLoader();
 await Promise.all(data.materials.map(async m=>{let texture=null;if(m.texture){texture=await tl.loadAsync('./assets/textures/'+m.texture);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}
  const em=m.emission||[0,0,0];const mat=new THREE.MeshStandardMaterial({color:new THREE.Color(...m.color.slice(0,3)),map:texture,roughness:m.roughness,metalness:m.metallic,emissive:new THREE.Color(...em),side:/Daisy|Foliage|Meadow/.test(m.name)?THREE.DoubleSide:THREE.FrontSide});if(texture&&/^tripo/i.test(m.name))mat.color.setRGB(1,1,1);if(/^Meadow • [0-3]$/.test(m.name))styleMeadowGround(mat);materials.set(m.name,mat);
 }));
 const grouped=new Map();for(const o of data.objects){if(o.name==='treehouse'||/trailing moss/i.test(o.name))continue;if(/^(01 • Cloud traveller|01 • Awakening stone gate|04 • Treehouse timber shelter|04 • Wooden balcony|Sun disk|Cloud sea|Horizon cumulus|Ancient tree • trunk|Tree branch|Tree crown|Tree • exposed root|Tree • leaf lace|03 • Great windmill|Meadow • daisies|Meadow • fine grass)/.test(o.name))continue;if(!grouped.has(o.mesh))grouped.set(o.mesh,[]);grouped.get(o.mesh).push(o);}
 let completed=0,next=0;const matrix=new THREE.Matrix4(),quat=new THREE.Quaternion(),pos=new THREE.Vector3(),scale=new THREE.Vector3();
 async function worker(){while(next<data.meshes.length){const info=data.meshes[next++],objects=grouped.get(info.id)||[];if(!objects.length)continue;const res=await fetch('./assets/meshes/'+info.file);if(!res.ok)throw new Error('模型读取失败');const isPlatform=objects.every(o=>cloudPlatform.test(o.name));let geo=parseMesh(await res.arrayBuffer(),info);if(isPlatform)geo=stonePlatform(geo);if(info.id===0)smoothIslandTop(geo);const mats=isPlatform?[stoneMaterial]:info.materials.map(n=>materials.get(n)||new THREE.MeshStandardMaterial({color:'#e9e5d9'}));const mesh=new THREE.InstancedMesh(geo,mats.length===1?mats[0]:mats,objects.length);if(info.id===0){const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];mesh.material=list.map(source=>{const mat=source.clone();mat.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 islandWorld;varying vec3 islandNormal;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n mat4 islandMatrix=modelMatrix;\n #ifdef USE_INSTANCING\n islandMatrix=modelMatrix*instanceMatrix;\n #endif\n islandWorld=(islandMatrix*vec4(position,1.)).xyz;islandNormal=normalize(mat3(islandMatrix)*normal);');shader.fragmentShader='varying vec3 islandWorld;varying vec3 islandNormal;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float hi=max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b)),lo=min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b));
 float paving=(1.-smoothstep(.06,.19,hi-lo))*smoothstep(.15,.4,hi)*smoothstep(.55,.85,islandNormal.y);
 if(islandWorld.y<10.&&islandWorld.x<35.&&paving>0.){
 vec3 grassColor=diffuseColor.rgb;float best=0.;
 for(int sampleIndex=0;sampleIndex<32;sampleIndex++){
 float a=float(sampleIndex)*2.39996323;float radius=.018+float(sampleIndex)*.0035;
 vec2 offset=vec2(cos(a),sin(a))*radius;vec3 candidate=texture2D(map,vMapUv+offset).rgb;
 float score=(candidate.g-max(candidate.r,candidate.b))*(1.-float(sampleIndex)*.015);
 if(score>best){best=score;grassColor=candidate;}
 }
 diffuseColor.rgb=mix(diffuseColor.rgb,grassColor,paving*smoothstep(.015,.045,best));
 }
 `);};mat.customProgramCacheKey=()=> 'main-island-native-grass3';return mat;});if(!Array.isArray(mats)||mats.length===1)mesh.material=mesh.material[0];}mesh.name=objects[0].name;mesh.castShadow=isPlatform||!/Cloud|cloud|Light|light|Waterfall|mote|Orbit spark/.test(mesh.name);mesh.receiveShadow=true;
  objects.forEach((o,i)=>{pos.fromArray(o.position);quat.fromArray(o.rotation);scale.fromArray(o.scale);matrix.compose(pos,quat,scale);mesh.setMatrixAt(i,matrix);
   const proxy=new THREE.Object3D();proxy.name=o.name;proxy.position.copy(pos);proxy.quaternion.copy(quat);proxy.scale.copy(scale);scene.add(proxy);editableRecords.push({key:o.name,name:o.name,group:o.group,object:proxy,geometry:geo,mesh,index:i});
   if(/• meadow(?:\.\d+)?$/.test(o.name)){const bed=addTerrainFoundation(scene,geo,matrix,o.name);if(bed)terrainBeds.push({...bed,sourceName:o.name});canvas.dataset.foundations=String(Number(canvas.dataset.foundations||0)+1);}
   if(/Jumping cloud bridge|Cloud crossing|Final ascent|Start stone staircase/.test(o.name)){const bb=geo.boundingBox.clone().applyMatrix4(matrix);surfaces.push({editorKey:o.name,x:(bb.min.x+bb.max.x)/2,z:(bb.min.z+bb.max.z)/2,h:bb.max.y-.12,rx:(bb.max.x-bb.min.x)*.47,rz:(bb.max.z-bb.min.z)*.47});}
  });mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();scene.add(mesh);if(objects.some(o=>/• meadow(?:\.\d+)?$/.test(o.name)))groundMeshes.push(mesh);modelCount+=objects.length;completed++;const progress=Math.round(completed/data.meshes.length*100);$('#percent').textContent=progress+'%';$('#loadBar').style.width=progress+'%';}}
 await Promise.all(Array.from({length:6},worker));hero=await createHero(scene,canvas);trees=await createRiggedAssets(scene,renderer);editableRecords.push({key:'03 • Great windmill',name:'03 • Great windmill',group:'02 • Architecture',object:trees.windmill,direct:true});editableRecords.push({key:'01 • Awakening stone gate',name:'01 • Awakening stone gate',group:'02 • Architecture',object:trees.arch,direct:true});canvas.dataset.archAsset='fantasy-stone-arch';canvas.dataset.lighting='shared-sky-ibl';canvas.dataset.referenceLayout='central-terraces-treehouse';canvas.dataset.treeAnimations=String(trees.treeAnimations);canvas.dataset.windmillAnimations=String(trees.windmillAnimations);canvas.dataset.leafTrees=String(trees.count);meadow=createMeadow(scene,data,groundMeshes,matchMedia('(pointer:coarse)').matches);canvas.dataset.grassTufts=String(meadow.count);
 treehouseRoom=await createTreehouseRoom({scene,renderer,canvas,player:p,controls,hero,outsideCamera:camera,surfaces,getMode:()=>mode});editableRecords.push({key:'04 • Editable treehouse',name:'04 • Editable treehouse',group:'02 • Architecture',object:treehouseRoom.object,direct:true});
 pond=createPond(scene,{groundMeshes:[...groundMeshes,...terrainBeds.map(b=>b.mesh),...editableRecords.filter(r=>/sculpted Tripo cliff|Central lower terrace cliff/.test(r.name)).map(r=>r.mesh)]});editableRecords.push({key:'镜湖水池',name:'镜湖水池',group:'02 • Architecture',object:pond.object,direct:true});meadow.setPond(pond);
 editor=createSceneEditor({scene,camera,canvas,controls,renderer,sun,records:editableRecords,beds:terrainBeds,trees:trees.objects,grass:meadow.objects,surfaces,onChanged:makeEditorCollisionSync(surfaces,editableRecords),onEnter:()=>{orbit();mode='edit';controls.enabled=true;keys.clear();$('#walkHelp').hidden=true;$('#crosshair').hidden=true;$('#mapPanel').hidden=true;$('#overview').disabled=true;$('#reset').disabled=true;},onExit:()=>{routeFixups();mode='orbit';$('#mapPanel').hidden=false;$('#overview').disabled=false;$('#reset').disabled=false;controls.enabled=true;respawn(p);updateUI();}});createGardenPaths(scene,editableRecords,[trees.windmill,treehouseRoom.object,pond.object],meadow.objects);refreshGround();setGroundProvider((x,z,maxY)=>{if(mode==='edit'||!groundTargets.length)return null;let h=groundHeights(x,z).find(y=>y<=maxY);const r=rampHeight(x,z);if(r!==null&&r<=maxY+.001&&(h===undefined||r>h))h=r;return h===undefined?null:h;});

respawn(p);$('#editScene').disabled=false;$('#editStart').disabled=false;$('#editStart').onclick=()=>editor.enter();sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;const interactionOptions={audio:gameAudio,scene,canvas,camera,hero,assets:trees,surfaces,getMode:()=>mode,lock:()=>{mode='memory';clearTimeout(toastTimer);$('#toast').classList.remove('visible');document.body.className='memory';for(const id of ['#editScene','#overview','#reset','#help'])$(id).disabled=true;keys.clear();joystick={x:0,z:0};drag=null;jumpQueued=false;$('#walkHelp').hidden=true;},unlock:()=>{mode='walk';document.body.className='walk';for(const id of ['#editScene','#overview','#reset','#help'])$(id).disabled=false;keys.clear();jumpQueued=false;$('#walkHelp').hidden=false;canvas.focus();hero?.resetCamera();},toast};windMechanism=createWindMechanism(interactionOptions);chapter=createChapter({...interactionOptions,records:editableRecords,wind:windMechanism,player:p});chapter.restore();routeFixups();sharedUI=createUISystem({chapter:1,position:()=>p.pos,project:at=>{const v=new THREE.Vector3(at.x,at.y+1,at.z).project(camera);return{x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2,visible:v.z>-1&&v.z<1}},canPause:()=>ready&&mode!=='intro'&&mode!=='edit',onPause:()=>{pausedAt=performance.now();keys.clear();joystick={x:0,z:0};drag=null;jumpQueued=false;},onResume:()=>{timeOffset+=performance.now()-pausedAt;hero?.resetCamera();},onRestart:()=>resetPlayer()});chapter.registerUI(sharedUI);{let station=null;scene.traverse(o=>{if(!station&&o.name==='风纹机关台')station=o});sharedUI.registerInteraction({id:'windmill',getPosition:()=>(station||trees.windmill).getWorldPosition(new THREE.Vector3()),complete:()=>windMechanism.memoryCollected,description:'靠近风车，按 E 触碰风纹',order:2,name:'风车的风纹机关台'});}sharedUI.registerInteraction({id:'swing',getPosition:()=>({x:7.5,y:4.15,z:-7}),complete:()=>mode==='memory',action:'坐秋千'});swing=createSwing({...interactionOptions,player:p,anchor:treehouseRoom.object});
 if(['127.0.0.1','localhost'].includes(location.hostname)){window.__dbg={get editor(){return editor},get misses(){return groundMisses},get cacheSize(){return groundCache.size},p,surfaces,zones,scene,camera,THREE,keys,get mode(){return mode},setMode(m){mode=m},groundHeights,refreshGround,walk,stairRamps,rampHeight};const test=new URLSearchParams(location.search).get('testStart'),i={gate:0,windmill:1,tree:2,tower:3}[test];if(i!==undefined){p.checkpoint=i;p.visited.add(i);respawn(p);}}
 ready=true;$('#loadText').textContent='云端已准备好';$('#start').disabled=false;$('#tour').disabled=false;
 $('#percent').textContent='100%';$('#loadBar').style.width='100%';canvas.dataset.models=String(modelCount);canvas.dataset.ready='true';canvas.dataset.atmosphere='spatial-upper-and-lower-clouds';
}
function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-lastTime)/1000,.04);lastTime=now;if(sharedUI?.paused)return;now-=timeOffset;if(treehouseRoom?.update()){keys.clear();jumpQueued=false;return;}
 frameCount++;if(now-frameStart>1000){canvas.dataset.fps=String(Math.round(frameCount*1000/(now-frameStart)));frameStart=now;frameCount=0;}
 if(mode==='walk'&&ready&&!resetting){const input={x:(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+joystick.x,z:(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)+joystick.z,sprint:keys.has('ShiftLeft')||keys.has('ShiftRight'),jump:jumpQueued};let result;if(introCam){input.x=input.z=0;input.jump=false;jumpQueued=false;}
  const n=Math.max(1,Math.ceil(dt/.012));for(let i=0;i<n;i++){result=stepPlayer(p,{...input,jump:input.jump&&i===0},dt/n,surfaces);if(result.entered>=0)toast(result.entered===3?'抵达风之塔 · 你已走过这片云海':`抵达${zones[result.entered].name} · 已记录落脚点`);if(result.fell){resetPlayer();break;}}jumpQueued=false;
  if(introCam)introShot(dt);else hero?.follow(camera,p,dt,surfaces);updateUI();
 }else if(mode!=='memory')controls.update();windMechanism?.update(dt,now/1000,p);chapter?.update(dt,now/1000);swing?.update(dt,now/1000);hero?.update(p,dt,mode,surfaces,resetting);gameAudio.update({...p.pos,grounded:p.grounded,vy:p.vy,gliding:p.gliding},dt,mode==='walk'&&!resetting,p.checkpoint===1||p.checkpoint===3?'stone':'grass');sharedUI?.update(dt,{active:mode==='walk',yaw:p.yaw,pitch:p.pitch,jumps:p.jumps,grounded:p.grounded});sharedUI?.syncCollection(Number((document.querySelector('#journalButton')?.textContent||'').match(/记忆 (\d+)/)?.[1]||0));canvas.dataset.position=JSON.stringify(p.pos);canvas.dataset.grounded=String(p.grounded);canvas.dataset.jumps=String(p.jumps);canvas.dataset.mode=mode;sky.position.copy(camera.position);drawMap();pond?.update(now/1000);meadow?.update(now/1000,p,mode==='walk',camera);trees?.update(now/1000);if(hero&&(mode==='walk'||mode==='memory')){sun.shadow.needsUpdate=true;}else if(trees&&Math.floor(now/100)!==lastAnimationShadow){sun.shadow.needsUpdate=true;lastAnimationShadow=Math.floor(now/100);}atmosphere.render(scene,camera,now/1000);
}
requestAnimationFrame(animate);load().catch(err=>{console.error(err);$('#loadText').textContent='加载未完成，请刷新重试';$('#percent').textContent='';$('#tour').disabled=false;$('#tour').textContent='刷新重试';$('#tour').onclick=()=>location.reload();});
