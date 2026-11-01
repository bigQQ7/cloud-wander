import * as THREE from 'three';
// Apply in character space, then reconstruct local transforms. The exported rig
// has disconnected deform chains, so ordinary spine parenting is insufficient.
export const GAIT={walk:{swing:.40,elbow:.12,lean:.035,twist:.14,roll:.075,bob:.020},run:{swing:.60,elbow:.42,lean:.14,twist:.18,roll:.095,bob:.032}};
export function createLocomotionLayer(model,root){
 const bones=[];model.traverse(b=>{if(b.isBone)bones.push(b);});
 const canonical=n=>n.replace(/[._]/g,'').toLowerCase();
 const byName=new Map(bones.map(b=>[canonical(b.name),b]));
 const find=n=>byName.get(canonical(n));
 const waist=find('spine_01.x');
 const records=bones.map(b=>({b,base:new THREE.Matrix4(),target:new THREE.Matrix4(),weight:0,side:null,forearm:false,position:new THREE.Vector3(),quaternion:new THREE.Quaternion(),scale:new THREE.Vector3()}));
 for(const r of records){
  let b=r.b;while(b?.isBone){const n=canonical(b.name);
   if(/^(armstretch|forearm|hand|carmtwistoffset)/.test(n)){r.side=n.endsWith('l')?'l':'r';r.forearm=/^(forearm|hand)/.test(n);r.weight=1;break;}
   if(n==='headx'||n==='neckx'){r.weight=.5;break;}
   if(n==='spine02x'||n.startsWith('shoulder')){r.weight=1;break;}
   if(n==='spine01x'){r.weight=.45;break;}b=b.parent;
  }
 }
 const recordFor=name=>records.find(r=>r.b===find(name));
 const targets=new Map(records.map(r=>[r.b,r.target]));
 const invRoot=new THREE.Matrix4(),parent=new THREE.Matrix4(),local=new THREE.Matrix4();
 const origin=new THREE.Vector3(),pivot=new THREE.Vector3(),q=new THREE.Quaternion(),euler=new THREE.Euler(),scale=new THREE.Vector3(1,1,1);
 const elbowMotion=new THREE.Matrix4(),pelvisMotion=new THREE.Matrix4();
 const motion=new THREE.Matrix4(),swing=new THREE.Matrix4(),shift=new THREE.Matrix4();
 let weight=0,runMix=0,phase=0,applied=false;
 const settings={...GAIT.walk};
 function around(out,p,x,y,z){q.setFromEuler(euler.set(x,y,z,'YXZ'));out.compose(p,q,scale);shift.makeTranslation(-p.x,-p.y,-p.z);out.multiply(shift);}
 return {restore(){
  // Three's mixer may skip unchanged keyframes. Remove the previous offset
  // before sampling, otherwise constant channels accumulate procedural motion.
  if(!applied)return;for(const r of records){r.b.position.copy(r.position);r.b.quaternion.copy(r.quaternion);r.b.scale.copy(r.scale);}applied=false;
 },update(dt,state,action,speed,allowed){
  const wanted=allowed&&(state==='Walk'||state==='Run')?Math.min(1,speed/1.5):0;
  weight+=(wanted-weight)*(1-Math.exp(-dt*10));
  // Interaction and airborne poses keep their authored contact/flight motion.
  if(!allowed){weight=0;return;}if(weight<.0001||!waist||!action)return;
  for(const r of records){r.position.copy(r.b.position);r.quaternion.copy(r.b.quaternion);r.scale.copy(r.b.scale);}applied=true;
  root.updateWorldMatrix(true,true);invRoot.copy(root.matrixWorld).invert();
  for(const r of records){r.base.multiplyMatrices(invRoot,r.b.matrixWorld);r.target.copy(r.base);}
  origin.setFromMatrixPosition(targets.get(waist));
  if(state==='Walk'||state==='Run')phase=action.time/action.getClip().duration*Math.PI*2;
  runMix+=((state==='Run'?1:0)-runMix)*(1-Math.exp(-dt*9));
  for(const key of Object.keys(settings))settings[key]=THREE.MathUtils.lerp(GAIT.walk[key],GAIT.run[key],runMix);
  const stride=Math.cos(phase);
  // Drive the arm counter-swing from the actual ankle position, including Run's
  // different authored phase, rather than assuming both clips share key times.
  const footRecord=side=>records.find(r=>r.b===find('foot.'+side));
  const left=footRecord('l'),right=footRecord('r');
  const opposition=left&&right?THREE.MathUtils.clamp((left.base.elements[14]-right.base.elements[14])/.38,-1,1):-stride;
  // The lower belly and shorts are weighted to root.x, not the spine. Give
  // the pelvis a small weight transfer; independent ankle targets stay fixed.
  pelvisMotion.identity();
  pelvisMotion.elements[12]+=.018*Math.sin(phase)*weight;
  pelvisMotion.elements[13]+=(settings.bob*.6*(1-Math.cos(phase*2))-.008)*weight;
  const pelvisRecord=recordFor('root.x');if(pelvisRecord)pelvisRecord.target.premultiply(pelvisMotion);
  for(const r of records){if(!r.weight)continue;
   const w=weight*r.weight;
   around(motion,origin,-settings.lean*w,-settings.twist*opposition*w,settings.roll*Math.sin(phase)*w);
   motion.elements[13]+=settings.bob*(1-Math.cos(phase*2))*w;
   if(r.side){const arm=find('arm_stretch.'+r.side),a=records.find(v=>v.b===arm);if(a){
    pivot.setFromMatrixPosition(a.base);
    // All arm and hand deform bones receive the same shoulder-space delta,
    // keeping the rounded wrist continuous instead of twisting it separately.
    if(r.forearm){const elbow=records.find(v=>v.b===find('forearm_stretch.'+r.side));if(elbow){
     const elbowPoint=new THREE.Vector3().setFromMatrixPosition(elbow.base);
     around(elbowMotion,elbowPoint,-settings.elbow*weight,0,0);r.target.premultiply(elbowMotion);
    }}
    around(swing,pivot,(r.side==='l'?1:-1)*settings.swing*opposition*weight,0,0);
    r.target.premultiply(swing);
   }}
   r.target.premultiply(motion).premultiply(pelvisMotion);
  }
  for(const r of records){
   if(targets.has(r.b.parent))parent.copy(targets.get(r.b.parent));
   else parent.multiplyMatrices(invRoot,r.b.parent.matrixWorld);
   local.copy(parent).invert().multiply(r.target);local.decompose(r.b.position,r.b.quaternion,r.b.scale);
  }
  root.updateWorldMatrix(true,true);
 }};
}
