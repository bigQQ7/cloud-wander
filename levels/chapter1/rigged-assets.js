import {configureGLTFLoader} from '../shared/web-assets.js?v=3';
import * as THREE from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js?v=round-island2';
import {clone} from './vendor/SkeletonUtils.js';
const placements=[[-44,1.1,-13,.72],[-28,1.1,-13,.62],[-18,5.1,19,.60],[-5,5.1,24,.67],[24,3.1,8,1.5]];
export async function createRiggedAssets(scene,renderer){
 const loader=configureGLTFLoader(new GLTFLoader()),[tree,mill,archAsset]=await Promise.all(['tree','windmill','arch'].map(name=>loader.loadAsync('./assets/replacements/'+name+'.glb'))),mixers=[];
 const prepare=(root,leaf=false)=>root.traverse(o=>{
  if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;if(o.isSkinnedMesh)o.frustumCulled=false;
  for(const m of Array.isArray(o.material)?o.material:[o.material]){
   m.metalness=0;if(m.normalScale)m.normalScale.set(.65,.65);m.roughness=Math.max(.72,m.roughness||0);if(m.map)m.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
   if(leaf&&/leaves/i.test(m.name)){m.side=THREE.DoubleSide;m.emissive.set('#ffffff');m.emissiveIntensity=0;m.emissiveMap=m.map||null;}
  }
 });
 const animate=(root,clips,phase)=>{if(!clips.length)return;const mixer=new THREE.AnimationMixer(root);for(const clip of clips)mixer.clipAction(clip).play();mixer.setTime(phase);mixers.push(mixer);return mixer;};
 const trees=placements.map(([x,y,z,scale],i)=>{
  const object=new THREE.Group();object.name=i===4?'回声树屋 • 新版茂盛秋千树':`新版茂盛树 • ${i+1}`;object.position.set(x,y,z);object.scale.setScalar(scale);object.rotation.y=THREE.MathUtils.degToRad(i*53);const model=clone(tree.scene);object.add(model);prepare(model,true);if(i===4)model.visible=false;animate(model,tree.animations,i*.61);scene.add(object);return object;
 });
 const windmill=new THREE.Group();windmill.name='03 • Great windmill';windmill.position.set(-12.9,5.1,19.9);windmill.scale.setScalar(10.5);const model=clone(mill.scene);windmill.add(model);prepare(model);const millMixer=animate(model,mill.animations,0);millMixer.timeScale=0;scene.add(windmill);
 const arch=new THREE.Group();arch.name='01 • Awakening stone gate';arch.position.set(-37,3.22,-12);arch.scale.setScalar(6.5);const archModel=clone(archAsset.scene);arch.add(archModel);prepare(archModel);scene.add(arch);
 let previous=null,windTarget=0,windSpeed=0;
 return{objects:trees,windmill,arch,count:trees.length,treeAnimations:tree.animations.length,windmillAnimations:mill.animations.length,setWindActive(active,immediate=false){windTarget=active?1:0;if(immediate)windSpeed=windTarget;millMixer.timeScale=windSpeed;},get windTime(){return millMixer.time;},get windSpeed(){return windSpeed;},update(seconds){const dt=previous===null?0:Math.min(.06,Math.max(0,seconds-previous));previous=seconds;windSpeed+=(windTarget-windSpeed)*(1-Math.exp(-dt*.9));millMixer.timeScale=windSpeed;for(const mixer of mixers)mixer.update(dt);}};
}
