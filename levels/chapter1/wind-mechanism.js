import * as THREE from 'three';
import {obstacles,surfaceAt} from './physics.js?v=spawn2';
import {STORY_KEY,normalizeStory,advanceStory,canUseWind} from './story-state.js?v=mvp3';
export function createWindMechanism({scene,canvas,camera,hero,assets,surfaces,getMode,lock,unlock,toast}){
 const $=s=>document.querySelector(s);let story;
 try{story=normalizeStory(JSON.parse(localStorage.getItem(STORY_KEY)));}catch{story=normalizeStory(null);}
 const station=new THREE.Group();station.name='风纹机关台';station.position.set(1.7/10.5,.08/10.5,-5/10.5);station.scale.set(1/10.5,.40/10.5,1/10.5);assets.windmill.add(station);
 const stone=new THREE.MeshStandardMaterial({color:'#d9cfad',roughness:.94}),trim=new THREE.MeshStandardMaterial({color:'#b99c60',roughness:.7,metalness:.15});
 function mesh(geometry,material,y){const o=new THREE.Mesh(geometry,material);o.position.y=y;o.castShadow=o.receiveShadow=true;station.add(o);return o;}
 mesh(new THREE.CylinderGeometry(.40,.45,.16,8),stone,.08);mesh(new THREE.CylinderGeometry(.40,.50,.68,8),stone,.49);mesh(new THREE.CylinderGeometry(.62,.52,.18,12),stone,.91);
 mesh(new THREE.TorusGeometry(.48,.025,8,48),trim,1.015).rotation.x=-Math.PI/2;
 const magic=new THREE.MeshBasicMaterial({color:'#80e4e8',transparent:true,opacity:.17,toneMapped:false});
 const rune=mesh(new THREE.TorusGeometry(.43,.035,8,48),magic,1.03);rune.rotation.x=-Math.PI/2;
 for(let i=0;i<3;i++){const curl=mesh(new THREE.TorusGeometry(.13,.018,6,24,Math.PI*1.5),magic,1.035);curl.rotation.x=-Math.PI/2;curl.rotation.z=i*Math.PI*2/3;curl.position.x=Math.cos(i*2.094)*.16;curl.position.z=Math.sin(i*2.094)*.16;}
 const crystal=mesh(new THREE.OctahedronGeometry(.105),new THREE.MeshStandardMaterial({color:'#a0d5d7',emissive:'#69d9e9',emissiveIntensity:.05,roughness:.4}),1.23);
 const trail=new THREE.Group();scene.add(trail);const trailMaterial=new THREE.MeshBasicMaterial({color:'#c4ffff',transparent:true,opacity:0,toneMapped:false});
 const bridgeLights=surfaces.filter(s=>s.editorKey?.startsWith('03–04')).map(s=>{const o=new THREE.Mesh(new THREE.TorusGeometry(.52,.025,6,32),trailMaterial.clone());o.rotation.x=-Math.PI/2;trail.add(o);return{surface:s,object:o};});
 const sparks=Array.from({length:14},()=>{const o=new THREE.Mesh(new THREE.SphereGeometry(.045,6,4),trailMaterial);trail.add(o);return o;});
 const at=new THREE.Vector3(),end=new THREE.Vector3(),worldScale=new THREE.Vector3(),beaconObstacle={x:0,z:0,rx:.40,rz:.40,h:0};obstacles.push(beaconObstacle);
 let wideBox=null;const wideCenter=new THREE.Vector3(),wideSize=new THREE.Vector3(),wideLook=new THREE.Vector3();
 let phase=story.windmillActivated?'active':'dormant',clock=0,now=0,near=false,dialog=false,statusUntil=0,storageWarning=false,audio,actor=null,wasActive=false;
 const from=new THREE.Vector3(),destination=new THREE.Vector3(),forward=new THREE.Vector3(),right=new THREE.Vector3(),shotEye=new THREE.Vector3(),shotTarget=new THREE.Vector3();let facing=0;
 const busy=()=>['approaching','petting','activating'].includes(phase);
 assets.setWindActive(story.windmillActivated,true);
 function event(type){story=advanceStory(story,type);try{localStorage.setItem(STORY_KEY,JSON.stringify(story));}catch{storageWarning=true;}}
 function chime(){try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});[523.25,659.25,783.99].forEach((frequency,i)=>{const osc=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime+i*.22;osc.type='sine';osc.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.028,start+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+1.8);osc.connect(gain).connect(audio.destination);osc.start(start);osc.stop(start+1.9);});}catch{}}
 function status(text,duration=5){$('#windStatus').textContent=text;$('#windStatus').hidden=false;statusUntil=now+duration;}
 function showMemory(){if(dialog)return;if(window.CloudGuide){hero.clearInteraction();event('collect');const box=$('#windMemory'),G=window.CloudGuide;G.showBanner('找回记忆 · '+$('#windMemoryTitle').textContent);G.say([...box.querySelectorAll('p,blockquote')].map(e=>e.textContent.trim()).filter(Boolean),{clear:true});event('viewed');canvas.dataset.windMemory='closed';$('#windPrompt').hidden=true;unlock();if(storageWarning)toast('当前浏览器无法保存进度，本次游玩仍可继续');return;}hero.clearInteraction();event('collect');dialog=true;lock();$('#windPrompt').hidden=true;$('#windStatus').hidden=true;$('#windMemory').hidden=false;$('#closeWindMemory').focus();canvas.dataset.windMemory='open';}
 function closeMemory(){if(!dialog)return;dialog=false;event('viewed');$('#windMemory').hidden=true;canvas.dataset.windMemory='closed';unlock();status('已找回「我们的记号」· 沿亮起的云桥前往回声树屋',6);if(storageWarning)toast('当前浏览器无法保存进度，本次游玩仍可继续');}
 function cancel(){hero.clearInteraction();phase=wasActive?'active':'dormant';unlock();status('已收回手，可以再次靠近风纹',3);}
 function use(){
  if(!near||busy()||dialog||!actor)return false;
  from.set(actor.pos.x,actor.pos.y,actor.pos.z);forward.subVectors(at,from);forward.y=0;if(forward.lengthSq()<.001)forward.set(0,0,1);forward.normalize();right.set(forward.z,0,-forward.x);
  destination.copy(at).addScaledVector(forward,-.70).addScaledVector(right,.28);const floor=surfaceAt(surfaces,destination.x,destination.z,actor.pos.y+.4);
  if(!floor||Math.abs(floor.h-actor.pos.y)>.45){toast('请从机关台前方的平地靠近');return false;}destination.y=floor.h;
  facing=Math.atan2(forward.x,forward.z);wasActive=story.windmillActivated;phase='approaching';clock=0;lock();hero.setInteraction('Walk',facing);
  try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch{}
  status('正在靠近风纹……',3);$('#windPrompt').hidden=true;return true;
 }

 $('#windInteract').addEventListener('click',use);$('#closeWindMemory').addEventListener('click',closeMemory);
 return{get memoryCollected(){return story.windMemoryCollected;},use,handleKey(e){if(dialog&&['KeyE','Enter','Escape'].includes(e.code)){e.preventDefault();if(!e.repeat)closeMemory();return true;}if(busy()&&e.code==='Escape'){e.preventDefault();if(phase==='activating')clock=6;else cancel();return true;}if(dialog||busy())return true;if(e.code==='KeyE'&&!e.repeat&&getMode()==='walk'){e.preventDefault();return use();}return false;},update(dt,seconds,p){
  now=seconds;actor=p;station.getWorldPosition(at);station.getWorldScale(worldScale);let visible=true;for(let o=station;o;o=o.parent)if(!o.visible)visible=false;
  beaconObstacle.x=at.x;beaconObstacle.z=at.z;beaconObstacle.rx=beaconObstacle.rz=.40*worldScale.x;beaconObstacle.h=visible?at.y+1.1*worldScale.y:-10000;
  near=canUseWind(p,at,getMode(),visible);
  $('#windPrompt').hidden=!near||busy()||dialog;
  $('#windPromptText').textContent=phase==='active'?(story.windMemoryCollected?'抚摸风纹 · 重温记忆':'抚摸风纹 · 查看记忆'):'轻抚风纹，唤醒风车';
  if(phase==='approaching'){
   clock+=dt;const t=Math.min(1,clock/.7),ease=t*t*(3-2*t);const point=new THREE.Vector3().lerpVectors(from,destination,ease);p.pos.x=point.x;p.pos.y=point.y;p.pos.z=point.z;p.vy=0;p.grounded=true;
   if(t>=1){phase='petting';clock=0;hero.setInteraction('Petting',facing);status('伸手轻抚风纹……',4);}
  }else if(phase==='petting'){
   clock+=dt;
   if(!wasActive&&clock>=1.55){phase='activating';clock=0;event('activate');assets.setWindActive(true);chime();status('风纹回应了你的触碰，风车正在苏醒……',5);}
   else if(wasActive&&clock>=4.3){phase='active';chime();showMemory();}
  }else if(phase==='activating'){clock+=dt;if(clock>=6){phase='active';chime();showMemory();}}
  if(busy()&&phase==='activating'){
   // 风车苏醒：拉到远景，慢慢环绕整座风车
   if(!wideBox){wideBox=new THREE.Box3().setFromObject(assets.windmill);wideBox.getCenter(wideCenter);wideBox.getSize(wideSize);}
   const H=Math.max(wideSize.y,wideSize.x,wideSize.z),dist=H*1.25+7,a=Math.atan2(-forward.x,-forward.z)+.5-clock*.07;
   shotEye.set(wideCenter.x+Math.sin(a)*dist,wideCenter.y+H*.18+2,wideCenter.z+Math.cos(a)*dist);shotTarget.copy(wideCenter);shotTarget.y+=H*.08;
   const w=1-Math.exp(-dt*(clock<1.2?1.6:3));camera.position.lerp(shotEye,w);wideLook.lerp(shotTarget,w);camera.lookAt(wideLook);
  }else if(busy()){
   shotTarget.copy(at).addScaledVector(forward,-.35);shotTarget.y+=.55;wideLook.copy(shotTarget);
   shotEye.copy(at).addScaledVector(forward,-2.0).addScaledVector(right,-2.2);shotEye.y+=1.15;camera.position.lerp(shotEye,1-Math.exp(-dt*7));camera.lookAt(shotTarget);
  }
  const amount=story.windmillActivated?(phase==='activating'?.3+.7*Math.min(1,clock/3):1):0;
  magic.opacity=.17+amount*.78;crystal.material.emissiveIntensity=.05+amount*1.8;crystal.position.y=1.23+(amount?Math.sin(seconds*1.5)*.045:0);crystal.rotation.y=seconds*.25;
  trail.visible=visible&&story.windmillActivated;trailMaterial.opacity=amount*.65;
  for(const [index,light] of bridgeLights.entries()){light.object.material.opacity=(phase==='activating'?THREE.MathUtils.clamp((clock-2.2-index*.26)/.6,0,1):story.windmillActivated?1:0)*.65;light.object.position.set(light.surface.x,light.surface.h+.12,light.surface.z);light.object.visible=light.surface.h>-1000;}
  assets.windmill.getWorldPosition(end);end.y+=1.6;for(let i=0;i<sparks.length;i++){const f=(seconds*.13+i/sparks.length)%1;sparks[i].position.lerpVectors(at,end,f);sparks[i].position.y+=.3+Math.sin(f*Math.PI)*.6;}
  if(!dialog&&now>statusUntil)$('#windStatus').hidden=true;
  $('#storyBadge').hidden=!story.windMemoryCollected;canvas.dataset.windMechanism=phase;canvas.dataset.windMemoryCollected=String(story.windMemoryCollected);canvas.dataset.windMemoryViewed=String(story.windMemoryViewed);canvas.dataset.windRotorTime=assets.windTime.toFixed(3);canvas.dataset.windRotorSpeed=assets.windSpeed.toFixed(3);
 }};
}
