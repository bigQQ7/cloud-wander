import {createFountainFX} from './fountain.js?v=fx2';
import {createBGM} from '../shared/bgm.js?v=bgm3';createBGM('garden');
import {createUISystem} from '../../ui/system.js?v=prio1';
import {createGameAudio} from '../shared/game-audio.js';
import {createResonanceFX} from '../shared/resonance-fx.js';
import {createGame,normalizeSave,SAVE_KEY,missingExit} from './game-core.mjs?v=polish2';
import {lanePoint,LILIES,SLIDE,slideY,BOX_U,U_END,surfacesAt,LANE_ENTRY} from './lane-data.mjs?v=1793364298';
import {createHero} from './hero.js?v=prelanding5';

export function createGameplay({T,scene,world,camera,controls,renderer,westBridge,returnBridge,cloudBeam,stairStart,stairEnd,stairCount,cube,lane,lake}){
  let sharedUI;const gameAudio=createGameAudio();let audioHadKey=null;
  // ---------------- 关卡碰撞（自由视角部分）
  const islands=[{x:0,z:0,r:9,y:0,id:'hub'},{x:-22,z:-12,r:6,y:2,id:'courtyard'},{x:0,z:-22,r:4,y:4,id:'exit'}];
  const curves=[['west',westBridge,2.7],['return',returnBridge,2.8],['beam',cloudBeam,.8],['entry',lane.entryCurve,2.4]].map(([id,c,w])=>({id,w,samples:Array.from({length:121},(_,i)=>c.getPoint(i/120))}));
  function curveFloor(x,z,q){let best=null;for(let i=1;i<q.samples.length;i++){const a=q.samples[i-1],b=q.samples[i],dx=b.x-a.x,dz=b.z-a.z,t=T.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1),px=a.x+dx*t,pz=a.z+dz*t,d=Math.hypot(x-px,z-pz);if(d<q.w/2-.08&&(!best||d<best.d))best={y:a.y+(b.y-a.y)*t,id:q.id,d};}return best;}
  // Keep the story crate centered on the carpet before deriving collision bounds.
  const storyChest=world.children.find(o=>o.userData.assetId===37);
  if(storyChest){world.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(storyChest),center=bounds.getCenter(new T.Vector3());storyChest.position.x+=-22-center.x;storyChest.position.z+=-11-center.z;storyChest.position.y+=2.06-bounds.min.y;}
  const pads=[];world.updateMatrixWorld(true);
  for(const o of world.children){const id=o.userData.assetId;if(id===29&&o.position.x>=-18&&o.position.x<=-9&&o.position.z<=3&&o.position.z>=-5&&o.position.y>=-.05){const b=new T.Box3().setFromObject(o);pads.push({x:o.position.x,z:o.position.z,y:b.max.y-.07,r:1.12,id:'cloud-'+pads.length,obj:o,oy:o.position.y});}}
  // 拱桥入口：两棵造型树的碰撞范围连成了一堵墙，挪开让出通道（需在生成障碍物之前执行）
  for(const o of world.children){if(o.userData.assetId!==34)continue;const p=o.position;if(Math.hypot(p.x+7.5,p.z+4)<.4)p.z+=1.9;else if(Math.hypot(p.x+5.5,p.z+5.8)<.4)p.x+=.6;}world.updateMatrixWorld(true);
  const obstacleIds=new Set([17,15,22,39,23,33,28,37,32,34,35,36,30,10,18,42]);
  const obstacles=world.children.filter(o=>obstacleIds.has(o.userData.assetId)&&o.position.y<6).map(o=>{const b=new T.Box3().setFromObject(o);return {minX:b.min.x,maxX:b.max.x,minY:b.min.y,maxY:b.max.y,minZ:b.min.z,maxZ:b.max.z,id:o.userData.assetId};});
  /* 出口门前的通道（x≈0、z -19 ~ -23.5）留空：两侧玫瑰丛的包围盒伸进了通道，会把玩家挡在门外过不了关 */
  for(const o of obstacles)if(o.maxZ>-23.5&&o.minZ<-19&&o.minY>3&&o.minX<1&&o.maxX>-1){if((o.minX+o.maxX)/2<0)o.maxX=Math.min(o.maxX,-1);else o.minX=Math.max(o.minX,1);}
  const orbCenter=(()=>{const o=world.children.find(o=>o.userData.assetId===15);if(!o)return null;const c=new T.Box3().setFromObject(o).getCenter(new T.Vector3());return [c.x,c.z];})();
  const level={spots:{chest:[-22,-11],bone:[-22,-11],...(orbCenter?{orb:orbCenter}:{})},obstacles,pads,entryClear(x,z,y){const f=curveFloor(x,z,curves.find(q=>q.id==='entry'));return !!f&&Math.abs(y-f.y)<.5;},height(x,z,maxY=Infinity){const s=[];for(const d of islands)if(Math.hypot(x-d.x,z-d.z)<d.r-.08)s.push(d);for(const p of pads)if(!p.gone&&Math.hypot(x-p.x,z-p.z)<p.r)s.push({y:p.y+(p.dy||0),id:p.id});for(const q of curves){const p=curveFloor(x,z,q);if(p)s.push(p);}if(Math.abs(x)<1.32&&z<=stairStart&&z>=stairEnd){/* 连续斜坡，上台阶不磕绊 */const t=Math.min(1,Math.max(0,(stairStart-z)/(stairStart-stairEnd)));s.push({y:t*4,id:'stairs'});}return s.filter(p=>p.y<=maxY+.001).sort((a,b)=>b.y-a.y)[0]||null;}};

  // ---------------- 标记光圈
  const beacons=[];function beacon(x,y,z,r,color,parent=world){const o=new T.Mesh(new T.TorusGeometry(r,.035,6,48),new T.MeshBasicMaterial({color,transparent:true,opacity:.85}));o.rotation.x=-Math.PI/2;o.position.set(x,y+.035,z);parent.add(o);beacons.push(o);return o;}
  for(const p of pads)p.ring=beacon(p.x,p.y,p.z,p.r*.9,'#ffd1ec');
  const boneBeacon=beacon(-22,2.04,-11,1.2,'#ffda55');const chestBeacon=beacon(-22.75,2.04,-10.05,.7,'#ffda55');beacon(7,.05,.9,2.1,'#c5ffee');
  {const p=lanePoint(LANE_ENTRY.u);beacon(p.x,.06,p.z,1.2,'#bff3ff');}

  // ---------------- 玩家（真实 IP 角色，从 assets/hero.glb 加载）+ 云伞 + 滑道花瓣
  // hero 异步加载；加载完成前用一个空 Group 占位（游戏逻辑不受影响）
  const player=new T.Group();scene.add(player);player.visible=false;
  let hero=null,heroReady=false;
  const hairM=new T.MeshStandardMaterial({color:'#ffffff',roughness:.95,emissive:'#fff2f8',emissiveIntensity:.25});
  const umbrella=new T.Group();for(const [x,y,z,r] of [[0,0,0,.42],[-.38,-.06,0,.3],[.38,-.06,0,.3],[0,-.04,-.3,.3],[0,-.04,.3,.3]]){const c=new T.Mesh(new T.SphereGeometry(r,12,10),hairM);c.position.set(x,y,z);c.scale.y=.6;umbrella.add(c);}umbrella.position.y=1.85;umbrella.visible=false;player.add(umbrella);
  const petal=new T.Mesh(new T.SphereGeometry(.75,20,10),new T.MeshStandardMaterial({color:'#ff9fcb',roughness:.6}));petal.scale.set(1.1,.18,1.5);petal.position.y=.05;petal.visible=false;player.add(petal);
  createHero(T,scene).then(h=>{hero=h;heroReady=true;h.root.visible=false;}).catch(e=>console.warn('hero 加载失败，保留占位',e));

  // ---------------- 梦境出口门（开门时中间镂空）+ 光圈
  const gateUniform={value:0};const exitGate=world.children.find(o=>o.userData.assetId===7);
  exitGate?.traverse(o=>{if(!o.isMesh)return;o.material=o.material.clone();o.material.onBeforeCompile=shader=>{shader.uniforms.gateOpen=gateUniform;shader.vertexShader='varying vec3 vGateLocal;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGateLocal=position;');shader.fragmentShader='uniform float gateOpen; varying vec3 vGateLocal;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(gateOpen>.5 && abs(vGateLocal.z)<.21 && vGateLocal.y>.05 && vGateLocal.y<.79-abs(vGateLocal.z)*.6) discard;');};o.material.needsUpdate=true;});
  const portal=new T.Mesh(new T.TorusGeometry(1.15,.09,8,64),new T.MeshBasicMaterial({color:'#ffce57',transparent:true,opacity:.15}));portal.position.set(0,5.5,-22.3);world.add(portal);

  // ---------------- 左线道具：光罩、单向栅门、记忆星仪
  const glow=(c,o=.35)=>new T.MeshBasicMaterial({color:c,transparent:true,opacity:o,depthWrite:false,side:T.DoubleSide});
  const shield=new T.Mesh(new T.CylinderGeometry(1.05,1.05,1.7,48,1,true),glow('#ffe39a',.32));shield.position.set(-22,2.9,-11);world.add(shield);
  const shieldCap=new T.Mesh(new T.TorusGeometry(1.05,.04,6,64),glow('#fff1c4',.8));shieldCap.rotation.x=Math.PI/2;shieldCap.position.set(-22,3.75,-11);world.add(shieldCap);
  const gate=new T.Group();gate.position.set(-17,2.02,-11);const gm=new T.MeshStandardMaterial({color:'#f6ead0',metalness:.3,roughness:.4}),gg=new T.MeshStandardMaterial({color:'#d5aa42',metalness:.65,roughness:.35});
  for(let zz=-1.25;zz<=1.26;zz+=.25){const b=new T.Mesh(new T.CylinderGeometry(.035,.035,1.5,8),gm);b.position.set(0,.75,zz);gate.add(b);}
  for(const yy of [.12,1.5]){const r=new T.Mesh(new T.BoxGeometry(.09,.09,2.7),gg);r.position.y=yy;gate.add(r);}
  const arch=new T.Mesh(new T.TorusGeometry(.6,.05,8,32,Math.PI),gg);arch.rotation.y=Math.PI/2;arch.position.y=1.5;gate.add(arch);world.add(gate);
  const orb=world.children.find(o=>o.userData.assetId===15);const stars=[];
  if(orb){const b=new T.Box3().setFromObject(orb);for(const dx of [-.45,.45]){const st=new T.Mesh(new T.OctahedronGeometry(.2),new T.MeshStandardMaterial({color:'#8d87a8',emissive:'#000000',metalness:.4,roughness:.3}));st.position.set(orb.position.x+dx,b.max.y+.45,orb.position.z);world.add(st);stars.push(st);}beacon(orb.position.x,.05,orb.position.z,1.6,'#e7d2ff');}

  // ---------------- 只在倒影里出现的记忆（第 1 层只给湖面的反射相机看）
  if(lake)lake.camera.layers.enable(1);
  function figure(hair,s){const g=new T.Group();const skin=new T.MeshStandardMaterial({color:'#fff3e6',emissive:'#ffe9f4',emissiveIntensity:.5});const bd=new T.Mesh(new T.CapsuleGeometry(.2,.35,4,10),new T.MeshStandardMaterial({color:'#fff8fb',emissive:'#ffd6ec',emissiveIntensity:.35}));bd.position.y=.45;g.add(bd);const hd=new T.Mesh(new T.SphereGeometry(.2,16,12),skin);hd.position.y=.9;g.add(hd);const hm=new T.MeshStandardMaterial({color:hair,emissive:hair,emissiveIntensity:.45,roughness:.9});for(const [x,y,z,r] of [[0,1.05,0,.2],[-.16,1,-.04,.15],[.16,1,-.04,.15],[0,1.02,-.16,.17],[-.1,1.13,.08,.13],[.11,1.12,.07,.13]]){const h=new T.Mesh(new T.SphereGeometry(r,12,10),hm);h.position.set(x,y,z);g.add(h);}g.scale.setScalar(s);g.traverse(o=>o.layers.set(1));return g;}
  const ghosts=new T.Group();const partner=figure('#ff9fd0',1.25),me=figure('#ffffff',1.15);partner.position.set(-23.4,-.3,-3.2);me.position.set(-20.6,-.3,-3.2);partner.rotation.y=Math.PI/2;me.rotation.y=-Math.PI/2;
  const toy=new T.Mesh(new T.CapsuleGeometry(.07,.35,4,8),new T.MeshStandardMaterial({color:'#ffd35a',emissive:'#ffb300',emissiveIntensity:.6}));toy.rotation.z=Math.PI/2;toy.layers.set(1);ghosts.add(partner,me,toy);ghosts.visible=false;scene.add(ghosts);
  const slidePartner=figure('#ff9fd0',1.2);const slidePetal=new T.Mesh(new T.SphereGeometry(.7,16,8),new T.MeshStandardMaterial({color:'#ffb3d6'}));slidePetal.scale.set(1.1,.18,1.4);slidePetal.layers.set(1);slidePartner.add(slidePetal);slidePartner.visible=false;scene.add(slidePartner);

  // ---------------- 八音盒
  cube.position.copy(lane.boxPos);cube.rotation.set(0,0,0);
  const notes=[];const noteMat=new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.9});
  for(let i=0;i<10;i++){const n=new T.Mesh(new T.SphereGeometry(.07,8,6),noteMat.clone());n.visible=false;n.userData.t=Math.random()*3;scene.add(n);notes.push(n);}

  // ---------------- 水面涟漪圈（平台、睡莲、石柱、滑道柱子）
  lake?.setRings([[0,0,9.02],[-22,-12,3.98],[0,-22,2.66],...lane.rings]);

  // ---------------- UI
  const style=document.createElement('style');style.textContent=`#game-intro,#game-result{position:fixed;z-index:8;inset:0;background:#5a2b4ea6;display:grid;place-items:center;backdrop-filter:blur(5px)}.game-card{width:min(480px,84vw);padding:30px;background:#fff6fa;color:#5a2b4e;border:1px solid #f1b6d3;border-radius:24px;box-shadow:0 20px 80px #7d2c5f50}.game-card h2{font-family:serif;font-size:30px;margin:0 0 14px}.game-card p{line-height:1.7;margin:10px 0}.game-card button{margin-top:14px}#mission{display:none;position:absolute;z-index:3;left:18px;top:18px;width:240px;background:#6b2f5ad0;border:1px solid #fff5;padding:15px;border-radius:16px;font-size:13px;line-height:1.8;color:#fff}#mission strong{color:#ffe1ef}#game-hint{display:none;position:absolute;z-index:3;bottom:28px;left:50%;transform:translateX(-50%);text-align:center;background:#6b2f5ad8;border:1px solid #fff5;border-radius:18px;padding:12px 20px;min-width:340px;font-size:14px;color:#fff}#game-message{color:#ffe0ef;margin-bottom:5px;font-size:15px}#game-actions{position:absolute;top:16px;right:16px;z-index:5;display:flex;flex-wrap:wrap;max-width:450px;justify-content:flex-end}body.playing header,body.playing footer,body.playing #detail{display:none}body.playing #mission,body.playing #game-hint{display:block}#touch-controls{display:none;position:absolute;z-index:4;bottom:100px;right:15px;max-width:180px}#touch-controls button{touch-action:none;min-width:45px}body.playing #touch-controls{display:block}#game-test-output{display:none;position:fixed;inset:8%;overflow:auto;z-index:12;background:#fff6fa;color:#5a2b4e;border-radius:20px;padding:24px;white-space:pre-wrap}@media(max-width:650px){#mission{width:165px;font-size:11px}#game-hint{min-width:230px;font-size:12px}#game-actions{top:auto;bottom:10px;right:10px}#touch-controls{bottom:120px}}`;
  document.head.append(style);const ui=document.createElement('div');
  ui.innerHTML=`<div id="game-intro"><div class="game-card"><small>第二章 · 花间奇遇</small><h2>镜湖花园</h2><p>左边是伙伴的房间：踩着会下沉的粉云过去，用 Q 共鸣找回金骨头。右边是两人最爱的湖岸睡莲路和流水滑梯（横版视角）。两边都完成后，用金骨头打开梦境出口。</p><p><b>WASD</b>移动 · <b>Shift</b>奔跑 · <b>空格</b>跳跃，空中长按滑翔<br><b>E</b>交互 · <b>Q</b>云之共鸣 · <b>R</b>回检查点 · <b>Esc</b>暂停<br><b>鼠标</b>转动视角（点一下画面锁定鼠标，Esc 释放；也可按住右键拖动）</p><button id="game-start">开始 / 继续冒险</button><button id="game-inspect">查看场景</button></div></div><aside id="mission"></aside><div id="game-actions"><button id="game-play-toggle">进入冒险</button><button id="game-pause">暂停 / 继续</button><button id="game-reset">重新开始</button><button id="game-selftest">任务自测</button></div><div id="game-hint"><div id="game-message"></div><div id="game-context"></div></div><div id="touch-controls"><div><button data-move="0,-1">↑</button></div><button data-move="-1,0">←</button><button data-move="0,1">↓</button><button data-move="1,0">→</button><button id="touch-jump">跳跃</button><button id="touch-use">交互</button><button id="touch-res">共鸣</button></div><div id="game-result" style="display:none"><div class="game-card"><small>记忆碎片 ② · 快乐陪伴</small><h2>梦境之门已开启</h2><p id="win-stats"></p><button id="game-again">重新冒险</button><button id="game-after-inspect">欣赏场景</button></div></div><pre id="game-test-output"></pre><pre id="game-state" hidden></pre>`;
  document.body.append(ui);

  let stored=null,storageOK=true;try{stored=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');}catch{storageOK=false;}
  const interactionTest=['127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(location.search).get('testStart')==='chest';if(interactionTest)stored={version:2,checkpoint:'courtyard'};
  let engine=createGame(level,stored),playing=false,paused=false,lastTime=performance.now(),saveTimer=0,lastSave='',queuedJump=false,queuedUse=false,queuedRespawn=false,queuedRes=false,touch={x:0,z:0},touchJump=false;
  let lastRes=0,ghostT=-1,wasResonated=null,clock=0;const keys=new Set();if(interactionTest)engine.respawn();engine.pause(true);
  const $=s=>document.querySelector(s);
  const camLook=new T.Vector3(0,.6,1);
  // 背后跟随镜头（参考第一章）：鼠标转视角，点击画面锁定鼠标，Esc 释放；也可按住右键拖动
  let camYaw=0,camPitch=.28,lastMouse=-1e4,mouseDrag=false,prevInLane=false,faceYaw=Math.PI;const canvas=renderer.domElement;
  canvas.addEventListener('click',()=>{if(playing&&!paused&&document.pointerLockElement!==canvas)canvas.requestPointerLock?.();});
  addEventListener('mousemove',e=>{if(!playing)return;if(document.pointerLockElement!==canvas&&!mouseDrag)return;camYaw-=e.movementX*.0032*(sharedUI?.settings.sensitivity||1);camPitch=T.MathUtils.clamp(camPitch+e.movementY*.0024*(sharedUI?.settings.sensitivity||1),.02,.9);lastMouse=performance.now();});
  canvas.addEventListener('pointerdown',e=>{if(playing&&e.button===2)mouseDrag=true;});addEventListener('pointerup',()=>mouseDrag=false);canvas.addEventListener('contextmenu',e=>{if(playing)e.preventDefault();});
  const setFov=f=>{camera.fov=f;camera.updateProjectionMatrix();};
  let introCam=null,introDone=false;
  function enter(){if(!introDone&&!interactionTest){introDone=true;introCam={t:0};}playing=true;paused=false;engine.pause(false);controls.enabled=false;player.visible=true;if(heroReady)hero.show();document.body.classList.add('playing');$('#game-intro').style.display='none';$('#game-result').style.display='none';$('#game-play-toggle').textContent='返回场景查看';lastTime=performance.now();const s=engine.snapshot();camLook.set(s.actor.x,s.actor.y+1,s.actor.z);setFov(55);if(!s.inLane){camYaw=faceYaw+Math.PI;camera.position.set(s.actor.x+Math.sin(camYaw)*4.4,s.actor.y+2.1,s.actor.z+Math.cos(camYaw)*4.4);}}
  function inspect(){resonanceDelay=0;document.exitPointerLock?.();setFov(38);playing=false;engine.pause(true);controls.enabled=true;player.visible=false;if(heroReady)hero.hide();document.body.classList.remove('playing');$('#game-intro').style.display='none';$('#game-result').style.display='none';$('#game-play-toggle').textContent='进入冒险';camera.position.set(0,43,65);controls.target.set(0,0,-4);controls.update();}
  function reset(){resonanceDelay=0;engine=createGame(level,null);lastSave='';try{localStorage.removeItem(SAVE_KEY);}catch{}keys.clear();queuedJump=queuedUse=queuedRespawn=queuedRes=false;$('#game-result').style.display='none';enter();}
  $('#game-start').onclick=enter;$('#game-inspect').onclick=inspect;$('#game-play-toggle').onclick=()=>playing?inspect():enter();$('#game-reset').onclick=reset;$('#game-again').onclick=reset;$('#game-after-inspect').onclick=inspect;$('#game-pause').onclick=()=>{if(!playing)return;paused=!paused;engine.pause(paused);if(paused)document.exitPointerLock?.();};
  addEventListener('keydown',e=>{if(!playing||/INPUT|TEXTAREA/.test(e.target.tagName))return;const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(!e.repeat){if(k===' ')queuedJump=true;if(k==='e')queuedUse=true;if(k==='q')queuedRes=true;if(k==='r')queuedRespawn=true;if(k==='escape')$('#game-pause').click();}keys.add(k);});
  addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  addEventListener('blur',()=>{keys.clear();touch={x:0,z:0};touchJump=false;if(playing){paused=true;engine.pause(true);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();if(playing){paused=true;engine.pause(true);}}});
  for(const b of document.querySelectorAll('[data-move]')){const stop=()=>touch={x:0,z:0};b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);const [x,z]=b.dataset.move.split(',').map(Number);touch={x,z};});b.addEventListener('pointerup',stop);b.addEventListener('pointercancel',stop);}
  {const j=$('#touch-jump');j.addEventListener('pointerdown',e=>{e.preventDefault();queuedJump=true;touchJump=true;});j.addEventListener('pointerup',()=>touchJump=false);j.addEventListener('pointercancel',()=>touchJump=false);}
  $('#touch-use').onclick=()=>queuedUse=true;$('#touch-res').onclick=()=>queuedRes=true;
  addEventListener('pagehide',()=>{if(window.__cloudRestart)return;try{localStorage.setItem(SAVE_KEY,JSON.stringify(engine.snapshot().state));}catch{}});
  const bone=world.children.find(o=>o.userData.assetId===9);
  const chest=world.children.find(o=>o.userData.assetId===37);
  sharedUI=createUISystem({chapter:2,position:()=>engine.snapshot().actor,project:at=>{const v=new T.Vector3(at.x,at.y+1,at.z).project(camera);return{x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2,visible:v.z>-1&&v.z<1}},canPause:()=>playing,onPause:()=>{paused=true;engine.pause(true);keys.clear();touch={x:0,z:0};},onResume:()=>{paused=false;engine.pause(false);lastTime=performance.now();},onRestart:()=>engine.respawn()});
  sharedUI.registerInteraction({id:'bone',getPosition:()=>({x:-22,y:2,z:-11}),complete:()=>engine.snapshot().state.key,description:'按 Q 共鸣震开木箱，按 E 拾取骨头',order:3,name:'伙伴房间里的木箱',key:'Q / E',action:'共鸣 · 拾取'});
  sharedUI.registerInteraction({id:'lake',getPosition:()=>({x:LANE_ENTRY.x,y:0,z:LANE_ENTRY.z}),complete:()=>engine.snapshot().state.slideDone,description:'走上湖岸睡莲路，去打开八音盒',order:2,name:'湖岸睡莲路入口',key:null});
  if(orbCenter)sharedUI.registerInteraction({id:'orb',getPosition:()=>({x:orbCenter[0],y:1.2,z:orbCenter[1]}),complete:()=>false,description:'按 E 转动记忆星仪，查看任务',action:'查看任务'});
  for(const [id,at,field,description,order,name] of [['fountain',{x:7,y:0,z:.9},'fountainOn','按 E 唤醒许愿泉',1,'中央花园的许愿泉'],['gate',{x:-17,y:2,z:-11},'gateOpen','按 E 打开栅门',null,'栅门'],['exit',{x:0,y:4,z:-22},'won','收集骨头并完成滑道后，按 E 打开出口',4,'梦境出口']])sharedUI.registerInteraction({id,getPosition:()=>at,complete:()=>field==='won'?engine.snapshot().mode==='won':engine.snapshot().state[field],description,order,name});
  $('#game-pause').onclick=()=>sharedUI.paused?sharedUI.close():sharedUI.open();
  const boneScale=bone?.scale.clone();
  const boneEnd=bone?.position.clone(),chestCenter=chest?new T.Box3().setFromObject(chest).getCenter(new T.Vector3()):new T.Vector3(-23.4,2.6,-9.1);
  let burstTime=99,opened=engine.snapshot().state.resonated;
  const shards=[];const shardGeo=new T.BoxGeometry(.16,.055,.11),shardMat=new T.MeshStandardMaterial({color:'#a87845',roughness:.9});
  for(let i=0;i<64;i++){const m=new T.Mesh(shardGeo,shardMat);m.scale.set(.65+(i%5)*.18,.7+(i%3)*.22,.65+(i%7)*.1);m.visible=false;world.add(m);shards.push(m);}
  if(bone)bone.visible=opened&&!engine.snapshot().state.key;

  if(['127.0.0.1','localhost'].includes(location.hostname))window.__ch2={engine,world,keys,level};
  // ---------------- 许愿泉喷水（唤醒后开始喷）
  {const fx=createFountainFX({T,scene,fountain:world.children.find(q=>q.userData.assetId===17)});let last=performance.now();
   (function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;try{fx.update(dt,!!engine.snapshot().state.fountainOn);}catch(e){}requestAnimationFrame(loop);})(last);}
  // ---------------- 梦境出口：金骨头放进凹槽时，门泛起金光、光柱升起、光环扩散、金色光点飞散，之后保持常亮微光
  {const door=world.children.find(o=>o.userData.assetId===7);
   if(door){const box=new T.Box3().setFromObject(door),c=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());const gold=new T.Color('#ffd27a');
    const mats=[];door.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();for(const m of [].concat(o.material))if(m.emissive){m.userData.e0=m.emissive.clone();m.userData.i0=m.emissiveIntensity??1;mats.push(m);}}});
    const light=new T.PointLight('#ffcf7a',0,14,1.6);light.position.set(c.x,box.min.y+size.y*.45,c.z+1.2);scene.add(light);
    const beamMat=new T.MeshBasicMaterial({color:'#fff1c2',transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide});
    const beam=new T.Mesh(new T.CylinderGeometry(size.x*.32,size.x*.42,size.y*1.6,32,1,true),beamMat);beam.position.set(c.x,box.min.y+size.y*.8,c.z+.4);scene.add(beam);
    const ringMat=new T.MeshBasicMaterial({color:'#ffd98a',transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending});
    const ring=new T.Mesh(new T.RingGeometry(.9,1.05,64),ringMat);ring.rotation.x=-Math.PI/2;ring.position.set(c.x,box.min.y+.06,c.z+1.4);scene.add(ring);
    const N=160,pos=new Float32Array(N*3),vel=[];for(let i=0;i<N;i++){vel.push(new T.Vector3((Math.random()-.5)*2.6,1.5+Math.random()*3.5,(Math.random()-.2)*2.2));}
    const pg=new T.BufferGeometry();pg.setAttribute('position',new T.BufferAttribute(pos,3));const pts=new T.Points(pg,new T.PointsMaterial({color:'#ffe39a',size:.14,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending}));scene.add(pts);
    let t=-1,was=engine.snapshot().doorOpen,last=performance.now();
    if(was)t=99;
    (function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;const open=engine.snapshot().doorOpen;if(open&&!was){t=0;gameAudio.event?.('resonance');}was=open;
     if(t>=0){t+=dt;const rise=Math.min(1,t/1.2),flash=t<2.4?Math.sin(Math.min(1,t/2.4)*Math.PI):0,glow=.35+.65*flash;
      for(const m of mats){m.emissive.copy(m.userData.e0).lerp(gold,rise);m.emissiveIntensity=m.userData.i0+glow*1.4*rise;}
      light.intensity=(2+flash*14)*rise;beamMat.opacity=t<3.5?.55*flash:0;beam.scale.y=.3+.7*rise;
      const rt=Math.min(1,t/1.6);ring.scale.setScalar(1+rt*5);ringMat.opacity=t<1.6?(1-rt)*.9:0;
      const pa=pg.attributes.position;if(t<2.6){for(let i=0;i<N;i++){const v=vel[i],tt=Math.max(0,t-(i%20)*.02);pa.setXYZ(i,c.x+v.x*tt,box.min.y+.4+v.y*tt-1.2*tt*tt,c.z+.6+v.z*tt);}pa.needsUpdate=true;}pts.material.opacity=t<2.6?.95*(1-t/2.6):0;}
     requestAnimationFrame(loop);})(last);}}
  // ---------------- 记忆星仪：按 E 查看任务清单，星仪绕中轴旋转
  {const orb=world.children.find(o=>o.userData.assetId===15);
   const style=document.createElement('style');style.textContent=`#orbTasks{position:fixed;inset:0;display:grid;place-items:center;z-index:60;background:rgba(60,30,70,.28);backdrop-filter:blur(2px);opacity:0;transition:opacity .35s;pointer-events:none}#orbTasks.open{opacity:1;pointer-events:auto}#orbTasks .card{width:min(420px,88vw);padding:26px 28px 20px;border-radius:22px;background:linear-gradient(160deg,#fff8fc,#f6ecff);box-shadow:0 18px 50px rgba(110,60,130,.28);color:#5b3d67;font-family:inherit;transform:translateY(12px);transition:transform .35s}#orbTasks.open .card{transform:none}#orbTasks h2{margin:0 0 4px;font-size:20px;letter-spacing:.08em}#orbTasks p.sub{margin:0 0 16px;font-size:13px;opacity:.7}#orbTasks ol{list-style:none;margin:0;padding:0;display:grid;gap:9px}#orbTasks li{display:flex;gap:10px;align-items:center;font-size:15px;padding:8px 12px;border-radius:12px;background:rgba(255,255,255,.7)}#orbTasks li .dot{flex:0 0 22px;height:22px;border-radius:50%;border:2px solid #d8a6d8;display:grid;place-items:center;font-size:13px;color:#fff}#orbTasks li.done{opacity:.6}#orbTasks li.done .dot{background:#c98bd6;border-color:#c98bd6}#orbTasks li.done span.t{text-decoration:line-through}#orbTasks li.next{outline:2px solid #e9a7d9;background:#fff}#orbTasks .close{margin-top:16px;width:100%;padding:10px;border:0;border-radius:12px;background:#c98bd6;color:#fff;font-size:15px;cursor:pointer}`;document.head.appendChild(style);
   const el=document.createElement('div');el.id='orbTasks';el.innerHTML='<div class="card" role="dialog" aria-modal="true" aria-labelledby="orbTasksTitle"><h2 id="orbTasksTitle">记忆星仪 · 任务</h2><p class="sub">星仪转动着，映出这座花园里要做的事</p><ol></ol><button class="close" type="button">继续探索（E）</button></div>';document.body.appendChild(el);
   const tasks=[['唤醒中央花园的许愿泉',s=>s.state.fountainOn],['走过湖岸睡莲路，打开八音盒',s=>s.state.musicBoxOpen],['顺着流水滑道滑回中央花园',s=>s.state.slideDone],['去伙伴的房间，用共鸣（Q）震开木箱',s=>s.state.resonated],['拾起金骨头',s=>s.state.key],['带着金骨头打开梦境出口',s=>s.mode==='won']];
   let open=false,spin=0,lastViews=engine.snapshot().orbViews||0,last=performance.now();const pivot=new T.Vector3(),tmp=new T.Vector3(),Y=new T.Vector3(0,1,0);
   if(orb){orb.updateMatrixWorld(true);new T.Box3().setFromObject(orb).getCenter(pivot);orb.parent.worldToLocal(pivot);}
   function fill(){const s=engine.snapshot();let next=false;el.querySelector('ol').innerHTML='';for(const [label,done] of tasks){const ok=done(s),li=document.createElement('li');if(ok)li.className='done';else if(!next){li.className='next';next=true;}const dot=document.createElement('span');dot.className='dot';dot.textContent=ok?'✓':'';const t=document.createElement('span');t.className='t';t.textContent=label;li.append(dot,t);el.querySelector('ol').appendChild(li);}}
   // 一次只看一条：顶部横幅显示当前要做的任务，星仪转动约 3.5 秒
   let spinTimer=0;function show(){const s=engine.snapshot();const cur=tasks.find(([,done])=>!done(s));window.CloudGuide?.showBanner(cur?'当前任务 · '+cur[0]:'所有任务都完成了','✦');open=true;clearTimeout(spinTimer);spinTimer=setTimeout(()=>{open=false;},3500);}
   function hide(){if(!open)return;open=false;el.classList.remove('open');engine.pause(false);keys.clear();lastTime=performance.now();}
   el.querySelector('.close').onclick=hide;
   document.addEventListener('keydown',e=>{if(!el.classList.contains('open'))return;if(['KeyE','Escape','Enter','Space'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)hide();}else e.stopImmediatePropagation();},true);
   (function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;const v=engine.snapshot().orbViews||0;if(v!==lastViews){lastViews=v;show();}
    const target=open?2.4:0;spin+=(target-spin)*(1-Math.exp(-dt*(open?2.2:1.1)));
    if(orb&&spin>.002){const a=spin*dt;tmp.copy(orb.position).sub(pivot).applyAxisAngle(Y,a);orb.position.copy(pivot).add(tmp);orb.rotateOnWorldAxis(Y,a);}
    requestAnimationFrame(loop);})(last);}


  // ---------------- 每帧的场景表现
  const resonanceFX=createResonanceFX(T,scene);let resonanceDelay=0;function ripple(x,y,z){resonanceFX.emit(x,y,z);}
  let lastPos=new T.Vector3(),lastSubtitle='';
  {const st=document.createElement('style');st.textContent='#game-message{display:none!important}';document.head.append(st);}
  function extras(s,dt){
    if(playing&&s.message&&s.message!==lastSubtitle){lastSubtitle=s.message;if(introCam)introCam.pending=s.message;else window.CloudGuide?.say(s.message);}else if(!s.message)lastSubtitle='';sharedUI?.update(dt,{active:playing&&!paused&&s.mode==='play'&&!introCam});sharedUI?.syncCollection(s.state.key?1:0,boneEnd);
    clock+=dt;gameAudio.update(s.actor,dt,playing&&!paused&&s.mode!=='won',s.zone==='courtyard'?'carpet':s.zone==='bridge'?'wood':'stone');audioHadKey=s.state.key;
    for(const p of pads){
      if(!p.particles){
        p.obj.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();}});
        const geo=new T.BufferGeometry(),positions=new Float32Array(180);
        p.seeds=Array.from({length:60},()=>({x:(Math.random()-.5)*2,z:(Math.random()-.5)*2,y:Math.random()}));
        geo.setAttribute('position',new T.BufferAttribute(positions,3));
        p.particles=new T.Points(geo,new T.PointsMaterial({color:'#ffd0f5',size:.16,transparent:true,depthWrite:false}));scene.add(p.particles);
      }
      const f=0;p.obj.visible=true;
      if(!p.baseScale)p.baseScale=p.obj.scale.clone();
      {const t=p.sqT??9,k=t<1.2?Math.exp(-t*4.5)*Math.cos(t*15):0;p.obj.scale.set(p.baseScale.x*(1+k*.12),p.baseScale.y*(1-k*.28),p.baseScale.z*(1+k*.12));}
      p.obj.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){m.transparent=true;m.opacity=1-f;}});
      p.ring.visible=!p.gone;
      p.particles.visible=f>0&&f<1;
      p.particles.material.opacity=1-f;
      const a=p.particles.geometry.attributes.position;
      p.seeds.forEach((v,i)=>a.setXYZ(i,p.x+v.x*(1+f*2),p.y+v.y*f*2,p.z+v.z*(1+f*2)));a.needsUpdate=true;
    }
    shield.visible=shieldCap.visible=false;
    if(!s.state.resonated){opened=false;burstTime=99;}
    if(s.state.resonated&&!opened){opened=true;burstTime=0;gameAudio.event('burst');gameAudio.event('grow');}
    burstTime+=dt;
    if(chest)chest.visible=!s.state.resonated;
    for(const o of obstacles)if(o.id===37)o.minY=s.state.resonated?10000:2;
    shards.forEach((m,i)=>{const t=burstTime,a=i*2.399;m.visible=s.state.resonated&&t<1.6;if(m.visible){m.position.copy(chestCenter).add(new T.Vector3(Math.cos(a)*t*(1.1+(i%7)*.2),(1.5+(i%5)*.32)*t-3*t*t,Math.sin(a)*t*(1.1+(i%7)*.2)));m.rotation.set(t*(i+1),t*3,t*2);}});
    if(bone){bone.visible=s.state.resonated&&!s.state.key;if(boneEnd){const t=Math.min(1,burstTime/.85);bone.position.lerpVectors(chestCenter,boneEnd,t);bone.position.y+=Math.sin(t*Math.PI)*1.5;const grow=t*t*(3-2*t);bone.scale.copy(boneScale).multiplyScalar(.12+.88*grow);}}
    chestBeacon.visible=false;boneBeacon.visible=false;
    gate.scale.y+=((s.state.gateOpen?.02:1)-gate.scale.y)*Math.min(1,dt*3);gate.visible=gate.scale.y>.05;
    stars.forEach((st,i)=>{const lit=i===0?s.state.key:s.state.slideDone;st.material.color.set(lit?'#ffd75e':'#8d87a8');st.material.emissive.set(lit?'#ffb21e':'#000000');st.material.emissiveIntensity=lit?.9+.3*Math.sin(clock*3):0;st.rotation.y+=dt*(lit?2:.4);});
    if(s.resonances>lastRes){lastRes=s.resonances;gameAudio.event('resonance');ripple(s.actor.x,s.actor.y,s.actor.z);}
    resonanceFX.update(dt);
    if(wasResonated===false&&s.state.resonated&&!s.state.key)ghostT=0;wasResonated=s.state.resonated;
    if(ghostT>=0){ghostT+=dt;ghosts.visible=ghostT<8;const ph=(ghostT%1.6)/1.6,dir=Math.floor(ghostT/1.6)%2;const a=dir?partner.position:me.position,b=dir?me.position:partner.position;toy.position.set(a.x+(b.x-a.x)*ph,1.1+Math.sin(ph*Math.PI)*1.3,a.z);partner.position.y=me.position.y=-.3+Math.abs(Math.sin(ghostT*4))*.08;if(ghostT>=8)ghostT=-1;}
    // 睡莲：开合 + 倒影睡莲显形
    lane.lilies.forEach((L,i)=>{
      if(!L.group)return;
      if(L.kind==='open'){const o=s.lilyOpen[i];L.flower.scale.setScalar(L.k0*(.22+.78*o));L.flower.position.y=L.baseY-(1-o)*.12;L.pad.scale.setScalar(.55+.45*o);}
      if(L.kind==='ghost'&&L.shown!==s.ghostOn){L.shown=s.ghostOn;L.group.traverse(m=>s.ghostOn?m.layers.enable(0):m.layers.disable(0));}
      if(L.kind==='ghost'&&L.glow)L.glow.material.opacity=.55+.35*Math.sin(clock*4);
    });
    // 八音盒与滑道水流
    const open=s.state.musicBoxOpen;lane.flow.value+=((open?1:0)-lane.flow.value)*Math.min(1,dt*1.2);lane.time.value=clock;
    cube.rotation.y+=dt*(open?1.6:.3);cube.position.y=lane.boxPos.y+(open?Math.sin(clock*2)*.08:0);
    notes.forEach((n,i)=>{n.visible=open;if(!open)return;n.userData.t+=dt;const t=n.userData.t%3;n.position.set(lane.boxPos.x+Math.sin(i*2.1+t)*.6,lane.boxPos.y+.3+t*.9,lane.boxPos.z+Math.cos(i*1.7+t)*.6);n.material.opacity=Math.max(0,.9-t*.3);});
    // 滑道上倒影里的伙伴
    if(s.mode==='slide'&&s.slide.u>99&&s.slide.u<119){const u=s.slide.u-.9,p=lanePoint(u);slidePartner.visible=true;slidePartner.position.set(p.x-p.nx*1.0,slideY(u)+.25,p.z-p.nz*1.0);slidePartner.rotation.y=Math.atan2(p.tx,p.tz);}else slidePartner.visible=false;
    // 角色姿态
    umbrella.visible=!!s.actor.gliding;petal.visible=false;
    // 水纹
    if(lake){const U=lake.material.uniforms;U.time.value=clock;U.player.value.set(s.actor.x,playing?s.actor.y:50,s.actor.z);const mv=lastPos.distanceTo(player.position)/Math.max(dt,1e-3);U.playerMove.value+=((mv>.5?1:0)-U.playerMove.value)*Math.min(1,dt*4);lastPos.copy(player.position);}
  }

  function renderHUD(s){
    const names={hub:'01 中央花园',cloud:'02 云阶窄桥',courtyard:'03 骨头庭院',lily:'04 湖岸睡莲路',box:'05 八音盒平台',slide:'05 流水滑道',landing:'05 回到中央',bridge:'小桥',exit:'06 梦境出口',fall:'落水中'};
    const ck={hub:'许愿泉',courtyard:'骨头庭院',lane:'横版段',laneEnd:'小桥'}[s.state.checkpoint];
    const t=(b,txt)=>`${b?'✓':'○'} ${txt}<br>`;
    $('#mission').innerHTML=`<strong>${names[s.zone]||'镜湖花园'}</strong><br>记忆星仪 ${s.state.key?'★':'☆'}${s.state.slideDone?'★':'☆'}<br><small style="opacity:.75">左线 · 伙伴的房间</small><br>${t(s.state.resonated,'倒影共鸣（Q）')}${t(s.state.key,'金骨头')}${t(s.state.gateOpen,'打开栅门')}<small style="opacity:.75">右线 · 湖岸睡莲路</small><br>${t(s.state.musicBoxOpen,'记忆八音盒')}${t(s.state.slideDone,'流水滑道')}${t(s.mode==='won','梦境出口')}<small>检查点：${ck}${storageOK?' · 自动保存':''}</small>`;
    $('#game-message').textContent=paused?'已暂停，按 Esc 或点“暂停 / 继续”恢复':s.message;$('#game-context').textContent=s.hint;{/* 关键操作提示：长按空格滑翔、Q 让睡莲显形各只在第一次遇到时提示一次；八音盒、木箱靠近时提示交互 */const h=s.hint||'',once=window.__ctxOnce||(window.__ctxOnce={});let show=null,dur=0;
if(/^前面距离太远/.test(h)){if(!once.glide){once.glide=1;show=h;dur=5500;}}
else if(/^前面的睡莲只在倒影里/.test(h)){if(!once.lily){once.lily=1;show=h;dur=6500;}}
else if(/^E 打开记忆八音盒|^走到蓝色的记忆八音盒前|^金骨头藏在木箱里|^E 拾取金骨头/.test(h)){show=h;dur=0;}
if(h!==window.__ctxHint){window.__ctxHint=h;if(show){window.CloudGuide?.showHint(show,{duration:dur});window.__ctxPersist=!dur;}else if(window.__ctxPersist){window.CloudGuide?.hideHint();window.__ctxPersist=false;}}}$('#game-state').textContent=JSON.stringify(s);
  }

  function update(){
    const now=performance.now(),dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
    if(playing&&!paused){
      const ix=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+touch.x,iz=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+touch.z;
      const pre=engine.snapshot();let x=ix,z=iz;
      if(!pre.inLane){const fx=-Math.sin(camYaw),fz=-Math.cos(camYaw),rx=Math.cos(camYaw),rz=-Math.sin(camYaw);x=fx*(-iz)+rx*ix;z=fz*(-iz)+rz*ix;
        if(iz<0&&performance.now()-lastMouse>1500){const want=Math.atan2(-x,-z);let d=want-camYaw;d=Math.atan2(Math.sin(d),Math.cos(d));camYaw+=d*Math.min(1,dt*1.1);}}
      const wasCasting=resonanceDelay>0;if(queuedRes&&!wasCasting)resonanceDelay=2.7;resonanceDelay=Math.max(0,resonanceDelay-dt);const releaseResonance=wasCasting&&resonanceDelay===0;
      if(introCam){x=0;z=0;queuedJump=queuedUse=queuedRespawn=false;}const input={x,z,jump:queuedJump,jumpHeld:keys.has(' ')||touchJump,interact:queuedUse,respawn:queuedRespawn,resonate:releaseResonance,sprint:keys.has('shift')};queuedJump=queuedUse=queuedRespawn=queuedRes=false;
      const n=Math.max(1,Math.ceil(dt/(1/90)));for(let i=0;i<n;i++)engine.tick(dt/n,{...input,jump:i===0&&input.jump,interact:i===0&&input.interact,respawn:i===0&&input.respawn,resonate:i===0&&input.resonate});
      const s0=engine.snapshot();
      let facing;
      if(s0.inLane){const p=lanePoint(s0.mode==='slide'?s0.slide.u:s0.lane.u);facing=Math.atan2(p.tx*s0.actor.dir,p.tz*s0.actor.dir);player.rotation.y=facing;}
      else if(x||z){const want=Math.atan2(x,z);let d=want-faceYaw;d=Math.atan2(Math.sin(d),Math.cos(d));faceYaw+=d*Math.min(1,dt*12);player.rotation.y=faceYaw;facing=faceYaw;}
    }
    const s=engine.snapshot();extras(s,dt);
    player.position.set(s.actor.x,s.actor.y+.015,s.actor.z);
    // 真实角色每帧更新（加载完成后才驱动）
    if(heroReady&&playing){
      const s0=engine.snapshot();
      const speed=player.position.distanceTo(player.userData._prev||player.position)/Math.max(dt,1e-4);
      player.userData._prev=player.position.clone();
      const p=lanePoint(s0.inLane?(s0.mode==='slide'?s0.slide.u:s0.lane.u):0);
      const facing2=s0.inLane?Math.atan2(p.tx*s0.actor.dir,p.tz*s0.actor.dir):player.rotation.y;
      hero.update({x:s0.actor.x,y:s0.actor.y,z:s0.actor.z},dt,{
        landingETA:s0.landingETA,grounded:s0.actor.grounded,jumps:s0.actor.jumps||0,vy:s0.mode==='slide'?s0.slide.jvy:(s0.actor.vy||0),
        gliding:!!s0.actor.gliding,speed,mode:s0.mode,inLane:s0.inLane,facing:facing2});
    } else if(heroReady&&!playing) hero.hide();
    portal.material.opacity=s.doorOpen?.95:.15;gateUniform.value=s.doorOpen?1:0;
    if(playing){
      let desired,look;
      if(s.inLane){const p=lanePoint(s.mode==='slide'?s.slide.u:s.lane.u);const ahead=s.actor.dir*1.8;desired=new T.Vector3(s.actor.x-p.nx*12+p.tx*ahead*.6,s.actor.y+3.4,s.actor.z-p.nz*12+p.tz*ahead*.6);look=new T.Vector3(s.actor.x+p.tx*ahead,s.actor.y+1.3,s.actor.z+p.tz*ahead);}
      else{
        if(prevInLane){const p=lanePoint(U_END);faceYaw=Math.atan2(p.tx,p.tz);camYaw=faceYaw+Math.PI;player.rotation.y=faceYaw;}
        const dist=4.4,hgt=1.25+camPitch*2.8,cx=Math.sin(camYaw),cz=Math.cos(camYaw);
        desired=new T.Vector3(s.actor.x+cx*dist,s.actor.y+hgt,s.actor.z+cz*dist);look=new T.Vector3(s.actor.x-cx*1.8,s.actor.y+1.05,s.actor.z-cz*1.8);}
      if(interactionTest&&new URLSearchParams(location.search).has('capture')){look=chestCenter.clone().lerp(boneEnd||chestCenter,.25);desired=look.clone().add(new T.Vector3(3,3.5,5));}
      prevInLane=s.inLane;
      if(introCam&&!paused){/* 开场运镜：从花园高处绕一大圈俯瞰，再缓缓推回主角身后 */
        introCam.t+=dt*(introCam.t>1&&keys.size?4:1);const TT=7.5,kk=Math.min(1,introCam.t/TT),sm=v=>{v=Math.min(1,Math.max(0,v));return v*v*(3-2*v);};
        const a=sm(kk/.75),ang=camYaw+(1-a)*Math.PI*1.6,r=36+(12-36)*a,h=18+(6-18)*a,b=sm((kk-.6)/.4);
        const orbit=new T.Vector3(s.actor.x+Math.sin(ang)*r,s.actor.y+h,s.actor.z+Math.cos(ang)*r),center=new T.Vector3(0,2,-4);
        camera.position.copy(orbit.lerp(desired,b));camLook.copy(center.lerp(look,sm((kk-.35)/.65)));camera.lookAt(camLook);controls.target.copy(camLook);
        if(kk>=1){if(introCam.pending)window.CloudGuide?.say(introCam.pending);introCam=null;}renderHUD(s);
      }else{const k=1-Math.exp(-(s.inLane?3.2:8)*dt);camera.position.lerp(desired,k);camLook.lerp(look,k);camera.lookAt(camLook);controls.target.copy(camLook);renderHUD(s);}
    }
    saveTimer+=dt;if(saveTimer>.5&&!window.__cloudRestart){saveTimer=0;const data=JSON.stringify(s.state);if(data!==lastSave){try{localStorage.setItem(SAVE_KEY,data);lastSave=data;storageOK=true;}catch{storageOK=false;}}}
    if(s.mode==='won'&&playing){playing=false;try{localStorage.setItem('cloud-wander-highest-unlocked','3')}catch{}window.cloudShowLevelComplete(2);$('#game-result').style.display='grid';$('#win-stats').textContent=`找回了金骨头，也滑完了流水滑梯。用时 ${Math.floor(s.elapsed/60)} 分 ${Math.floor(s.elapsed%60)} 秒，落水 ${s.falls} 次。`;}
  }

  $('#game-selftest').onclick=async()=>{const out=$('#game-test-output');$('#game-selftest').disabled=true;out.style.display='block';out.textContent='正在验证完整任务流程…';const r=await runAcceptance(level);$('#game-selftest').disabled=false;out.textContent=(r.passed?'任务自测全部通过':'有流程需要修正')+'\n\n'+r.results.map(x=>(x.passed?'✓ ':'✗ ')+x.name).join('\n')+'\n\n点击关闭';out.onclick=()=>out.style.display='none';const el=document.createElement('pre');el.id='game-test-report';el.hidden=true;el.textContent=JSON.stringify(r);$('#game-test-report')?.remove();document.body.append(el);};
  return {update};
}

// ======================= 自测：用同一套关卡与规则，在独立实例里把整章自动走一遍
async function runAcceptance(level){
  const results=[];const assert=(name,ok,detail)=>results.push({name,passed:!!ok,detail});
  const yieldUI=()=>new Promise(r=>setTimeout(r,0));
  const blank=createGame(level);assert('出口双条件初始锁定',missingExit(blank.snapshot().state).length===2);
  assert('损坏存档不会跳过八音盒',normalizeSave({version:2,slideDone:true}).slideDone===false);
  assert('存档往返保留进度',(()=>{const s=normalizeSave(JSON.parse(JSON.stringify(normalizeSave({version:2,key:true,musicBoxOpen:true,checkpoint:'lane',laneCp:88}))));return s.key&&s.musicBoxOpen&&s.checkpoint==='lane'&&s.laneCp===88;})());
  // 未开八音盒不能上滑道
  {const g=createGame(level,{version:2,checkpoint:'lane',laneCp:88});for(let i=0;i<480;i++)g.tick(1/120,{x:1});const s=g.snapshot();assert('没打开八音盒不能上滑道',s.mode==='lane'&&s.lane.u<=93.45,s.lane);}
  // 横版段落水回到本段开头
  {const g=createGame(level,{version:2,checkpoint:'lane',laneCp:17.4});for(let i=0;i<120*3;i++)g.tick(1/120,{x:1});const s=g.snapshot();assert('横版段落水回到本小节开头',s.falls>=1&&s.mode==='lane'&&Math.abs(s.lane.u-17.4)<2.5,s.lane);}

  const sim=createGame(level);const step=(i={})=>sim.tick(1/120,i);
  async function go(x,z,{jump=false,tolerance=.27,max=2400}={}){let jumped=false;for(let n=0;n<max;n++){const s=sim.snapshot();if(s.mode!=='play')return s.mode==='won';const dx=x-s.actor.x,dz=z-s.actor.z,d=Math.hypot(dx,dz);if(d<tolerance&&s.actor.grounded)return true;const want=jump&&!jumped&&s.actor.grounded;if(want)jumped=true;step({x:d>tolerance*.45?dx/d:0,z:d>tolerance*.45?dz/d:0,jump:want});if(n%240===0)await yieldUI();if(sim.snapshot().falls>s.falls)return false;}return false;}
  const follow=async pts=>{for(const p of pts)if(!await go(p[0],p[1],p[2]||{}))return false;return true;};
  // 左线
  let ok=await follow([[-2,0],[-5,.5],[-5,5],[-8,3]]);
  for(const p of [[-9,3],[-12,1],[-15,-2],[-18,-5],[-20,-8]])if(ok)ok=await go(p[0],p[1],{jump:true});
  if(ok)ok=await follow([[-22,-8.7],[-22,-9.5]]);assert('左线：下沉粉云至庭院',ok,sim.snapshot());
  if(ok){ok=await go(-22,-10.4);step({resonate:true});assert('庭院 Q 共鸣解除光罩',sim.snapshot().state.resonated);if(ok)ok=await go(-22.6,-10.35);step({interact:true});assert('打开木箱取得金骨头',sim.snapshot().state.key);}
  if(!ok)return {passed:false,results};
  ok=await follow([[-19.8,-11.2],[-18.3,-11]]);step({interact:true});assert('从庭院一侧打开单向栅门',sim.snapshot().state.gateOpen);
  if(ok)ok=await follow([[-16.8,-11],[-15.4,-11],[-14,-11],[-13,-11],[-11.5,-10.3],[-10,-9],[-8.5,-7],[-6.4,-5],[0,0]]);assert('雕花拱桥返回中央',ok,sim.snapshot());if(!ok)return {passed:false,results};
  // 右线：走到接入栈桥，进入横版
  ok=await follow([[3,-1],[7.4,-3.6],[10.5,-5.7]]);
  for(let n=0;n<600&&sim.snapshot().mode==='play';n++)step({x:LANE_ENTRY.x-sim.snapshot().actor.x,z:LANE_ENTRY.z-sim.snapshot().actor.z});
  assert('从小栈桥进入横版睡莲路',sim.snapshot().mode==='lane',sim.snapshot().actor);if(sim.snapshot().mode!=='lane')return {passed:false,results};
  // 横版自动驾驶：到边缘起跳，远距离长按滑翔，到倒影睡莲前按 Q，到八音盒按 E，滑道上提前跳过断口
  const allOpen=LILIES.map(()=>1);let hold=false,failAt=null,boxOk=false;
  for(let n=0;n<120*240;n++){
    const s=sim.snapshot();if(s.mode==='play'){break;}
    const inp={x:1};
    if(s.mode==='slide'){const u=s.slide.u;if(s.slide.jy===0&&SLIDE.gaps.some(([a])=>a-u<1.1&&a-u>.25))inp.jump=true;}
    else{
      const u=s.lane.u,y=s.actor.y;
      if(!s.ghostOn&&u>60&&u<74&&s.actor.grounded)inp.resonate=true;
      if(!s.state.musicBoxOpen&&Math.abs(u-BOX_U)<1&&s.actor.grounded)inp.interact=true;
      if(s.actor.grounded){
        hold=false;const fwd=surfacesAt(u+.55,s.lilyOpen,s.ghostOn);const support=fwd.some(f=>f.y<=y+.3&&f.y>=y-.6),wall=fwd.some(f=>f.solid&&f.y>y+.45);
        if(!support||wall){inp.jump=true;let du=.6;while(du<16&&!surfacesAt(u+du,allOpen,true).some(f=>f.y<=y+1.2))du+=.25;hold=du>5.6;}
      }else{const under=surfacesAt(u,s.lilyOpen,s.ghostOn).some(f=>f.y<=y+.05&&f.y>y-3);if(s.actor.vy<0&&under)inp.x=0;if(hold)inp.jumpHeld=!under;}
    }
    if(s.state.musicBoxOpen)boxOk=true;
    step(inp);if(n%240===0)await yieldUI();
    if(sim.snapshot().falls>s.falls){failAt=s.mode==='slide'?s.slide.u:s.lane.u;break;}
  }
  const r=sim.snapshot();
  assert('横版：睡莲连跳、两段滑翔、倒影睡莲（Q）',failAt===null&&boxOk,{failAt});
  assert('打开记忆八音盒',r.state.musicBoxOpen);
  assert('流水滑道跳过断口完成',r.state.slideDone,{failAt,mode:r.mode,u:r.lane.u});
  assert('横版段结束，回到小桥（第三人称）',r.mode==='play',r.actor);
  if(!(r.state.slideDone&&r.mode==='play'))return {passed:false,results};
  ok=await follow([[11.5,6.8],[9,7],[6,5.8],[3,1.5],[0,0],[0,-8.5],[0,-18.5],[0,-20.8]]);step({interact:true});if(ok)ok=await go(0,-22.4,{tolerance:.08});
  assert('北梯、双条件开门与通关',sim.snapshot().mode==='won',sim.snapshot());
  return {passed:results.every(r=>r.passed),results};
}
