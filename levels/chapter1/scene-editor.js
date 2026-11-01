import * as THREE from 'three';
import {clone as cloneRig} from './vendor/SkeletonUtils.js';
import {TransformControls} from './vendor/TransformControls.js';
import {SCENE_ID,validateSceneLayout} from './layout-data.js?v=mvp3';
import {DEFAULT_LAYOUT,MAIN_ISLAND_LAYOUT} from './default-layout.js?v=stairs1';
const storageKey='cloud-awakening-layout-reference-composition1',sceneId=SCENE_ID;
const state=o=>({p:o.position.toArray(),q:o.quaternion.toArray(),s:o.scale.toArray(),v:o.visible});
const put=(o,s)=>{o.position.fromArray(s.p);o.quaternion.fromArray(s.q);o.scale.fromArray(s.s);o.visible=s.v!==false;};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const names=[[/Awakening stone gate/,'苏醒草坡 · 石门'],[/Great windmill/,'风车高台 · 大风车'],[/Keeper cottage/,'风车高台 · 小屋'],[/Ruins beneath/,'回声树屋 · 遗迹'],[/Tower of wind$/,'风之塔 · 塔楼'],[/Memory stone/,'记忆石'],[/Ancient pillar/,'石柱'],[/Direction marker/,'路牌'],[/Windmill fence/,'木栅栏'],[/Hanging wind chime/,'风铃'],[/aged limestone/,'石路'],[/loose rock/,'散石'],[/Jumping cloud|Cloud crossing|Final ascent/,'云台']];
export function createSceneEditor({scene,camera,canvas,controls,renderer,sun,records,beds,trees,grass,surfaces,onEnter,onExit,onChanged}){
 const ui=document.querySelector('#sceneEditor'),toggle=document.querySelector('#editScene'),list=ui.querySelector('#elementList'),search=ui.querySelector('#elementSearch'),category=ui.querySelector('#elementCategory');
 const status=ui.querySelector('#editorStatus'),gizmo=new TransformControls(camera,canvas);gizmo.enabled=false;gizmo.setSize(.85);gizmo.setSpace('world');const helper=gizmo.getHelper();helper.visible=false;scene.add(helper);
 const all=[],byKey=new Map(),islands=[],pickMeshes=[],pickMap=new Map();let active=false,selected=null,beforeDrag=null,wasGizmo=false,down=null,saved='',undos=[],redos=[];
 const alert=text=>{status.textContent=text;};
 const add=r=>{if(byKey.has(r.key))throw new Error('重复场景元素');all.push(r);byKey.set(r.key,r);return r;};
 for(const r of records){r.kind=/• meadow|sculpted Tripo cliff|trailing moss|Intermediate stepping island/.test(r.name)?'terrain':/cloud|Cloud/.test(r.name)?'cloud':r.group==='02 • Architecture'?'building':'detail';r.label=(names.find(([re])=>re.test(r.name))?.[1]||r.name.replace(/^\d+\s*[•·]?\s*/,''))+' · '+r.name.split('.').slice(1).join('.');r.label=r.label.replace(/ · $/,'');add(r);}
 for(const [i,object] of trees.entries()){const r=add({key:'tree:'+i,name:object.name,label:i===4?'回声树屋 · 大树':'主树 '+(i+1),kind:'tree',object,direct:true});object.traverse(o=>{if(o.isMesh){pickMeshes.push(o);pickMap.set(o,r);}});}
 scene.updateMatrixWorld(true);
 for(const [i,bed] of beds.entries()){
  const box=new THREE.Box3().setFromObject(bed.mesh),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());center.y=Math.max(...bed.topVertices.map(v=>v.y));
  const group=new THREE.Group();group.position.copy(center);group.name=bed.mesh.name;scene.add(group);
  const prefixes=['01 Awakening meadow','03 Windmill terrace','04 Echo tree sanctuary','05 Tower of wind'];const zone=prefixes.findIndex(p=>bed.mesh.name.startsWith(p));
  const label=zone>=0?['苏醒草坡','风车高台','回声树屋','风之塔'][zone]:'中间浮岛 '+(islands.filter(r=>r.zone<0).length+1);
  const r=add({key:'island:'+bed.sourceName,label:label+'（整座岛）',name:label,kind:'island',object:group,direct:true,zone,sourceName:bed.sourceName,center:center.clone(),rx:size.x/2,rz:size.z/2,prefix:bed.sourceName.replace(/ • meadow.*$/,'')});
  islands.push(r);group.attach(bed.mesh);pickMeshes.push(bed.mesh);pickMap.set(bed.mesh,r);
 }
 const boxFor=r=>r.geometry? r.geometry.boundingBox.clone().applyMatrix4(r.object.matrixWorld):new THREE.Box3().setFromObject(r.object);
 for(const r of all.filter(r=>r.kind!=='island')){
  scene.updateMatrixWorld(true);const c=boxFor(r).getCenter(new THREE.Vector3());
  let parent=islands.find(i=>r.name===i.sourceName||(i.zone>=0&&r.name.startsWith(i.prefix)));
  if(!parent&&!/^(Sky archipelago|Sun disk|Route • floating mote)/.test(r.name)){let best=1.25;for(const i of islands){const d=((c.x-i.center.x)/i.rx)**2+((c.z-i.center.z)/i.rz)**2;if(d<best){best=d;parent=i;}}}
  if(parent)parent.object.attach(r.object);
  if(r.direct&&r.kind!=='tree'){r.object.traverse(o=>{if(o.isMesh){pickMeshes.push(o);pickMap.set(o,r);}});}
  if(!r.direct){if(!pickMap.has(r.mesh)){pickMeshes.push(r.mesh);pickMap.set(r.mesh,new Map());}pickMap.get(r.mesh).set(r.index,r.kind==='terrain'&&parent?parent:r);}
 }
 for(const object of grass){const zone=['苏醒草坡','风车高台','回声树屋','风之塔'].findIndex(n=>object.name.startsWith(n));const parent=islands.find(i=>i.zone===zone);if(parent)parent.object.attach(object);}
 scene.updateMatrixWorld(true);for(const r of all){r.base=state(r.object);r.initialWorld=r.object.matrixWorld.clone();}

 for(const [index,object] of grass.entries()){add({key:'grass:'+index,name:object.name,label:object.name,kind:'detail',object,direct:true,base:state(object),initialWorld:object.matrixWorld.clone()});}
 let scope=null,serial=0;
 const belongs=(r,i)=>{for(let o=r.object;o;o=o.parent)if(o===i.object)return true;return false;};
 for(const i of islands)i.object.userData.editorIsland=i.key;
 const panel=document.createElement('section');panel.className='asset-library';panel.innerHTML=`<div class="library-title">素材仓库 <small>拖到岛面添加 · 也可点击添加</small></div><label>编辑范围<select id="islandScope"><option value="">整个云端场景</option></select></label><label class="ground-toggle"><input id="autoGround" type="checkbox" checked> 自动贴合岛面</label><input id="assetSearch" type="search" placeholder="搜索素材仓库"><div id="assetShelf"></div><div class="library-actions"><button id="duplicateAsset">复制所选</button><button id="removeAsset">移除所选</button><button id="groundAsset">贴到地面</button></div><p id="placementHint">拖入素材后，用彩色轴微调位置。</p>`;
 ui.querySelector('.editor-hint').after(panel);
 const shelf=panel.querySelector('#assetShelf'),scopeSelect=panel.querySelector('#islandScope'),autoGround=panel.querySelector('#autoGround');
 for(const i of islands.filter(i=>i.zone>=0)){const o=document.createElement('option');o.value=i.key;o.textContent=i.name+' · 单独编辑';scopeSelect.append(o);}
 function setScope(i){scope=i;scopeSelect.value=i?.key||'';for(const r of all.filter(r=>r.direct)){r.object.traverse(o=>{if(o.isMesh)o.layers.set(!i||r===i||belongs(r,i)?0:1);});}for(const o of grass){o.layers.set(!i||o.parent===i.object?0:1);}sync();fillList();if(i)select(i,true);canvas.dataset.editorIsland=i?.name||'全部';alert(i?'正在单独编辑 '+i.name+'，新增素材会归入这座岛。':'正在编辑整个场景');}
 scopeSelect.onchange=()=>setScope(byKey.get(scopeSelect.value)||null);
 function ground(r){
 if(!r||['island','terrain','cloud'].includes(r.kind))return false;
 scene.updateMatrixWorld(true);const box=boxFor(r),center=box.getCenter(new THREE.Vector3()),ray=new THREE.Raycaster(new THREE.Vector3(center.x,box.max.y+100,center.z),new THREE.Vector3(0,-1,0));
 const targets=[];
 for(const record of records){if(!/sculpted Tripo cliff/.test(record.name)||!record.geometry)continue;const island=islands.find(i=>belongs(record,i));if(scope&&island!==scope)continue;const mesh=new THREE.Mesh(record.geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.matrixAutoUpdate=false;mesh.matrixWorld.copy(record.object.matrixWorld);targets.push({mesh,island});}
 for(const record of all.filter(item=>item.islandCopy)){record.object.traverse(o=>{if(o.isMesh&&/sculpted Tripo cliff/.test(o.name))targets.push({mesh:o,island:record});});}
 const hits=targets.flatMap(({mesh,island})=>ray.intersectObject(mesh,false).filter(h=>h.face.normal.clone().transformDirection(mesh.matrixWorld).y>.55).map(h=>({...h,island}))).sort((a,b)=>b.point.y-a.point.y);
 if(!hits.length)return false;const hit=hits[0];if(hit.island&&r.object.parent!==hit.island.object)hit.island.object.attach(r.object);
 const world=r.object.getWorldPosition(new THREE.Vector3());world.y+=hit.point.y-(r.object.userData.groundAnchor==='shoreline'?world.y:box.min.y)+.008;r.object.position.copy(r.object.parent.worldToLocal(world));scene.updateMatrixWorld(true);return true;
 }
 function spawn(template,island,point,key){if(template?.kind==='island'){
 scene.updateMatrixWorld(true);const object=cloneRig(template.object),source=[],cloned=[];template.object.traverse(o=>source.push(o));object.traverse(o=>cloned.push(o));
 for(const item of records){const i=source.indexOf(item.object);if(i<0||item.direct)continue;const proxy=cloned[i],part=new THREE.Mesh(item.geometry,item.mesh.material);part.name=item.name;part.position.copy(proxy.position);part.quaternion.copy(proxy.quaternion);part.scale.copy(proxy.scale);part.visible=proxy.visible;part.castShadow=item.mesh.castShadow;part.receiveShadow=true;proxy.parent.add(part);proxy.removeFromParent();}
 object.name=template.name+' · 整岛副本';template.object.matrixWorld.decompose(object.position,object.quaternion,object.scale);if(point)object.position.copy(point);scene.add(object);
 const r=add({key:key||'added:'+Date.now().toString(36)+':'+serial++,name:object.name,label:object.name,kind:'island',object,direct:true,added:true,asset:template.asset||template.key,islandCopy:true});r.base=state(object);r.initialWorld=object.matrixWorld.clone();r.pickObjects=[];object.traverse(o=>{if(o.isMesh){o.layers.set(0);pickMeshes.push(o);pickMap.set(o,r);r.pickObjects.push(o);}});return r;
 }if(template?.key==='tree:4')template=byKey.get('04 • Editable treehouse')||template;if(!template||!island)return null;const object=template.object.isInstancedMesh?new THREE.InstancedMesh(template.object.geometry,template.object.material,1):template.direct?cloneRig(template.object):new THREE.InstancedMesh(template.geometry,template.mesh.material,1);if(object.isInstancedMesh)object.setMatrixAt(0,new THREE.Matrix4());object.castShadow=template.object.castShadow||template.mesh?.castShadow||false;object.receiveShadow=true;object.name=template.name+' · 副本';object.visible=true;if(template.key==='04 • Editable treehouse')object.traverse(o=>{o.visible=true;});scene.updateMatrixWorld(true);template.initialWorld.decompose(object.position,object.quaternion,object.scale);island.object.attach(object);const r=add({key:key||'added:'+Date.now().toString(36)+':'+serial++,name:object.name,label:template.label+' · 新增',kind:template.kind,object,direct:true,added:true,asset:template.asset||template.key});if(point){object.position.copy(island.object.worldToLocal(point.clone()));}else object.position.set(0,0,0);r.base=state(object);scene.updateMatrixWorld(true);r.initialWorld=object.matrixWorld.clone();r.pickObjects=[];object.traverse(o=>{if(o.isMesh){pickMeshes.push(o);pickMap.set(o,r);r.pickObjects.push(o);o.layers.set(0);}});return r;}
 const templates=[],seenAssets=new Set();for(const r of all.filter(r=>r.kind!=='island'&&r.key!=='tree:4')){const id=r.geometry?'mesh:'+r.mesh.geometry.uuid+':'+r.kind:r.key;if(seenAssets.has(id))continue;seenAssets.add(id);templates.push(r);}
 function fillShelf(){const q=panel.querySelector('#assetSearch').value.toLowerCase();shelf.replaceChildren();for(const r of templates){if(q&&!`${r.label} ${r.name}`.toLowerCase().includes(q))continue;const b=document.createElement('button');b.type='button';b.draggable=true;b.textContent=r.label;b.title='拖入岛面，或点击添加';b.dataset.asset=r.key;b.ondragstart=e=>{e.dataTransfer.setData('text/cloud-asset',r.key);e.dataTransfer.effectAllowed='copy';};b.onclick=()=>place(r,null);shelf.append(b);}}
 function place(template,point,island){island=island||scope||islands.find(i=>selected&&belongs(selected,i))||islands.find(i=>i.zone===0);change(()=>{const r=spawn(template,island,point);if(autoGround.checked)ground(r);select(r);});fillList();select(selected);alert('已添加 '+template.label+'，可拖动、复制或移除。');}
 panel.querySelector('#assetSearch').oninput=fillShelf;fillShelf();
 canvas.addEventListener('dragover',e=>{if(active){e.preventDefault();e.dataTransfer.dropEffect='copy';}});canvas.addEventListener('drop',e=>{if(!active)return;e.preventDefault();const template=byKey.get(e.dataTransfer.getData('text/cloud-asset'));if(!template)return;const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const targets=islands.filter(i=>!scope||i===scope).map(i=>({i,bed:beds.find(b=>b.sourceName===i.sourceName)}));const hits=targets.flatMap(({i,bed})=>ray.intersectObject(bed.mesh,false).map(hit=>({...hit,island:i}))).sort((a,b)=>a.distance-b.distance);if(!hits.length){alert('请把素材拖到可见的岛面上。');return;}place(template,hits[0].point,hits[0].island);});
 function removeSelected(){if(!selected)return;change(()=>selected.object.visible=false);alert('已移除所选元素，可撤销恢复。');}
 panel.querySelector('#removeAsset').onclick=removeSelected;panel.querySelector('#duplicateAsset').onclick=()=>{if(!selected){alert('请先选中一个素材或整座岛。');return;}if(selected.kind==='island'){const source=selected;change(()=>{const p=source.object.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(30,0,0));const r=spawn(source,source,p);select(r);});fillList();alert('已复制整座岛，可拖动到目标位置并保存布局。');return;}const p=selected.object.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(1,0,0));place(byKey.get(selected.asset)||selected,p);};panel.querySelector('#groundAsset').onclick=()=>{let ok=false;change(()=>{ok=ground(selected);});alert(ok?'已将素材底部贴合岛面。':'请选中岛上的建筑、树木或装饰。');};
 const snapshot=()=>{const changes={};for(const r of all){const s=state(r.object);if(r.added){if(r.object.visible)changes[r.key]={...s,asset:r.asset,parent:r.islandCopy?r.asset:r.object.parent.userData.editorIsland};}else if(!equal(s,r.base))changes[r.key]=s;}return changes;};
 const serialize=()=>JSON.stringify(snapshot());
 const sync=()=>{
 const isOldBase=name=>!/^05 Tower/.test(name)&&(/• meadow(?:\.\d+)?$/.test(name)||/continuous soil and rock foundation$/.test(name)||name==='Central lower terrace meadow');
 for(const r of records)if(isOldBase(r.name))r.object.visible=false;
 scene.traverse(o=>{if(o.isMesh&&isOldBase(o.name))o.visible=false;});
 scene.updateMatrixWorld(true);const meshes=new Set();for(const r of records){if(r.direct)continue;let visible=true;for(let p=r.object;p;p=p.parent)if(!p.visible){visible=false;break;}const m=r.object.matrixWorld.clone();if(scope&&!belongs(r,scope))visible=false;if(!visible)m.scale(new THREE.Vector3(0,0,0));r.mesh.setMatrixAt(r.index,m);meshes.add(r.mesh);}for(const mesh of meshes){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}sun.shadow.needsUpdate=true;onChanged({all,byKey,islands});canvas.dataset.layoutChanges=String(Object.keys(snapshot()).length);refreshFields();};
 const restore=changes=>{select(null);for(const r of [...all].filter(r=>r.added)){r.object.removeFromParent();all.splice(all.indexOf(r),1);byKey.delete(r.key);for(const mesh of r.pickObjects||[]){pickMap.delete(mesh);pickMeshes.splice(pickMeshes.indexOf(mesh),1);}}for(const [key,s] of Object.entries(changes))if(s.asset)spawn(byKey.get(s.asset),byKey.get(s.parent),null,key);for(const r of all)put(r.object,r.base);for(const [key,s] of Object.entries(changes)){const r=byKey.get(key);if(r)put(r.object,s);}sync();fillList();};
 const remember=prior=>{if(equal(prior,snapshot()))return;undos.push(prior);if(undos.length>50)undos.shift();redos=[];updateButtons();};
 const change=fn=>{const prior=snapshot();fn();sync();remember(prior);};
 const updateButtons=()=>{ui.querySelector('#undoEdit').disabled=!undos.length;ui.querySelector('#redoEdit').disabled=!redos.length;};
 function refreshFields(){if(!selected)return;const o=selected.object;ui.querySelector('#selectedName').textContent=selected.label;for(const axis of ['x','y','z']){const el=ui.querySelector('#position'+axis);if(document.activeElement!==el)el.value=o.position[axis].toFixed(2);}if(document.activeElement!==ui.querySelector('#rotationY'))ui.querySelector('#rotationY').value=THREE.MathUtils.radToDeg(o.rotation.y).toFixed(1);if(document.activeElement!==ui.querySelector('#objectScale'))ui.querySelector('#objectScale').value=(o.scale.x/selected.base.s[0]).toFixed(3);ui.querySelector('#visibleElement').checked=o.visible;ui.querySelector('#editorDirty').textContent=serialize()===saved?'布局已保存':'有未保存的调整';}
 function select(r,focus=false){selected=r;gizmo.detach();ui.querySelector('#elementFields').hidden=!r;if(!r)return;if(![...list.options].some(o=>o.value===r.key)){category.value='';search.value='';fillList();}ui.querySelector('#positionCaption').textContent=(r.kind==='island'||r.object.parent===scene)?'位置 X / 高度 Y / Z（世界坐标）':'位置 X / 高度 Y / Z（相对所在岛）';gizmo.attach(r.object);ui.querySelector('#elementFields').hidden=false;list.value=r.key;refreshFields();canvas.dataset.selectedElement=r.key;if(focus){const box=boxFor(r),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()).length();controls.target.copy(center);const dir=camera.position.clone().sub(center).normalize();if(dir.length()<.01)dir.set(0,.4,-1);const distance=Math.max(5,size*1.1);const forward=dir.clone().negate(),right=new THREE.Vector3().crossVectors(forward,camera.up).normalize(),offset=innerWidth>700?right.multiplyScalar(distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect*.25):camera.up.clone().multiplyScalar(-distance*.22);controls.target.copy(center).add(offset);camera.position.copy(center).add(offset).addScaledVector(dir,distance);controls.update();}}
 function fillList(){const old=list.value,q=search.value.toLowerCase(),kind=category.value;list.replaceChildren();for(const r of [...all].sort((a,b)=>((a.kind==='island'?0:1)-(b.kind==='island'?0:1))||a.label.localeCompare(b.label,'zh'))){if(scope&&r!==scope&&!belongs(r,scope))continue;if(kind&&r.kind!==kind||q&&!`${r.label} ${r.name}`.toLowerCase().includes(q))continue;const o=document.createElement('option');o.value=r.key;o.textContent=r.label;list.append(o);}list.value=old;ui.querySelector('#elementCount').textContent=list.options.length+' 个元素';}
 search.oninput=fillList;category.onchange=fillList;list.onchange=()=>select(byKey.get(list.value));ui.querySelector('#focusElement').onclick=()=>selected&&select(selected,true);
 for(const input of ui.querySelectorAll('[data-transform]'))input.addEventListener('change',()=>{if(!selected)return;const v=Number(input.value);if(!Number.isFinite(v)){refreshFields();return;}change(()=>{const o=selected.object;if(input.id.startsWith('position'))o.position[input.id.slice(-1)]=THREE.MathUtils.clamp(v,-3000,3000);else if(input.id==='rotationY')o.rotation.y=THREE.MathUtils.degToRad(v);else {const factor=THREE.MathUtils.clamp(v,.05,20);o.scale.fromArray(selected.base.s).multiplyScalar(factor);}if(autoGround.checked&&input.id!=='positiony')ground(selected);});});
 function applyFields(){if(!selected)return;const values=['positionx','positiony','positionz','rotationY','objectScale'].map(id=>Number(ui.querySelector('#'+id).value));if(values.some(v=>!Number.isFinite(v))){alert('请输入有效数字。');return;}change(()=>{const o=selected.object;o.position.set(...values.slice(0,3).map(v=>THREE.MathUtils.clamp(v,-3000,3000)));o.rotation.y=THREE.MathUtils.degToRad(values[3]);o.scale.fromArray(selected.base.s).multiplyScalar(THREE.MathUtils.clamp(values[4],.05,20));if(autoGround.checked)ground(selected);});alert('数值已应用，可撤销。');}
 ui.querySelector('#applyValues').onclick=applyFields;for(const input of ui.querySelectorAll('[data-transform]'))input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyFields();}});
 ui.querySelector('#visibleElement').onchange=e=>selected&&change(()=>selected.object.visible=e.target.checked);
 ui.querySelector('#resetElement').onclick=()=>selected&&change(()=>put(selected.object,selected.base));
 ui.querySelector('#undoEdit').onclick=()=>{if(!undos.length)return;redos.push(snapshot());restore(undos.pop());updateButtons();};
 ui.querySelector('#redoEdit').onclick=()=>{if(!redos.length)return;undos.push(snapshot());restore(redos.pop());updateButtons();};
 ui.querySelector('#restoreScene').onclick=()=>change(()=>{for(const r of all){put(r.object,r.base);if(r.added)r.object.visible=false;}});
 const documentLayout=()=>({version:2,scene:sceneId,changes:snapshot()});
 const valid=data=>validateSceneLayout(data,byKey);
 ui.querySelector('#saveLayout').onclick=()=>{try{localStorage.setItem(storageKey,JSON.stringify(documentLayout()));saved=serialize();refreshFields();alert('已保存到当前浏览器。下次打开会自动恢复。');}catch{alert('浏览器保存失败，请导出布局备份。');}};
 ui.querySelector('#exportLayout').onclick=()=>{const blob=new Blob([JSON.stringify(documentLayout(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='云端初醒-我的布局.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);alert('布局文件已导出。');};
 const file=ui.querySelector('#layoutFile');ui.querySelector('#importLayout').onclick=()=>file.click();file.onchange=async()=>{try{if(!file.files[0])return;if(file.files[0].size>2*1024*1024)throw Error('布局文件过大');const changes=valid(JSON.parse(await file.files[0].text())),prior=snapshot();restore(changes);remember(prior);alert('布局已导入；点击“保存布局”可在下次打开时恢复。');}catch(e){alert(e.message||'无法读取布局');}finally{file.value='';}};
 for(const button of ui.querySelectorAll('[data-tool]'))button.onclick=()=>{const mode=button.dataset.tool;gizmo.setMode(mode);gizmo.showX=mode!=='rotate';gizmo.showY=true;gizmo.showZ=mode!=='rotate';ui.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));};
 gizmo.addEventListener('dragging-changed',e=>controls.enabled=!e.value&&active);
 gizmo.addEventListener('mouseDown',()=>{beforeDrag=snapshot();wasGizmo=true;});gizmo.addEventListener('objectChange',()=>{if(autoGround.checked&&selected&&selected.kind!=='island'&&gizmo.mode!=='rotate')ground(selected);sync();});gizmo.addEventListener('mouseUp',()=>{if(beforeDrag)remember(beforeDrag);beforeDrag=null;});
 canvas.addEventListener('pointerdown',e=>{if(active)down={x:e.clientX,y:e.clientY};});
 canvas.addEventListener('pointerup',e=>{if(!active||!down)return;const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null;if(wasGizmo){wasGizmo=false;return;}if(moved>5||gizmo.axis)return;const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);for(const hit of ray.intersectObjects(pickMeshes,false)){let visible=true;for(let p=hit.object;p;p=p.parent)if(!p.visible){visible=false;break;}if(!visible)continue;const mapping=pickMap.get(hit.object),r=mapping instanceof Map?mapping.get(hit.instanceId):mapping;if(r){select(r);break;}}});
 function enter(){if(active)return;onEnter();active=true;controls.autoRotate=false;gizmo.enabled=true;helper.visible=true;ui.hidden=false;toggle.textContent='退出编辑';document.body.classList.add('editing');canvas.dataset.editor='true';fillList();select(islands.find(i=>i.zone===0)||all[0],true);alert('点击场景或从列表选择。彩色轴拖动；空白处拖动观察，滚轮缩放。');}
 function exit(){if(!active)return;setScope(null);active=false;gizmo.detach();gizmo.enabled=false;helper.visible=false;ui.hidden=true;toggle.textContent='场景编辑';document.body.classList.remove('editing');canvas.dataset.editor='false';onExit();}
 toggle.onclick=()=>active?exit():enter();ui.querySelector('#exitEditor').onclick=exit;
 addEventListener('keydown',e=>{if(!active||/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();removeSelected();}if(e.key==='Escape'){e.preventDefault();exit();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();ui.querySelector(e.shiftKey?'#redoEdit':'#undoEdit').click();}});

 // Preserve full-size copies at the original island transforms before applying the merged layout.
 for(const zone of [0,2]){
  const island=islands.find(i=>i.zone===zone);
  if(!island)continue;
  const copy=cloneRig(island.object),originalNodes=[],copyNodes=[];
  island.object.traverse(o=>originalNodes.push(o));copy.traverse(o=>copyNodes.push(o));
  for(const r of records){
   const index=originalNodes.indexOf(r.object);
   if(index<0||r.direct)continue;
   const proxy=copyNodes[index],mesh=new THREE.Mesh(r.geometry,r.mesh.material);
   mesh.name=r.name;mesh.position.copy(proxy.position);mesh.quaternion.copy(proxy.quaternion);mesh.scale.copy(proxy.scale);
   mesh.visible=proxy.visible;mesh.castShadow=r.mesh.castShadow;mesh.receiveShadow=r.mesh.receiveShadow;
   proxy.parent.add(mesh);proxy.removeFromParent();
  }
  copy.name=zone===0?'苏醒草坡 · 原位副本':'回声树屋 · 原位副本';scene.add(copy);
  const copyRecord=add({key:'original-copy:'+zone,name:copy.name,label:copy.name,kind:'island',object:copy,direct:true});
  copyRecord.base=state(copy);copyRecord.initialWorld=copy.matrixWorld.clone();
  for(const [index,tree] of trees.entries()){
   const nodeIndex=originalNodes.indexOf(tree);
   if(nodeIndex<0)continue;
   const object=copyNodes[nodeIndex];
   const r=add({key:'original-copy:'+zone+':tree:'+index,name:object.name,label:copy.name+' · 大树',kind:'tree',object,direct:true});
   r.base=state(object);r.initialWorld=object.matrixWorld.clone();
   object.traverse(o=>{if(o.isMesh){pickMeshes.push(o);pickMap.set(o,r);}});
  }
  const source=surfaces[zone];
  surfaces.push({...source,editorKey:undefined});
 }
 const supportParent=byKey.get('original-copy:0'),supportTemplate=records.find(r=>r.name==='04 Echo tree sanctuary • sculpted Tripo cliff');
 if(supportParent&&supportTemplate){
  const originalIsland=islands.find(i=>i.zone===0),mesh=new THREE.Mesh(supportTemplate.geometry,supportTemplate.mesh.material);
  mesh.name='石门草坡 · 复制树屋岛体';mesh.castShadow=true;mesh.receiveShadow=true;
  const baked=supportTemplate.geometry.clone();baked.applyMatrix4(supportTemplate.initialWorld);baked.computeBoundingBox();mesh.geometry=baked;
  const bounds=baked.boundingBox,size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const sx=originalIsland.rx*2.05/size.x,sz=originalIsland.rz*2.05/size.z,sy=16/size.y;mesh.scale.set(sx,sy,sz);
  mesh.position.set(originalIsland.center.x-center.x*sx,1.18-bounds.max.y*sy,originalIsland.center.z-center.z*sz);
  scene.add(mesh);supportParent.object.attach(mesh);scene.updateMatrixWorld(true);
  const r=add({key:'stone-gate-support-island',name:mesh.name,label:mesh.name,kind:'terrain',object:mesh,direct:true});r.base=state(mesh);r.initialWorld=mesh.matrixWorld.clone();pickMeshes.push(mesh);pickMap.set(mesh,r);
 }

 // 所有悬空的物件自动落到正下方的岛面上（岛体、草皮、天空群岛、云台、光点等不处理）
 function groundFloating(){scene.updateMatrixWorld(true);const tgt=[];scene.traverse(o=>{if(!o.isMesh||!/sculpted Tripo cliff|复制树屋岛体|Central lower terrace|• meadow|Sky archipelago/.test(o.name))return;for(let a=o;a;a=a.parent)if(!a.visible)return;tgt.push(o);});
  const skip=/Sky archipelago|Jumping cloud bridge|Cloud crossing|Final ascent|floating mote|beacon|Sun disk|meadow|cliff|foundation|Waterfall|spark|Gate • /i,ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),box=new THREE.Box3(),c=new THREE.Vector3(),up=new THREE.Vector3();let moved=0;
  for(const r of all){if(r.kind==='island'||r.kind==='terrain'||r.kind==='cloud'||/^(grass:|island:)/.test(r.key)||skip.test(r.name||''))continue;const o=r.object;if(o.isInstancedMesh||o.userData.meadowCapacity)continue;let vis=true;for(let a=o;a;a=a.parent)if(!a.visible)vis=false;if(!vis)continue;
   box.setFromObject(o);if(box.isEmpty())continue;box.getCenter(c);const size=box.getSize(new THREE.Vector3());let ground=null;
   for(const [dx,dz] of [[0,0],[.25,0],[-.25,0],[0,.25],[0,-.25]]){ray.set(new THREE.Vector3(c.x+dx*size.x,box.max.y+.5,c.z+dz*size.z),down);ray.far=120;const h=ray.intersectObjects(tgt,false).find(h=>h.face&&up.copy(h.face.normal).transformDirection(h.object.matrixWorld).y>.5);if(h&&(ground===null||h.point.y>ground))ground=h.point.y;}
   if(ground===null){if(r.kind!=='tree'){o.visible=false;moved++;}continue;}const gap=box.min.y-ground;if(gap<.15)continue;const w=o.getWorldPosition(new THREE.Vector3());w.y-=gap-.01;o.position.copy(o.parent.worldToLocal(w));o.updateMatrixWorld(true);moved++;}
  canvas.dataset.groundedFloating=String(moved);if(moved)sync();}
 try{const text=localStorage.getItem(storageKey);
 const layout=JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
 for(const island of islands){
  const target=MAIN_ISLAND_LAYOUT.find(t=>t.zone===island.zone);
  if(target&&!layout.changes[island.key]){
   const original=[{x:-37,z:-15,h:1.18},{x:-10,z:17,h:5.18},{x:24,z:4,h:3.18}][island.zone];
   layout.changes[island.key]={p:[target.x+(island.center.x-original.x)*1.35,target.h+(island.center.y-original.h)*1.35,target.z+(island.center.z-original.z)*1.35],q:[0,0,0,1],s:[1.35,1.35,1.35],v:true};
  }else if(island.zone<0&&island.center.x<30&&!layout.changes[island.key]){
   layout.changes[island.key]={p:[0,3.18,0],q:[0,0,0,1],s:[1.35,1.35,1.35],v:true};
  }
 }
 for(const r of all)if(/Jumping cloud bridge|Cloud crossing/.test(r.name))layout.changes[r.key]={...r.base,v:false};
 const activeLayout=text?JSON.parse(text):layout;
 for(const island of islands){
  if(island.zone<0||island.zone>2)continue;
  const savedIsland=activeLayout.changes?.[island.key];
  if(savedIsland&&Math.abs(savedIsland.s[0]-1.35)<.001&&Math.abs(savedIsland.s[2]-1.35)<.001&&Math.abs(savedIsland.s[1]-1)<.001){
   const originalHeight=[1.18,5.18,3.18][island.zone];
   savedIsland.p[1]+=(island.center.y-originalHeight)*.35;
   savedIsland.s[1]=1.35;
  }
 }
 restore(valid(activeLayout));for(const r of all)if(/Jumping cloud bridge|Cloud crossing|Final ascent/.test(r.name))r.object.visible=false;groundFloating();saved=serialize();}catch{saved=serialize();alert('原保存布局无法读取，已使用默认场景。');}

 // Repair the old terrace's per-model horizontal stretch, including saved layouts.
 for(const r of records){
  if(!/^03 • (Keeper cottage|Storage|Windmill fence)/.test(r.name))continue;
  const scale=r.object.scale;
  if(Math.abs(scale.x/scale.y-1.45)>.02||Math.abs(scale.z/scale.y-1.45)>.02)continue;
  const before=boxFor(r).min.y;
  scale.y=Math.sqrt(scale.x*scale.z);
  scene.updateMatrixWorld(true);
  const after=boxFor(r).min.y;
  const world=r.object.getWorldPosition(new THREE.Vector3());world.y+=before-after;
  r.object.position.copy(r.object.parent.worldToLocal(world));
 }
 const removedTurf=islands.find(i=>i.zone===0);
 if(removedTurf){
  const turf=byKey.get(removedTurf.sourceName),bed=beds.find(b=>b.sourceName===removedTurf.sourceName);
  if(turf)turf.object.visible=false;
  if(bed)bed.mesh.visible=false;
  for(const object of grass)if(object.parent===removedTurf.object)object.visible=false;
  removedTurf.object.userData.removedWalkSurface=true;
  sync();
 }
 for(const island of islands.filter(i=>i.zone===1||i.zone===2)){
  const turf=byKey.get(island.sourceName),bed=beds.find(b=>b.sourceName===island.sourceName);
  if(turf)turf.object.visible=false;
  if(bed)bed.mesh.visible=false;
 }
 sync();
 for(const r of records){if(r.name.startsWith('Path • aged limestone')&&r.initialWorld){const p=new THREE.Vector3().setFromMatrixPosition(r.initialWorld);if(p.y<10)r.object.visible=false;}}
 sync();
 sync();
 scene.updateMatrixWorld(true);
 const groundRay=new THREE.Raycaster(),up=new THREE.Vector3(0,1,0),groundDown=new THREE.Vector3(0,-1,0),instance=new THREE.Matrix4(),inverseGrass=new THREE.Matrix4(),root=new THREE.Vector3();
 const collisionMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
 for(const island of all.filter(r=>r.kind==='island')){
  const groundRecords=records.filter(r=>/sculpted Tripo cliff/.test(r.name)&&belongs(r,island));
  const targets=groundRecords.map(r=>{const mesh=new THREE.Mesh(r.geometry,collisionMaterial);mesh.matrixAutoUpdate=false;mesh.matrixWorld.copy(r.object.matrixWorld);return mesh;});island.object.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&/sculpted Tripo cliff|复制树屋岛体/.test(o.name))targets.push(o);});if(!targets.length)continue;
  const cache=new Map();
  const islandGrass=[];island.object.traverse(o=>{if(o.isInstancedMesh&&o.userData.meadowCapacity)islandGrass.push(o);});
  for(const mesh of islandGrass){
   inverseGrass.copy(mesh.matrixWorld).invert();
   for(let i=0;i<mesh.instanceMatrix.count;i++){
    mesh.getMatrixAt(i,instance);root.setFromMatrixPosition(instance).applyMatrix4(mesh.matrixWorld);
    const key=Math.round(root.x*2)+','+Math.round(root.z*2);let y=cache.get(key);
    if(y===undefined){groundRay.set(new THREE.Vector3(root.x,root.y+40,root.z),groundDown);const hits=groundRay.intersectObjects(targets,false).filter(h=>h.face.normal.clone().transformDirection(h.object.matrixWorld).dot(up)>.55);y=hits.length?hits[0].point.y:null;cache.set(key,y);}
    if(y!==null){root.y=y+.015;root.applyMatrix4(inverseGrass);instance.setPosition(root);}else{instance.scale(new THREE.Vector3(0,0,0));}mesh.setMatrixAt(i,instance);
   }
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
  }
 }
 collisionMaterial.dispose();
 const support=byKey.get('stone-gate-support-island');if(support){support.object.visible=true;support.object.parent.visible=true;}
 const removedCopy=byKey.get('original-copy:2');if(removedCopy)removedCopy.object.visible=false;
 // MVP：起点岛（原位副本）上的物件全部贴到岛面
 {const copy=byKey.get('original-copy:0');if(copy){scene.updateMatrixWorld(true);
  const isGround=o=>/sculpted Tripo cliff|复制树屋岛体|• meadow|foundation/.test(o.name);
  const targets=[];copy.object.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&isGround(o)&&o.visible)targets.push(o);});
  const skip=/Gate • |beacon|mote|spark|Waterfall|Cloud|cloud|trailing moss|Sun disk|Sky archipelago|stair/i;
  const gray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),box=new THREE.Box3(),c=new THREE.Vector3();let grounded=0;
  for(const child of [...copy.object.children]){
   if(!child.visible||isGround(child)||skip.test(child.name)||child.isInstancedMesh||child.userData.meadowCapacity)continue;
   let meshes=0;child.traverse(o=>{if(o.isMesh)meshes++;});if(!meshes)continue;
   box.setFromObject(child);if(box.isEmpty())continue;box.getCenter(c);
   gray.set(new THREE.Vector3(c.x,box.max.y+60,c.z),down);
   const hit=gray.intersectObjects(targets,false).find(h=>h.face&&h.face.normal.clone().transformDirection(h.object.matrixWorld).y>.55);
   if(!hit)continue;const w=child.getWorldPosition(new THREE.Vector3());w.y+=hit.point.y-box.min.y+.01;child.position.copy(child.parent.worldToLocal(w));child.updateMatrixWorld(true);grounded++;}
  canvas.dataset.groundedStart=String(grounded);}}
 sync();
 saved=serialize();fillList();updateButtons();canvas.dataset.editableElements=String(all.length);
 return {get records(){return all},groundFloating:()=>{groundFloating();saved=serialize();},enter,get active(){return active;},update(){},get islands(){return islands;}};
}
