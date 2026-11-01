export function checkClearance({T,world,mesh,westBridge,returnBridge,iceCurve,stairStart,stairEnd,stairRun,stairRise,stairCount}){
 const routes=[];
 const route=(name,points,width)=>routes.push({name,points,width});
 route('中央南门',[[0,0,0],[0,0,8.7]],3);
 route('中央北口',[[0,0,0],[0,0,stairStart]],2.8);
 route('花廊与云台入口',[[-2,0,0],[-5,0,.5],[-5,0,5],[-8,0,3]],1.8);
 route('中央西桥入口',[[0,0,0],[-7,0,-5.4]],2);
 route('中央东南桥入口',[[0,0,0],[6,0,5.8]],2);
 route('中央花台入口',[[0,0,0],[7.8,0,-3.8]],1.8);
 route('西庭院桥口',[[-16.3,2,-11],[-19.8,2,-10.5],[-22,2,-8.7]],2.5);
 route('西庭院云台口',[[-20,2,-8],[-22,2,-8.7]],1.8);
 route('北岛落台',[[0,4,stairEnd],[0,4,-21]],3);
 route('东岛花台口',[[16.8,5,-11.8],[18,5,-12.6],[19.5,5,-12.6]],1.8);
 route('机关操作通路',[[20.5,5,-14.1],[21.4,5,-15.5]],1.2);
 route('推箱台阶入口',[[17,5,-11.8],[19.5,5,-11.1],[19.5,5.95,-13.2]],1.8);
 route('东岛冰坡入口',[[21.6,5,-13.8],[23,5,-13]],2.6);
 route('回归落台',[[13.4,0,6],[17,0,5],[20,0,4]],2.8);
 for(const [name,c,w]of [['西拱桥',westBridge,2.7],['回归桥',returnBridge,2.8],['冰坡',iceCurve,2.6]])route(name,Array.from({length:41},(_,i)=>c.getPoint(i/40).toArray()),w);
 route('北楼梯',[[0,0,stairStart],[0,4,stairEnd]],2.8);
 // Segment-versus-expanded-rectangle slab test, including the traversable body-height band.
 function hits(box,r){for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i];if(box.max.y<Math.min(a[1],b[1])+.08||box.min.y>Math.max(a[1],b[1])+2)continue;let lo=0,hi=1;for(const [axis,j]of [['x',0],['z',2]]){const mn=box.min[axis]-r.width/2-.12,mx=box.max[axis]+r.width/2+.12,d=b[j]-a[j];if(Math.abs(d)<1e-8){if(a[j]<mn||a[j]>mx){hi=-1;break;}}else{let t1=(mn-a[j])/d,t2=(mx-a[j])/d;if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);}}if(lo<=hi&&hi>=0&&lo<=1)return true;}return false;}
 const removed=[],removedObjects=[],moved=[],relocated=[];const plants=new Set([30,32,34,35,36]);world.updateMatrixWorld(true);
 for(const o of [...world.children]){if(!plants.has(o.userData.assetId))continue;const box=new T.Box3().setFromObject(o),r=routes.find(r=>hits(box,r));if(!r)continue;removed.push({asset:o.userData.assetId,at:o.position.toArray(),route:r.name});world.remove(o);removedObjects.push(o);}
 const islands=[{x:0,z:0,r:9,y:0},{x:-22,z:-12,r:6,y:2},{x:20,z:-15,r:5.5,y:5},{x:0,z:-22,r:4,y:4},{x:17,z:5,r:4,y:0}];
 for(const o of world.children){if(![23,33].includes(o.userData.assetId))continue;const original=o.position.clone();let changed=false;for(let attempt=0;attempt<10;attempt++){world.updateMatrixWorld(true);const box=new T.Box3().setFromObject(o),r=routes.find(r=>hits(box,r));if(!r)break;let nearest=null,dist=Infinity;for(let i=1;i<r.points.length;i++){const a=new T.Vector2(r.points[i-1][0],r.points[i-1][2]),b=new T.Vector2(r.points[i][0],r.points[i][2]),p=new T.Vector2(o.position.x,o.position.z),d=b.clone().sub(a),t=T.MathUtils.clamp(p.clone().sub(a).dot(d)/Math.max(d.lengthSq(),1e-8),0,1),q=a.addScaledVector(d,t),gap=p.distanceTo(q);if(gap<dist){dist=gap;let v=p.sub(q);if(v.length()<.01)v=new T.Vector2(-d.y,d.x);nearest=v.normalize();}}const candidate=o.position.clone().add(new T.Vector3(nearest.x*.35,0,nearest.y*.35));const island=islands.find(d=>Math.abs(original.y-d.y)<.5&&Math.hypot(original.x-d.x,original.z-d.z)<d.r);if(island&&Math.hypot(candidate.x-island.x,candidate.z-island.z)>island.r-.45)break;o.position.copy(candidate);changed=true;}if(changed)moved.push({asset:o.userData.assetId,from:original.toArray(),to:o.position.toArray()});}

 // If a lamp/column cannot move farther outward, choose a safe supported perimeter position.
 for(const o of [...world.children])if([23,33].includes(o.userData.assetId)){
  if(!routes.some(r=>hits(new T.Box3().setFromObject(o),r)))continue;
  const old=o.position.clone(),island=islands.find(d=>Math.abs(old.y-d.y)<.5&&Math.hypot(old.x-d.x,old.z-d.z)<d.r+.2);if(!island)continue;
  const candidates=Array.from({length:96},(_,i)=>{const a=i/96*Math.PI*2;return new T.Vector3(island.x+Math.cos(a)*(island.r-.75),old.y,island.z+Math.sin(a)*(island.r-.75));}).sort((a,b)=>a.distanceToSquared(old)-b.distanceToSquared(old));
  let ok=false;for(const p of candidates){o.position.copy(p);o.updateMatrixWorld(true);if(!routes.some(r=>hits(new T.Box3().setFromObject(o),r))){ok=true;moved.push({asset:o.userData.assetId,from:old.toArray(),to:p.toArray(),reason:'safe perimeter placement'});break;}}
  if(!ok){o.position.copy(old);if(o.userData.assetId===33){world.remove(o);removed.push({asset:33,at:old.toArray(),route:'no supported safe lamp position'});}}
 }
 // Replant at a smaller scale in supported edge beds, preserving every reserved passage.
 for(const o of removedObjects){const old=o.position.clone(),island=islands.find(d=>Math.abs(old.y-d.y)<1.6&&Math.hypot(old.x-d.x,old.z-d.z)<d.r+2);if(!island)continue;const scale=o.scale.clone();o.scale.multiplyScalar(.68);
  const candidates=[];for(const rad of [island.r-.35,island.r-1.2,island.r-2.1])for(let i=0;i<96;i++){const a=i/96*Math.PI*2;candidates.push(new T.Vector3(island.x+Math.cos(a)*rad,old.y,island.z+Math.sin(a)*rad));}candidates.sort((a,b)=>a.distanceToSquared(old)-b.distanceToSquared(old));
  let ok=false;for(const p of candidates){if(world.children.some(q=>plants.has(q.userData.assetId)&&Math.abs(q.position.y-p.y)<.5&&Math.hypot(q.position.x-p.x,q.position.z-p.z)<.75))continue;o.position.copy(p);o.updateMatrixWorld(true);if(routes.some(r=>hits(new T.Box3().setFromObject(o),r)))continue;world.add(o);relocated.push({asset:o.userData.assetId,from:old.toArray(),to:p.toArray(),scale:.68});ok=true;break;}
  if(!ok){o.position.copy(old);o.scale.copy(scale);}
 }
 world.updateMatrixWorld(true);
 const remainingPlants=[];for(const o of world.children)if(plants.has(o.userData.assetId)){const r=routes.find(r=>hits(new T.Box3().setFromObject(o),r));if(r)remainingPlants.push({asset:o.userData.assetId,route:r.name});}
 const fixtureConflicts=[];for(const o of world.children)if([17,15,22,39,23,33,28,37,43].includes(o.userData.assetId)){const r=routes.find(r=>hits(new T.Box3().setFromObject(o),r));if(r)fixtureConflicts.push({asset:o.userData.assetId,at:o.position.toArray(),route:r.name});}
 const unsupportedTiles=[];for(const o of world.children)if(o.userData.assetId===27){const p=o.position;const onIsland=islands.some(d=>Math.abs(p.y-d.y)<.13&&Math.hypot(p.x-d.x,p.z-d.z)<d.r-.6);const onPlatform=Math.abs(p.y-5.925)<.04&&Math.abs(p.x-19.5)<1.4&&Math.abs(p.z+14.5)<1.4;if(!onIsland&&!onPlatform)unsupportedTiles.push(p.toArray());}
 const overlay=new T.Group();overlay.name='Reserved passage overlay';overlay.visible=false;const ma=new T.MeshBasicMaterial({color:'#29e7ad',transparent:true,opacity:.34,depthWrite:false,side:T.DoubleSide});for(const r of routes)for(let i=1;i<r.points.length;i++){const a=new T.Vector3(...r.points[i-1]),b=new T.Vector3(...r.points[i]),delta=b.clone().sub(a),center=a.clone().add(b).multiplyScalar(.5);const g=new T.PlaneGeometry(r.width,delta.length());const m=new T.Mesh(g,ma);m.position.copy(center);m.position.y+=.12;m.rotation.x=-Math.PI/2;m.rotation.z=Math.atan2(delta.x,delta.z);overlay.add(m);}world.add(overlay);document.querySelector('#clearance-toggle').onclick=()=>overlay.visible=!overlay.visible;
 const bridgeLandings=[];for(const [name,curve,width,start,end]of [['west',westBridge,2.7,islands[0],islands[1]],['return',returnBridge,2.8,islands[0],islands[4]],['ice',iceCurve,2.6,islands[2],islands[4]]])for(const [t,island]of [[0,start],[1,end]]){const p=curve.getPoint(t),tan=curve.getTangent(t),n=new T.Vector3(-tan.z,0,tan.x).normalize();const radius=Math.max(...[-1,1].map(sign=>{const q=p.clone().addScaledVector(n,sign*width/2);return Math.hypot(q.x-island.x,q.z-island.z);}));bridgeLandings.push({name,end:t===0?'start':'end',maxCornerRadius:radius,islandRadius:island.r,supported:radius<=island.r+.01,heightDifference:p.y-island.y});}
 const report={reservedRoutes:routes.length,clearedOriginalPlacements:removed,relocatedVegetation:relocated,removedVegetationCount:removedObjects.length-relocated.length,movedFixtures:moved,remainingVegetationConflicts:remainingPlants,fixtureConflicts,unsupportedTiles,bridgeLandings,stairs:{landingCornersSupported:Math.hypot(1.4,stairStart)<=9&&Math.hypot(1.4,stairEnd+22)<=4,start:stairStart,end:stairEnd,count:stairCount,run:stairRun,rise:stairRise,width:2.8,firstRise:stairRise,lastTop:4},notes:'Conservative world-AABB corridor check at standing height. Does not replace triangle collision or character playtesting; gates and arches excluded as intentional portal structures.'};
 const el=document.createElement('pre');el.hidden=true;el.id='clearance-report';el.textContent=JSON.stringify(report);document.body.append(el);
 const dl=document.createElement('button');dl.textContent='导出通道自测';dl.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='clearance-report.json';a.click();URL.revokeObjectURL(url);};document.querySelector('footer').append(dl);
 return report;
}
