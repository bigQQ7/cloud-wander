import {configureGLTFLoader} from '../shared/web-assets.js?v=3';
import * as THREE from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js?v=round-island2';
export async function createTreehouseRoom({scene,renderer,canvas,player,controls,getMode,hero,outsideCamera,surfaces}){
 const loader=configureGLTFLoader(new GLTFLoader());const outside=await loader.loadAsync('./assets/replacements/treehouse-new.glb');
 const house=outside.scene,b=new THREE.Box3().setFromObject(house),size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3()),wrapper=new THREE.Group();house.position.sub(new THREE.Vector3(center.x,b.min.y,center.z));wrapper.add(house);wrapper.scale.setScalar(11/size.y);wrapper.position.set(24,3.1,8);wrapper.name='回声书屋 · 新外观';scene.add(wrapper);
 let stairKey='',stairBoxKey='';const stairBox=new THREE.Box3();const stairRay=new THREE.Raycaster(),stairNormal=new THREE.Matrix3(),stairCells=Array.from({length:49},()=>({x:0,z:0,h:-10000,rx:.16,rz:.16}));surfaces.push(...stairCells);
 function syncStairs(){
  let visible=true;for(let o=wrapper;o;o=o.parent)if(!o.visible)visible=false;
  if(!visible||getMode()!=='walk'){for(const cell of stairCells)cell.h=-10000;stairKey='';return;}
  // MVP 性能：只在树屋范围内检测，9 条射线，角色没动就不重算
  wrapper.updateWorldMatrix(true,false);const mk=wrapper.matrixWorld.elements.join(',');if(mk!==stairBoxKey){stairBoxKey=mk;stairBox.setFromObject(house).expandByScalar(1.5);}
  if(player.pos.x<stairBox.min.x||player.pos.x>stairBox.max.x||player.pos.z<stairBox.min.z||player.pos.z>stairBox.max.z||player.pos.y>stairBox.max.y){for(const cell of stairCells)cell.h=-10000;stairKey='';return;}
  const key=Math.round(player.pos.x*20)+','+Math.round(player.pos.y*20)+','+Math.round(player.pos.z*20);if(key===stairKey)return;stairKey=key;
  wrapper.updateWorldMatrix(true,true);let index=0;for(const cell of stairCells)cell.h=-10000;
  for(let z=-1;z<=1;z++)for(let x=-1;x<=1;x++){
   const cell=stairCells[index++];cell.x=player.pos.x+x*.3;cell.z=player.pos.z+z*.3;cell.rx=cell.rz=.2;
   stairRay.set(new THREE.Vector3(cell.x,player.pos.y+.40,cell.z),new THREE.Vector3(0,-1,0));stairRay.far=1.25;
   const hit=stairRay.intersectObject(house,true).find(h=>h.face.normal.clone().applyMatrix3(stairNormal.getNormalMatrix(h.object.matrixWorld)).normalize().y>.65);
   cell.h=hit?hit.point.y:-10000;
  }
 }
 const anchorScale=wrapper.scale.y;const room=new THREE.Scene();room.background=new THREE.Color('#bfd1df');room.add(new THREE.HemisphereLight('#fff4df','#73604e',2));const sun=new THREE.DirectionalLight('#ffefd9',2.3);sun.position.set(3,6,4);room.add(sun);
 let interior=null,interiorPromise=null;
 house.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.metalness=0;m.roughness=Math.max(.7,m.roughness||0);}}});
 async function loadInterior(){
  if(interior)return;
  if(interiorPromise)return interiorPromise;
  interiorPromise=loader.loadAsync('./assets/replacements/treehouse-interior.glb').then(inside=>{
   const ib=new THREE.Box3().setFromObject(inside.scene),is=ib.getSize(new THREE.Vector3()),ic=ib.getCenter(new THREE.Vector3());
   interior=new THREE.Group();inside.scene.position.sub(new THREE.Vector3(ic.x,ib.min.y,ic.z));interior.add(inside.scene);interior.scale.setScalar(10/is.x);room.add(interior);room.updateMatrixWorld(true);
   inside.scene.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.metalness=0;m.roughness=Math.max(.7,m.roughness||0);}}});
  }).catch(error=>{interiorPromise=null;throw error;});
  return interiorPromise;
 }
 const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.03,100),ray=new THREE.Raycaster(),keys=new Set();let phase='outside',yaw=0,pitch=0,drag=null,previous=performance.now();const foot=new THREE.Vector3(0,.4,2.8);const ladder={x:24,z:3,base:3.18,top:9};
 const button=document.createElement('button'),hint=document.createElement('div');button.style.cssText='position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:40;padding:14px 24px;border:0;border-radius:24px;background:#fff6df;color:#59472f;font-size:16px;display:none';hint.style.cssText='position:fixed;bottom:65px;left:50%;transform:translateX(-50%);z-index:40;color:#fff;background:#344a55c9;padding:8px 14px;border-radius:16px;display:none';document.body.append(button,hint);
 function setPhase(next){phase=next;keys.clear();controls.enabled=false;canvas.dataset.interior=String(next==='inside');canvas.dataset.treehousePhase=next;for(const id of ['editScene','overview','reset','help','journalButton']){const el=document.getElementById(id);if(el)el.disabled=next!=='outside';}for(const id of ['walkHelp','mapPanel']){const el=document.getElementById(id);if(el)el.hidden=next!=='outside';}canvas.focus();}
 button.onclick=async()=>{if(phase==='outside'){player.pos.x=ladder.x;player.pos.z=ladder.z;player.pos.y=ladder.base;setPhase('climbing');}else if(phase==='climbing'){player.pos.y=ladder.base;player.pos.z=ladder.z-1;player.grounded=true;setPhase('outside');}else if(phase==='door'){button.disabled=true;button.textContent='正在打开书屋…';try{await loadInterior();}catch(error){console.warn(error);hint.textContent='书屋未加载完成，请重试';return;}finally{button.disabled=false;}foot.set(0,.4,2.8);yaw=0;pitch=0;setPhase('inside');}else{player.pos={x:ladder.x,y:ladder.top,z:ladder.z};setPhase('door');}};
 addEventListener('keydown',e=>{if(phase==='outside')return;if(['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown'].includes(e.code)){keys.add(e.code);e.preventDefault();e.stopImmediatePropagation();}},true);addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
 canvas.addEventListener('pointerdown',e=>{if(phase==='inside'){drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}},true);canvas.addEventListener('pointermove',e=>{if(phase!=='inside'||!drag)return;yaw-=(e.clientX-drag.x)*.004;pitch=THREE.MathUtils.clamp(pitch-(e.clientY-drag.y)*.004,-1.15,1.15);drag={x:e.clientX,y:e.clientY};},true);canvas.addEventListener('pointerup',()=>drag=null);
 function blocked(x,z){const delta=new THREE.Vector3(x-foot.x,0,z-foot.z),distance=delta.length();if(!distance)return false;delta.normalize();for(const h of [.55,1.15]){ray.set(new THREE.Vector3(foot.x,foot.y+h,foot.z),delta);ray.far=distance+.18;if(ray.intersectObject(interior,true).some(hit=>Math.abs(hit.face.normal.y)<.8))return true;}return false;}
 return{object:wrapper,update(){syncStairs();const now=performance.now(),dt=Math.min(.04,(now-previous)/1000);previous=now;wrapper.updateWorldMatrix(true,false);const bottom=wrapper.localToWorld(new THREE.Vector3(0, .08/anchorScale,-5/anchorScale)),top=wrapper.localToWorld(new THREE.Vector3(0,5.9/anchorScale,-5/anchorScale));ladder.x=bottom.x;ladder.z=bottom.z;ladder.base=bottom.y;ladder.top=top.y;if(phase==='outside'){/* MVP: 树屋室内已关闭 */button.style.display='none';hint.style.display='none';return false;}
 button.style.display=hint.style.display='block';if(phase==='inside'){button.textContent='走出书屋';hint.textContent='WASD 行走 · 拖动转向';let x=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),z=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);const len=Math.max(1,Math.hypot(x,z));x/=len;z/=len;const nx=foot.x+(Math.cos(yaw)*x-Math.sin(yaw)*z)*dt*1.8,nz=foot.z+(-Math.sin(yaw)*x-Math.cos(yaw)*z)*dt*1.8;if(Math.hypot(nx,nz)<4.0&&!blocked(nx,nz)){foot.x=nx;foot.z=nz;}ray.set(new THREE.Vector3(foot.x,2,foot.z),new THREE.Vector3(0,-1,0));ray.far=3;const floor=ray.intersectObject(interior,true).find(h=>h.point.y<.9);if(floor)foot.y=floor.point.y;camera.position.set(foot.x,foot.y+1.35,foot.z);camera.rotation.set(pitch,yaw,0,'YXZ');camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.render(room,camera);return true;}
 if(phase==='climbing'){button.textContent='退回梯脚';hint.textContent='W / ↑ 向上爬 · S / ↓ 向下爬';const axis=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);player.pos.y=THREE.MathUtils.clamp(player.pos.y+axis*dt*1.4,ladder.base,ladder.top);player.grounded=false;player.vy=0;if(player.pos.y>=ladder.top-.01)setPhase('door');}else{button.textContent='进入书屋';hint.textContent='已到门口 · S 向下爬';if(keys.has('KeyS'))setPhase('climbing');}
 hero.update(player,dt,'walk',surfaces,false);outsideCamera.position.set(ladder.x+3,player.pos.y+1.8,ladder.z-5);outsideCamera.lookAt(ladder.x,player.pos.y+1,ladder.z);renderer.render(scene,outsideCamera);return true;}};
}
