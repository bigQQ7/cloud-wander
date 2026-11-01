import {createResonanceFX} from '../shared/resonance-fx.js';
import * as THREE from 'three';
import {createLocomotionLayer} from './hero-locomotion.js?v=walk1';
import {GLTFLoader} from './vendor/GLTFLoader.js?v=round-island2';
import {obstacles,inside,surfaceAt} from './physics.js?v=walk1';
export async function createHero(scene,canvas){
 const loader=new GLTFLoader();const [gltf,petting]=await Promise.all([loader.loadAsync('./assets/replacements/hero-v31-round.glb'),loader.loadAsync('./assets/replacements/hero-petting.glb?v=natural-contact4')]);gltf.animations.push(...petting.animations);const resonance=await loader.loadAsync('../shared/resonance.glb?v=1');gltf.animations.push(...resonance.animations.map(c=>{c.name='Resonance';return c;}));
 const spaceClips=await Promise.all(['Jump','Glide'].map(name=>loader.loadAsync('../shared/space-'+name+'.glb?v=45').then(g=>{g.animations[0].name=name;g.animations[0].tracks=g.animations[0].tracks.filter(t=>!t.name.startsWith('rig.'));return g.animations[0];})));gltf.animations=gltf.animations.filter(c=>!['Jump','Glide','Parachute','Parasail','Umbrella'].some(n=>c.name===n||c.name.endsWith('|'+n)||c.name.endsWith('_'+n)));gltf.animations.push(...spaceClips);const landingAsset=await loader.loadAsync('../shared/landing35.glb?v=35');const landingClip=landingAsset.animations[0];landingClip.name='Landing';landingClip.tracks=landingClip.tracks.filter(t=>!t.name.startsWith('rig.'));gltf.animations=gltf.animations.filter(c=>c.name!=='Landing');gltf.animations.push(landingClip);
 const root=new THREE.Group();root.name='主角 • v31';root.add(gltf.scene);scene.add(root);
 gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;o.frustumCulled=false;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.roughness=Math.max(.65,m.roughness);m.metalness=0;}}});
 // 脚底贴地：加载后量一次 bbox，存为偏移量，每帧在 root.position.y 上加上去
 // （不能改 gltf.scene.position，骨骼动画每帧会覆盖它）
 let yFoot=0;
 {scene.updateMatrixWorld(true);const bbox=new THREE.Box3().setFromObject(gltf.scene);
  const h=bbox.max.y-bbox.min.y;yFoot=h>0.1?-bbox.min.y:0.35;} // 量不到就用 0.35 经验值
 // The falling take contains forward body travel. Remove only that common root
 // displacement from top-level deform bones; physics owns world movement.
 const rootBones=[];gltf.scene.traverse(o=>{if(o.isBone&&!o.parent?.isBone)rootBones.push(o);});
 const pelvis=rootBones.find(o=>o.name.replace(/[._]/g,'')==='rootx');
 const fall=gltf.animations.find(c=>c.name==='Fall');
 if(fall&&pelvis){const source=fall.tracks.find(t=>t.name===pelvis.name+'.position');if(source){const deltas=source.values.slice();for(const bone of rootBones){const track=fall.tracks.find(t=>t.name===bone.name+'.position');if(track&&track.values.length===deltas.length)for(let i=0;i<track.values.length;i++)track.values[i]-=deltas[i]-deltas[i%3];}}}
 // The supplied Run take has nearly planted ankles. Reuse the corrected
 // alternating foot cycle so sprinting cannot regress to the original foot slide.
 const walkClip=gltf.animations.find(c=>c.name==='Walk');
 if(walkClip){const runClip=walkClip.clone();runClip.name='Run';for(const track of runClip.tracks)track.scale(.67);runClip.resetDuration();gltf.animations=gltf.animations.filter(c=>c.name!=='Run');gltf.animations.push(runClip);}
const parachute=(await loader.loadAsync('../shared/parachute.glb?v=43')).scene;parachute.visible=false;root.add(parachute);
 const mixer=new THREE.AnimationMixer(gltf.scene),actions={},seen=new Set();
 for(const clip of gltf.animations){const name=['Landing','Resonance','Idle','Walk','Run','Jump','Fall','SitDown','Seated','Petting','Parachute','Glide','Parasail','Umbrella'].find(n=>clip.name===n||clip.name.endsWith('|'+n)||clip.name.endsWith('_'+n));if(name)actions[name]=mixer.clipAction(clip);}
 // 降落伞别名统一到 Glide
 for(const alias of ['Parachute','Parasail','Umbrella']){if(actions[alias]&&!actions['Glide'])actions['Glide']=actions[alias];}
 const locomotion=createLocomotionLayer(gltf.scene,root);
 let current=null,lastGrounded=true,landing=0,landingPrepared=false,heading=0,previous=null,snap=true,lastJump=0,inJump=false,interaction=null,interactionTime=0,airTime=0;
 const target=new THREE.Vector3(),eye=new THREE.Vector3(),offset=new THREE.Vector3(),direction=new THREE.Vector3();
 function play(name){if(name===current||!actions[name])return;const next=actions[name];const old=actions[current];const gaitSwitch=['Walk','Run'].includes(current)&&['Walk','Run'].includes(name);const gaitPhase=gaitSwitch?old.time/old.getClip().duration:0;next.reset();next.paused=false;next.setEffectiveTimeScale(1).setEffectiveWeight(1);if(['Landing','Resonance','Jump','Fall','Petting'].includes(name)){next.setLoop(THREE.LoopOnce,1);next.clampWhenFinished=true;}else next.setLoop(THREE.LoopRepeat,Infinity);/* Glide/Seated 也循环 */if(name==='Jump')next.setEffectiveTimeScale(next.getClip().duration/(20/19.5));if(gaitSwitch)next.time=gaitPhase*next.getClip().duration;next.play();if(name==='Fall'||name==='Jump'){for(const [key,a] of Object.entries(actions))if(key!==name)a.stop();}else if(current)actions[current].crossFadeTo(next,.24,false);current=name;seen.add(name);canvas.dataset.heroStates=[...seen].join(',');canvas.dataset.heroAction=name;}
 const resonanceFX=createResonanceFX(THREE,scene);let resonanceLeft=0;addEventListener('keydown',e=>{if(e.code==='KeyQ'&&!e.repeat&&resonanceLeft<=0){resonanceLeft=actions.Resonance?.getClip().duration||0;}});play('Idle');canvas.dataset.heroClips=Object.keys(actions).join(',');canvas.dataset.perspective='third-person';
 const tilt={on:false,angle:0,pivot:0},grip={fn:null,bones:null},fist={on:false,bones:null};return{setFist(on){fist.on=!!on;},setGrip(fn){grip.fn=fn;grip.bones=null;},getHands(){let sk=null;root.traverse(o=>{if(o.isSkinnedMesh&&!sk){let vis=true;for(let a2=o;a2&&a2!==root.parent;a2=a2.parent)if(!a2.visible)vis=false;if(vis&&o.skeleton.bones.some(b=>b.name==='handl'))sk=o.skeleton;}});if(!sk)return null;root.updateMatrixWorld(true);return ['handl','handr'].map(n=>sk.bones.find(b=>b.name===n)?.getWorldPosition(new THREE.Vector3())).filter(Boolean);},setTilt(angle,pivot){if(angle===null){tilt.on=false;return;}tilt.on=true;tilt.angle=angle;tilt.pivot=pivot;},setInteraction(name,angle){interaction={name,angle};interactionTime=0;play(name);},clearInteraction(){interaction=null;},resetCamera(){snap=true;previous=null;},update(p,dt,mode,surfaces,resetting){
  root.visible=mode!=='edit';root.position.set(p.pos.x,p.pos.y+yFoot,p.pos.z);
  let speed=0;
  if(previous){const dx=p.pos.x-previous.x,dz=p.pos.z-previous.z;speed=Math.hypot(dx,dz)/Math.max(dt,.001);if(speed>.12&&speed<20)heading=Math.atan2(dx,dz);}
  previous={...p.pos};if(interaction)heading=interaction.angle;root.rotation.y+=(THREE.MathUtils.euclideanModulo(heading-root.rotation.y+Math.PI,Math.PI*2)-Math.PI)*(1-Math.exp(-dt*(interaction?16:9)));if(tilt.on){/* 坐秋千：整个身体跟着绳子的角度前后摆，以坐点为支点 */root.rotation.order='YXZ';root.rotation.x=tilt.angle;const hp=tilt.pivot-yFoot,sy=Math.sin(root.rotation.y),cy=Math.cos(root.rotation.y),sn=Math.sin(tilt.angle);root.position.x-=sy*hp*sn;root.position.z-=cy*hp*sn;root.position.y+=hp*(1-Math.cos(tilt.angle));}else if(root.rotation.x){root.rotation.x=0;}
  if(lastGrounded&&!p.grounded){landingPrepared=false;landing=0;}
  if(!p.grounded&&p.vy<-.2&&!landingPrepared){const floor=surfaceAt(surfaces,p.pos.x,p.pos.z,p.pos.y+.05);if(floor){const gap=Math.max(0,p.pos.y-floor.h),v=-p.vy;const eta=p.gliding?gap/v:(Math.sqrt(v*v+2*19.5*gap)-v)/19.5;if(eta<=.42&&gap<=5.8){landingPrepared=true;landing=actions.Landing.getClip().duration;}}}
  if(!lastGrounded&&p.grounded&&!landingPrepared)landing=actions.Landing.getClip().duration;lastGrounded=p.grounded;landing=Math.max(0,landing-dt);
  if(p.jumps!==lastJump){lastJump=p.jumps;inJump=true;}if(p.grounded)inJump=false;
  if(interaction?.name==='Petting'){interactionTime+=dt;if(interactionTime>=actions.Petting.getClip().duration)interaction=null;}
  const beforeResonance=resonanceLeft;resonanceLeft=Math.max(0,resonanceLeft-dt);if(beforeResonance>0&&resonanceLeft===0){resonanceFX.emit(p.pos.x,p.pos.y,p.pos.z);dispatchEvent(new Event('cloud-resonance'));}resonanceFX.update(dt);if(p.vy>0)landing=0;const state=resonanceLeft>0?'Resonance':landing>0?'Landing':interaction?interaction.name:mode==='walk'&&!resetting?(p.gliding&&(actions['Glide']||actions['Seated'])?(actions['Glide']?'Glide':'Seated'):!p.grounded?(inJump?'Jump':'Fall'):(landing>0?'Idle':speed>5?'Run':speed>.15?'Walk':'Idle')):'Idle';
  parachute.visible=state==='Glide';play(state);if(state==='Walk')actions.Walk.setEffectiveTimeScale(THREE.MathUtils.clamp(speed/3.1,.65,1.65));if(state==='Run')actions.Run.setEffectiveTimeScale(THREE.MathUtils.clamp(speed/5.4,.85,1.5));locomotion.restore();mixer.update(dt);if(state==='Fall'){const a=actions.Fall;airTime+=dt;const duration=a.getClip().duration;const center=Math.min(.4,duration*.38),amplitude=Math.min(.15,duration*.14);a.time=center+amplitude*Math.sin(airTime*3.4);a.paused=true;mixer.update(0);}else airTime=0;locomotion.update(dt,state,actions[state],speed,mode==='walk'&&p.grounded&&!interaction&&!resetting&&state!=='Glide'&&state!=='Seated');canvas.dataset.heroClipTime=actions[state]?.time.toFixed(3)||'0';
  if(grip.fn){/* 坐秋千：两只手抓住绳子。这个骨架的手臂骨骼是平铺的（不是父子链），所以直接算出肘和手腕的位置再逐根摆好（两节解析 IK） */const tg=grip.fn();if(tg){root.updateMatrixWorld(true);
  if(!grip.bones){let sk=null;root.traverse(o=>{if(o.isSkinnedMesh&&!sk){let vis=true;for(let a2=o;a2&&a2!==root.parent;a2=a2.parent)if(!a2.visible)vis=false;if(vis&&o.skeleton.bones.some(b=>b.name==='handl'||b.name==='hand.l'))sk=o.skeleton;}});
   const f=n=>{const m=n.replace(/\./g,'');return sk?.bones.find(b=>b.name===n||b.name===m)||root.getObjectByName(m)||null;};
   grip.bones=['l','r'].map(k=>({arm:f('arm_stretch.'+k),twist:f('c_arm_twist_offset.'+k),fore:f('forearm_stretch.'+k),hand:f('hand.'+k)})).filter(x=>x.arm&&x.fore&&x.hand);}
  const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion();
  const place=(bone,worldPos,rotQ)=>{const wq=bone.getWorldQuaternion(Q()),pq=bone.parent.getWorldQuaternion(Q());if(worldPos)bone.position.copy(bone.parent.worldToLocal(worldPos.clone()));if(rotQ)bone.quaternion.copy(pq.invert().multiply(rotQ.clone().multiply(wq)));bone.updateMatrixWorld(true);};
  if(grip.bones.length===2){const lines=tg.slice();
   for(const x of grip.bones){const S=x.arm.getWorldPosition(V()),E0=x.fore.getWorldPosition(V()),W0=x.hand.getWorldPosition(V());
    // 选离肩膀近的那根绳子
    const ci=lines.length>1&&lines[1].closestPointToPoint(S,false,V()).distanceTo(S)<lines[0].closestPointToPoint(S,false,V()).distanceTo(S)?1:0,L=lines.splice(ci,1)[0];
    const a=S.distanceTo(E0),b=E0.distanceTo(W0),reach=(a+b)*.92;const T=L.closestPointToPoint(S,false,V()),h=T.distanceTo(S);if(h<reach)T.addScaledVector(V().subVectors(L.end,L.start).normalize(),Math.sqrt(reach*reach-h*h));
    const toT=V().subVectors(T,S),d=THREE.MathUtils.clamp(toT.length(),Math.abs(a-b)+1e-3,a+b-1e-3),dir=toT.normalize();
    // 肘部弯曲方向：保持原来的弯曲平面
    const sw=V().subVectors(W0,S).normalize(),pole=V().subVectors(E0,S);pole.addScaledVector(sw,-pole.dot(sw));pole.addScaledVector(dir,-pole.dot(dir));if(pole.lengthSq()<1e-6)pole.set(0,-1,0).addScaledVector(dir,-dir.y);pole.normalize();
    const cosA=THREE.MathUtils.clamp((a*a+d*d-b*b)/(2*a*d),-1,1),E=S.clone().addScaledVector(dir,a*cosA).addScaledVector(pole,a*Math.sqrt(1-cosA*cosA)),W=S.clone().addScaledVector(dir,d);
    const q1=Q().setFromUnitVectors(V().subVectors(E0,S).normalize(),V().subVectors(E,S).normalize()),q2=Q().setFromUnitVectors(V().subVectors(W0,E0).normalize(),V().subVectors(W,E).normalize());
    place(x.arm,null,q1);if(x.twist){const tp=x.twist.getWorldPosition(V());place(x.twist,S.clone().add(tp.sub(S).applyQuaternion(q1)),q1);}
    place(x.fore,E,q2);place(x.hand,W,q2);}}}}
 if(fist.on||fist.bones){/* 握拳：每节手指绕自身 X 轴弯曲 */if(!fist.bones){fist.bones=[];root.traverse(o=>{if(o.isBone&&/^(f_(index|middle|ring|pinky|thumb)_0[123]|c_(index|middle|ring|pinky)[23]|(index|middle|ring|pinky)1|c_thumb[23]|thumb1)[lr]$/.test(o.name.replace(/\./g,'')))fist.bones.push(o);});}
  for(const b of fist.bones){if(fist.on){if(!b.userData.fistBase)b.userData.fistBase=b.quaternion.clone();const ang=(/thumb/.test(b.name)?.6:1.25)*FIST_SIGN;b.quaternion.copy(b.userData.fistBase).multiply(new THREE.Quaternion().setFromAxisAngle(FIST_AXIS,ang));}else if(b.userData.fistBase){b.quaternion.copy(b.userData.fistBase);delete b.userData.fistBase;}}if(!fist.on)fist.bones=null;}
 canvas.dataset.heroGrounded=String(p.grounded);
 },follow(camera,p,dt,surfaces){
  target.set(p.pos.x,p.pos.y+.95,p.pos.z);
  const elevation=THREE.MathUtils.clamp(.31-p.pitch,.08,1.14),distance=4.4;
  offset.set(Math.sin(p.yaw)*Math.cos(elevation),Math.sin(elevation),Math.cos(p.yaw)*Math.cos(elevation));
  let safe=distance;
  for(let d=.5;d<=distance;d+=.16){eye.copy(target).addScaledVector(offset,d);if(obstacles.some(o=>eye.y<o.h&&inside(o,eye.x,eye.z,.15))){safe=Math.max(.8,d-.2);break;}}
  eye.copy(target).addScaledVector(offset,safe);
  const floor=surfaceAt(surfaces,eye.x,eye.z);if(floor)eye.y=Math.max(eye.y,floor.h+.35);
  if(snap||camera.position.distanceTo(eye)>12){camera.position.copy(eye);snap=false;}else camera.position.lerp(eye,1-Math.exp(-dt*12));
  camera.lookAt(target);canvas.dataset.cameraDistance=camera.position.distanceTo(target).toFixed(2);
 }};
}
let FIST_SIGN=1.3,FIST_AXIS=new THREE.Vector3(1,0,0);window.__fistCfg=(sign,x,y,z)=>{FIST_SIGN=sign;FIST_AXIS=new THREE.Vector3(x,y,z);};
