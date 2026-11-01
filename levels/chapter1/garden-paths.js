import * as THREE from 'three';
export function createGardenPaths(scene,records,anchors,grass){
 scene.updateMatrixWorld(true);
 const groundMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
 const targets=records.filter(r=>/sculpted Tripo cliff/.test(r.name)&&r.geometry).map(r=>{const mesh=new THREE.Mesh(r.geometry,groundMaterial);mesh.matrixAutoUpdate=false;mesh.matrixWorld.copy(r.object.matrixWorld);return {mesh,parent:r.object.parent};});
 const positions=anchors.map(o=>o.getWorldPosition(new THREE.Vector3()));
 const origin=positions[0],forward=positions[1].clone().sub(origin);forward.y=0;const span=forward.length();forward.normalize();const right=new THREE.Vector3(forward.z,0,-forward.x);
 const unit=THREE.MathUtils.clamp(span/18,.65,1.45);
 const point=(x,z)=>origin.clone().addScaledVector(right,x*unit).addScaledVector(forward,z*unit);
 const smooth=(points,closed=false)=>new THREE.CatmullRomCurve3(points.map(p=>point(...p)),closed,'centripetal');
 const pondLeft=positions[2].clone().addScaledVector(right,-3.5);
 const curves=[
 smooth([[-6,3],[-5,9],[-1,12],[5,11],[9,8],[7,4],[2,3]],true),
 smooth([[-12,2],[-9,1],[-6,3]]),
 smooth([[9,8],[13,8],[17,10],[20,15]]),
 smooth([[5,3],[6,-2],[10,-4],[14,-2],[16,3],[13,8]]),
 new THREE.CatmullRomCurve3([point(-6,1),point(-10,-5),pondLeft.clone().addScaledVector(right,-2).addScaledVector(forward,3),pondLeft],false,'centripetal')
 ];
 const ray=new THREE.Raycaster(),normalMatrix=new THREE.Matrix3(),matrix=new THREE.Object3D(),buckets=new Map(),route=[];
 let seed=721;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(const path of curves){const count=Math.ceil(path.getLength()/.65);for(let i=0;i<=count;i++){const t=i/count,p=path.getPoint(t),direction=path.getTangent(t);for(let side=-1;side<=1;side++){const x=p.x-direction.z*side*.49+(random()-.5)*.09,z=p.z+direction.x*side*.49+(random()-.5)*.09;ray.set(new THREE.Vector3(x,p.y+8,z),new THREE.Vector3(0,-1,0));const hits=targets.flatMap(target=>ray.intersectObject(target.mesh,false).filter(h=>h.face.normal.clone().applyMatrix3(normalMatrix.getNormalMatrix(target.mesh.matrixWorld)).normalize().y>.78).map(hit=>({...hit,parent:target.parent}))).sort((a,b)=>b.point.y-a.point.y);if(!hits.length)continue;const hit=hits[0];if(Math.abs(hit.point.y-p.y)>4)continue;
 matrix.position.copy(hit.point);matrix.position.y+=.025;matrix.rotation.set(0,Math.atan2(direction.x,direction.z)+(random()-.5)*.17,0);matrix.scale.set(.43+random()*.08,.065,.53+random()*.1);matrix.updateMatrix();const local=new THREE.Matrix4().copy(hit.parent.matrixWorld).invert().multiply(matrix.matrix);if(!buckets.has(hit.parent))buckets.set(hit.parent,[]);buckets.get(hit.parent).push(local);route.push(hit.point.clone());}}}
 const geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardMaterial({color:'#cbb58b',roughness:.95});
 for(const [parent,transforms] of buckets){const mesh=new THREE.InstancedMesh(geometry,material,transforms.length);mesh.name='花园石子路';mesh.receiveShadow=true;transforms.forEach((m,i)=>{mesh.setMatrixAt(i,m);mesh.setColorAt(i,new THREE.Color().setHSL(.105+random()*.015,.22+random()*.1,.57+random()*.15));});mesh.computeBoundingSphere();parent.add(mesh);}
 const tiles=new Map();for(const p of route){const key=Math.floor(p.x)+','+Math.floor(p.z);if(!tiles.has(key))tiles.set(key,[]);tiles.get(key).push(p);}
 const m=new THREE.Matrix4(),p=new THREE.Vector3();for(const mesh of grass){for(let i=0;i<mesh.instanceMatrix.count;i++){mesh.getMatrixAt(i,m);p.setFromMatrixPosition(m).applyMatrix4(mesh.matrixWorld);let clear=false;for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)if((tiles.get((Math.floor(p.x)+x)+','+(Math.floor(p.z)+z))||[]).some(q=>Math.abs(q.y-p.y)<1&&Math.hypot(q.x-p.x,q.z-p.z)<.4))clear=true;if(clear){m.scale(new THREE.Vector3(0,0,0));mesh.setMatrixAt(i,m);}}mesh.instanceMatrix.needsUpdate=true;}
 groundMaterial.dispose();return {count:route.length};
}
