import * as T from 'three';
/* 秋千：树模型自带的绳子和座板去掉，用代码重新做一副（座板、两根绳子），由代码控制前后荡，
   这样座板的大小、高度和角色坐的位置、身体倾斜都能精确对上。 */
const WOOD=new T.MeshStandardMaterial({color:'#9a6a3c',roughness:.85}),WOOD_TOP=new T.MeshStandardMaterial({color:'#b07c48',roughness:.8}),ROPE=new T.MeshStandardMaterial({color:'#cdb68a',roughness:.95});
export function createSwing({audio,scene,player,hero,getMode,toast}){
 const seats=[],v=new T.Vector3(),point=new T.Vector3();let built=false;
 function build(){built=true;const meshes=[];scene.traverse(o=>{if(o.isSkinnedMesh&&o.name==='Textured_Tree_and_Swing'){let vis=true;for(let a=o;a;a=a.parent)if(!a.visible)vis=false;if(vis)meshes.push(o);}});
 for(const mesh of meshes){let tree=mesh;while(tree.parent&&!/秋千树|茂盛树/.test(tree.name))tree=tree.parent;
  const j=mesh.skeleton.bones.findIndex(b=>b.name==='Swing_Pendulum');if(j<0)continue;const g=mesh.geometry,pos=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;if(!si)continue;
  const BI=mesh.skeleton.boneInverses[j],toBone=new T.Matrix4().multiplyMatrices(BI,mesh.bindMatrix),fromBone=toBone.clone().invert();
  // 1) 读出原秋千（只读一次，几棵树共用同一份几何体）
  if(!g.userData.swingLocal){const local=[],idx=[];for(let i=0;i<pos.count;i++){let w=0;for(let c=0;c<4;c++)if(si.getComponent(i,c)===j)w+=sw.getComponent(i,c);if(w<=0)continue;idx.push(i);if(w>=.9)local.push(v.fromBufferAttribute(pos,i).applyMatrix4(toBone).clone());}
   g.userData.swingLocal=local;
   // 2) 把原来的绳子和座板缩到挂点上（看不见了）
   const hide=new T.Vector3().applyMatrix4(fromBone);for(const i of idx)pos.setXYZ(i,hide.x,hide.y,hide.z);pos.needsUpdate=true;g.computeBoundingSphere();}
  const local=g.userData.swingLocal;if(local.length<10)continue;
  tree.updateMatrixWorld(true);const bone=mesh.skeleton.bones[j];
  const far=Math.max(...local.map(q=>q.length())),plank=local.filter(q=>q.length()>far*.9).map(q=>bone.localToWorld(q.clone())),pivot=bone.localToWorld(new T.Vector3()),cw=new T.Vector3();for(const q of plank)cw.add(q);cw.divideScalar(plank.length);
  // 座板长边方向 L（两根绳子之间）和朝向 f（与 L 垂直、背对树干）
  let xx=0,xz=0,zz=0;for(const q of plank){const dx=q.x-cw.x,dz=q.z-cw.z;xx+=dx*dx;xz+=dx*dz;zz+=dz*dz;}
  const ang=.5*Math.atan2(2*xz,xx-zz);let lx=Math.cos(ang),lz=Math.sin(ang),fx=-lz,fz=lx;
  const root=new T.Vector3();tree.getWorldPosition(root);if(fx*(cw.x-root.x)+fz*(cw.z-root.z)<0){fx=-fx;fz=-fz;}
  let wMin=1e9,wMax=-1e9;for(const q of plank){const t=(q.x-cw.x)*lx+(q.z-cw.z)*lz;wMin=Math.min(wMin,t);wMax=Math.max(wMax,t);}
  const W=.74,D=.42,TH=.09,R=Math.max(1,pivot.distanceTo(cw));
  // 3) 新秋千：挂点在原挂点正上方，摆动轴 = 座板长边
  // 原秋千绳子挂在树枝上的那一截（权重在树根骨骼上，上一步收不掉）：挂点正下方、座板以上的顶点也收掉
  if(!g.userData.ropeStubCleared){g.userData.ropeStubCleared=true;const k=mesh.skeleton.bones.findIndex(b=>b.name==='Tree_Root');if(k>=0){const rb=mesh.skeleton.bones[k],toW=new T.Matrix4().multiplyMatrices(rb.matrixWorld,new T.Matrix4().multiplyMatrices(mesh.skeleton.boneInverses[k],mesh.bindMatrix)),hidePos=new T.Vector3().applyMatrix4(fromBone);let n=0;
   for(let i=0;i<pos.count;i++){let w=0;for(let c=0;c<4;c++)if(si.getComponent(i,c)===k)w+=sw.getComponent(i,c);if(w<.5)continue;v.fromBufferAttribute(pos,i).applyMatrix4(toW);const below=pivot.y-v.y,side=Math.hypot(v.x-pivot.x,v.z-pivot.z);if(below>.12&&v.y>cw.y+.05&&side<.55){pos.setXYZ(i,hidePos.x,hidePos.y,hidePos.z);n++;}}
   if(n){pos.needsUpdate=true;g.computeBoundingSphere();}window.__ropeStub=n;}}
  const yaw=Math.atan2(fx,fz),hang=new T.Group();hang.name='代码秋千 · 挂点';hang.position.copy(pivot);hang.rotation.y=yaw;scene.add(hang);
  const swingArm=new T.Group();hang.add(swingArm);
  const board=new T.Mesh(new T.BoxGeometry(W,TH,D),WOOD);board.position.y=-R;board.castShadow=board.receiveShadow=true;swingArm.add(board);
  const top=new T.Mesh(new T.BoxGeometry(W*.96,.012,D*.9),WOOD_TOP);top.position.y=TH/2;board.add(top);
  const ropes=[];for(const side of [-1,1]){const x=side*(W/2-.08);const rope=new T.Mesh(new T.CylinderGeometry(.022,.022,R,6),ROPE);rope.position.set(x,-R/2,0);rope.castShadow=true;swingArm.add(rope);
   const knot=new T.Mesh(new T.TorusGeometry(.05,.018,6,10),ROPE);knot.position.set(x,-R+TH/2+.02,0);knot.rotation.x=Math.PI/2;swingArm.add(knot);ropes.push({rope,knot,x});}
  const seat=new T.Object3D();seat.name='秋千座位';seat.position.set(0,-R+TH/2,-.04);swingArm.add(seat);
  const gripL=new T.Object3D(),gripR=new T.Object3D();gripL.position.set(-(W/2-.08),-R+TH/2+.62,0);gripR.position.set(W/2-.08,-R+TH/2+.62,0);swingArm.add(gripL,gripR);
  seats.push({seat,yaw,top:0,R,W,D,TH,ropes,arm:swingArm,phase:Math.random()*6.28,amp:.12,grips:[gripL,gripR]});
 }}
 let seated=null,near=null,returnPos;
 /* 找一个不被柱子、树干挡住的机位：在角色前方几个角度里射线检测，选第一个看得见的 */
 const ray=new T.Raycaster();
 function pickCamera(s){s.seat.getWorldPosition(point);const from=new T.Vector3(point.x,point.y+.6,point.z),targets=[];scene.traverse(o=>{if(!o.isMesh||o.isSkinnedMesh||o.isInstancedMesh||!o.visible)return;for(let a=o;a;a=a.parent)if(!a.visible)return;targets.push(o);});
  s.camOff=.35;for(const off of [.35,-.35,0,.8,-.8,1.2,-1.2,1.6,-1.6]){const a=s.yaw+off,dir=new T.Vector3(Math.sin(a),.12,Math.cos(a)).normalize();ray.set(from,dir);ray.far=3.8;if(!ray.intersectObjects(targets,false).length){s.camOff=off;return;}}}
 function use(){if(seated){const leaving=seated;audio?.event?.('leave');seated=null;player.pos={...returnPos};player.vy=0;player.grounded=true;hero.clearInteraction();hero.setTilt?.(null);hero.setGrip?.(null);hero.setFist?.(false);for(const r of leaving.ropes){r.rope.position.set(r.x,-leaving.R/2,0);r.knot.position.set(r.x,-leaving.R+leaving.TH/2+.02,0);}hero.resetCamera?.();toast?.('已离开秋千');}else if(near){audio?.event?.('seat');returnPos={...player.pos};seated=near;hero.setInteraction('Seated',seated.yaw);seated.snapAt=.35;hero.setFist?.(true);pickCamera(seated);seated.snap=true;}}
 const eye=new T.Vector3(),look=new T.Vector3(),camLook=new T.Vector3();
 return {get seated(){return !!seated;},seats,
  /* 坐上秋千时的镜头：在角色正前方稍侧一点，低机位看着她荡 */
  shot(camera,dt){if(!seated)return false;seated.seat.getWorldPosition(point);const a=seated.yaw+(seated.camOff||0),fx=Math.sin(a),fz=Math.cos(a);eye.set(point.x+fx*3.6,point.y+1.05,point.z+fz*3.6);look.set(point.x,point.y+.45,point.z);const k=1-Math.exp(-dt*4);if(seated.snap||camera.position.distanceTo(eye)>8){seated.snap=false;camera.position.copy(eye);camLook.copy(look);}camera.position.lerp(eye,k);camLook.lerp(look,k);camera.lookAt(camLook);return true;},handleKey(e){if(e.repeat)return !!seated;if((seated&&['KeyE','Space','Escape'].includes(e.code))||(!seated&&near&&e.code==='KeyE')){e.preventDefault();use();return true;}return !!seated;},
  update(dt,time){if(!built&&getMode()==='walk')build();
   /* 秋千摆动：没人坐时轻轻晃，坐上去后荡得大一点 */for(const q of seats){q.amp+=((q===seated?.32:.1)-q.amp)*(1-Math.exp(-dt*.8));q.arm.rotation.x=Math.sin(time*2*Math.PI/2.8+q.phase)*q.amp;}
   near=null;if(!seated&&getMode()==='walk'&&player.grounded){let best=1.7;for(const s of seats){s.seat.getWorldPosition(point);const d=Math.hypot(player.pos.x-point.x,player.pos.z-point.z);if(d<best&&Math.abs(player.pos.y-(point.y-.5))<1.6){best=d;near=s;}}}
   window.CloudGuide?.setPrompt?.('swing',seated?'按 **E** 或 **空格** 离开秋千':near?'按 **E** 坐上秋千':null);
   if(seated){seated.seat.getWorldPosition(point);player.pos={x:point.x,y:point.y+seated.top-SIT,z:point.z};player.vy=0;player.grounded=true;
    hero.setTilt?.(seated.arm.rotation.x,SIT);
    /* 坐稳后把两根绳子挪到两只手的位置：看起来就是手握着绳子，不用硬掰手臂（硬掰会让手变形） */
    if(seated.snapAt>0){seated.snapAt-=dt;if(seated.snapAt<=0){const hands=hero.getHands?.();if(hands?.length===2){const loc=hands.map(h=>seated.arm.worldToLocal(h.clone())).sort((a,b)=>a.x-b.x);seated.ropes.slice().sort((a,b)=>a.x-b.x).forEach((r,i)=>{const h=loc[i],x=T.MathUtils.clamp(h.x,-seated.W/2+.05,seated.W/2-.05),z=T.MathUtils.clamp(h.z,-seated.D/2+.03,seated.D/2-.03);r.rope.position.set(x,-seated.R/2,z);r.knot.position.set(x,-seated.R+seated.TH/2+.02,z);});}}}}}};
}
const SIT=-.06;
