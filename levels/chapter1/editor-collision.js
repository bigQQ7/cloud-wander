import * as THREE from 'three';
import {zones,obstacles} from './physics.js?v=walk1';
export function makeEditorCollisionSync(surfaces,records){
 const sourceZones=zones.map(z=>JSON.parse(JSON.stringify(z))),sourceSurfaces=surfaces.map(s=>({...s})),sourceObstacles=obstacles.map(s=>({...s}));
 const names=['01 • Awakening stone gate','01 • Awakening stone gate','03 • Great windmill','03 • Keeper cottage','tree:4','04 • Ruins beneath the tree','05 • Tower of wind'];
 function delta(record){return record.object.matrixWorld.clone().multiply(record.initialWorld.clone().invert());}
 function transformSurface(base,m){const p=new THREE.Vector3(base.x,base.h,base.z).applyMatrix4(m),x=new THREE.Vector3().setFromMatrixColumn(m,0),z=new THREE.Vector3().setFromMatrixColumn(m,2);return {...base,x:p.x,z:p.z,h:p.y,rx:base.rx*x.length(),rz:base.rz*z.length(),yaw:(base.yaw||0)+Math.atan2(-x.z,x.x)};}
 return ({all,byKey,islands})=>{
  for(let i=0;i<zones.length;i++){
   const island=islands.find(r=>r.zone===i);if(!island)continue;const m=delta(island),z=sourceZones[i],next=transformSurface(z,m);Object.assign(zones[i],next);const spawn=new THREE.Vector3(z.spawn.x,z.spawn.y,z.spawn.z).applyMatrix4(m);zones[i].spawn={x:spawn.x,y:spawn.y,z:spawn.z};Object.assign(surfaces[i],transformSurface(sourceSurfaces[i],m));if(!island.object.visible||island.object.userData.removedWalkSurface)surfaces[i].h=-10000;
  }
  for(let i=4;i<surfaces.length;i++){
   const base=sourceSurfaces[i];if(!base)continue;let target=base.editorKey&&byKey.get(base.editorKey);
   if(!target)target=islands.find(r=>((base.x-r.center.x)/r.rx)**2+((base.z-r.center.z)/r.rz)**2<1&&Math.abs(base.h-r.center.y)<.8);
   if(target){Object.assign(surfaces[i],transformSurface(base,delta(target)));let visible=true;for(let p=target.object;p;p=p.parent)if(!p.visible)visible=false;if(!visible||target.object.userData.removedWalkSurface)surfaces[i].h=-10000;}
  }
  if(islands.some(r=>r.zone===0&&r.object.userData.removedWalkSurface))zones[0].spawn={...zones[1].spawn};
  for(let i=0;i<obstacles.length;i++){
   const record=byKey.get(names[i]);if(!record)continue;const base=sourceObstacles[i],m=delta(record),next=transformSurface(base,m);Object.assign(obstacles[i],next);let visible=true;for(let p=record.object;p;p=p.parent)if(!p.visible)visible=false;if(!visible)obstacles[i].h=-10000;
  }
 };
}
