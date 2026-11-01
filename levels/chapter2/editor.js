// 布局编辑器：在“查看场景”模式下点选模型，拖动箭头移动 / 旋转 / 缩放，保存到 layout.json。
import {TransformControls} from './vendor/TransformControls.js';

const r2=v=>Math.round(v*100)/100;
export function layoutKey(o,seen){const k=`${o.userData.assetId}@${r2(o.position.x).toFixed(2)},${r2(o.position.z).toFixed(2)}`;const n=(seen[k]=(seen[k]||0)+1);return n>1?k+'#'+n:k;}

// 启动时套用已保存的布局（在摆放修正之后、玩法初始化之前调用）
export function applyLayout({world,put,layout}){
  const seen={};const keyed=[];
  for(const o of [...world.children]){if(o.userData.assetId===undefined)continue;const k=layoutKey(o,seen);o.userData.layoutKey=k;keyed.push(o);}
  if(!layout||layout.version!==1)return {keyed,applied:0};
  let applied=0;
  for(const o of keyed){const e=layout.objects?.[o.userData.layoutKey];if(!e)continue;
    if(e.removed){world.remove(o);applied++;continue;}
    if(e.p)o.position.fromArray(e.p);if(e.r!==undefined)o.rotation.y=e.r;if(e.s)o.scale.fromArray(e.s);applied++;}
  (layout.added||[]).forEach((a,i)=>{const o=put(a.id,a.p[0],a.p[1],a.p[2],1,a.r||0);if(a.s)o.scale.fromArray(a.s);o.userData.addedIndex=i;o.userData.layoutKey='added#'+i;applied++;});
  return {keyed,applied};
}

export function createEditor({T,scene,world,camera,controls,renderer,put,layout,isPlaying}){
  const data={version:1,objects:{...(layout?.objects||{})},added:[...(layout?.added||[])]};
  const names=new Map();
  const nice=o=>{const id=o.userData.assetId;const raw=(o.name||'').split('+3d')[0].replaceAll('+',' ');const zh={0:'城堡小塔',4:'花拱门',7:'梦境出口门',9:'金骨头',10:'书架',12:'帘幕拱门',15:'记忆星仪',17:'许愿泉',18:'挂画',21:'南门铁门',22:'凉亭',23:'大理石柱',24:'红地毯',25:'圆形马赛克地面',27:'装饰地砖',28:'装饰宝箱',29:'粉云',31:'睡莲',32:'玫瑰花丛',33:'南瓜灯',34:'螺旋造型树',35:'向日葵',36:'紫藤',37:'木箱（剧情）',39:'蓝顶细塔',42:'墙板'}[id];return (zh||raw)+'  #'+id;};
  const MARK=new Set([9,15,17,37]);// 有剧情互动的物件

  const tc=new TransformControls(camera,renderer.domElement);tc.setSize(.9);const helper=tc.getHelper();scene.add(helper);helper.visible=false;
  let on=false,sel=null,undo=[],before=null;
  tc.addEventListener('dragging-changed',e=>{controls.enabled=!e.value;if(e.value&&sel)before=snap(sel);else if(sel&&before){undo.push(before);before=null;record(sel);refresh();}});
  let lastScale=null;
  tc.addEventListener('objectChange',()=>{if(!sel)return;if(tc.getMode()==='scale'){const s0=lastScale||sel.scale.clone();const rx=sel.scale.x/s0.x,ry=sel.scale.y/s0.y,rz=sel.scale.z/s0.z;const pick=[rx,ry,rz].sort((a,b)=>Math.abs(b-1)-Math.abs(a-1))[0];sel.scale.copy(s0).multiplyScalar(pick);lastScale=sel.scale.clone();}refresh();});
  const snap=o=>({o,p:o.position.toArray(),r:o.rotation.y,s:o.scale.toArray(),inWorld:o.parent===world});
  function record(o){const k=o.userData.layoutKey;if(!k)return;const e={p:o.position.toArray().map(r2),r:+o.rotation.y.toFixed(4),s:o.scale.toArray().map(v=>+v.toFixed(5))};
    if(k.startsWith('added#'))data.added[o.userData.addedIndex]={id:o.userData.assetId,...e};else data.objects[k]=e;dirty(true);}

  // ---------- 界面
  const css=document.createElement('style');css.textContent=`#ed-toggle{position:absolute;left:16px;top:120px;z-index:6}#ed-panel{display:none;position:absolute;left:16px;top:160px;z-index:6;width:250px;background:#3d1f38e6;color:#fff;border:1px solid #fff4;border-radius:16px;padding:14px;font-size:13px;line-height:1.7;backdrop-filter:blur(10px)}#ed-panel b{color:#ffd9ec}#ed-panel button{margin:3px 2px;padding:6px 11px;font-size:12px}#ed-panel button.on{background:#ffd75e}#ed-panel .row{margin:6px 0}#ed-panel .num{font-family:ui-monospace,monospace;font-size:11px;opacity:.85}#ed-panel .dirty{color:#ffd75e}body.editing header,body.editing #detail{display:none}body.playing #ed-toggle{display:none}`;document.head.append(css);
  const btn=document.createElement('button');btn.id='ed-toggle';btn.textContent='✎ 布局编辑';document.body.append(btn);
  const panel=document.createElement('div');panel.id='ed-panel';panel.innerHTML=`<b>布局编辑</b><div id="ed-sel">点一下场景里的模型来选中它</div><div class="num" id="ed-num"></div>
   <div class="row"><button data-m="translate" class="on">移动 W</button><button data-m="rotate">旋转 E</button><button data-m="scale">缩放 R</button></div>
   <div class="row"><button id="ed-ground">贴地 G</button><button id="ed-dup">复制 D</button><button id="ed-del">删除 Del</button></div>
   <div class="row"><button id="ed-undo">撤销 ⌘Z</button><button id="ed-reset">还原此物体</button></div>
   <div class="row"><button id="ed-save">💾 保存布局</button><button id="ed-exit">退出编辑</button></div>
   <div id="ed-status" class="num"></div>
   <div class="num" style="margin-top:6px;opacity:.7">拖动空白处转镜头 · 滚轮缩放 · 右键平移<br>按住 Shift 拖动：按网格吸附</div>`;document.body.append(panel);
  const $=s=>panel.querySelector(s);let isDirty=false;
  const dirty=v=>{isDirty=v;$('#ed-status').innerHTML=v?'<span class="dirty">● 有未保存的修改</span>':'已保存';};
  function refresh(){if(!sel){$('#ed-sel').textContent='点一下场景里的模型来选中它';$('#ed-num').textContent='';return;}
    $('#ed-sel').innerHTML=`<b>${nice(sel)}</b>${MARK.has(sel.userData.assetId)?'<br><span style="color:#bff3ff">剧情物件：互动位置会跟着它走</span>':''}`;
    const p=sel.position;$('#ed-num').textContent=`位置 ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)} · 朝向 ${Math.round(sel.rotation.y*180/Math.PI)}° · 大小 ×${(sel.scale.x/(sel.userData.s0||sel.scale.x)).toFixed(2)}`;}
  function select(o){sel=o;lastScale=null;if(o){if(!o.userData.s0)o.userData.s0=o.scale.x;tc.attach(o);helper.visible=true;}else{tc.detach();helper.visible=false;}refresh();}
  function setMode(m){tc.setMode(m);tc.showX=tc.showZ=m!=='rotate';tc.showY=true;lastScale=null;panel.querySelectorAll('[data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===m));}
  panel.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>setMode(b.dataset.m));
  function enter(){if(isPlaying())return;on=true;document.body.classList.add('editing');panel.style.display='block';btn.textContent='✎ 编辑中…';dirty(isDirty);}
  function exit(){if(isDirty&&!confirmLeave())return;on=false;select(null);document.body.classList.remove('editing');panel.style.display='none';btn.textContent='✎ 布局编辑';}
  const confirmLeave=()=>{$('#ed-status').innerHTML='<span class="dirty">还有未保存的修改，先点“保存布局”；再点一次“退出编辑”会放弃这些修改</span>';const k=confirmLeave.armed;confirmLeave.armed=true;setTimeout(()=>confirmLeave.armed=false,4000);return k;};
  btn.onclick=()=>on?exit():enter();$('#ed-exit').onclick=exit;
  function topModel(obj){while(obj&&obj.parent!==world)obj=obj.parent;return obj&&obj.userData.assetId!==undefined?obj:null;}
  const ray=new T.Raycaster(),mouse=new T.Vector2();let down=null;
  renderer.domElement.addEventListener('pointerdown',e=>{if(on)down=[e.clientX,e.clientY];});
  renderer.domElement.addEventListener('pointerup',e=>{if(!on||!down||tc.dragging)return;if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>4){down=null;return;}down=null;
    const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);
    const hits=ray.intersectObjects(world.children.filter(o=>o.userData.assetId!==undefined&&o.visible),true);select(hits.length?topModel(hits[0].object):null);});
  function ground(){if(!sel)return;undo.push(snap(sel));const b=new T.Box3().setFromObject(sel);const c=b.getCenter(new T.Vector3());const down=new T.Raycaster(new T.Vector3(c.x,b.max.y+20,c.z),new T.Vector3(0,-1,0));const hit=down.intersectObjects(world.children.filter(o=>o!==sel&&o.visible&&(o.userData.assetId===undefined||[24,25,27].includes(o.userData.assetId))),true).find(h=>h.point.y<b.min.y+.6);const y=hit?hit.point.y:Math.max(-.35,b.min.y);sel.position.y+=y-b.min.y;record(sel);refresh();}
  function dup(){if(!sel)return;const s=sel;const o=put(s.userData.assetId,s.position.x+1,s.position.y,s.position.z+1,1,s.rotation.y);o.scale.copy(s.scale);o.userData.addedIndex=data.added.length;o.userData.layoutKey='added#'+o.userData.addedIndex;data.added.push(null);undo.push({o,dup:true});record(o);select(o);}
  function del(){if(!sel)return;const o=sel;undo.push({o,del:true,parent:o.parent});world.remove(o);if(o.userData.layoutKey.startsWith('added#'))data.added[o.userData.addedIndex]=null;else data.objects[o.userData.layoutKey]={removed:true};dirty(true);select(null);}
  function doUndo(){const u=undo.pop();if(!u)return;if(u.dup){world.remove(u.o);data.added[u.o.userData.addedIndex]=null;select(null);}else if(u.del){world.add(u.o);const k=u.o.userData.layoutKey;if(k.startsWith('added#'))record(u.o);else{delete data.objects[k];record(u.o);}select(u.o);}else{u.o.position.fromArray(u.p);u.o.rotation.y=u.r;u.o.scale.fromArray(u.s);record(u.o);select(u.o);}dirty(true);}
  function reset(){if(!sel)return;const k=sel.userData.layoutKey;if(k.startsWith('added#')){del();return;}delete data.objects[k];dirty(true);$('#ed-status').innerHTML='<span class="dirty">已还原记录，保存后刷新页面就会回到原位</span>';}
  async function save(){const out={version:1,objects:data.objects,added:data.added.filter(Boolean)};
    try{const r=await fetch('./save-layout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(out)});if(!r.ok)throw 0;dirty(false);$('#ed-status').innerHTML='✓ 已保存到项目里的 layout.json<br>刷新页面后，剧情互动位置也会更新';}
    catch{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,1)],{type:'application/json'}));a.download='layout.json';a.click();dirty(false);$('#ed-status').innerHTML='预览服务不支持直接保存，已下载 layout.json：<br>请把它放进 dream-garden 文件夹（替换旧的），再重新双击“启动预览”';}}
  $('#ed-ground').onclick=ground;$('#ed-dup').onclick=dup;$('#ed-del').onclick=del;$('#ed-undo').onclick=doUndo;$('#ed-reset').onclick=reset;$('#ed-save').onclick=save;
  addEventListener('keydown',e=>{if(!on||/INPUT|TEXTAREA/.test(e.target.tagName))return;const k=e.key.toLowerCase();
    if((e.metaKey||e.ctrlKey)&&k==='z'){e.preventDefault();doUndo();return;}if((e.metaKey||e.ctrlKey)&&k==='s'){e.preventDefault();save();return;}
    if(k==='w')setMode('translate');else if(k==='e')setMode('rotate');else if(k==='r')setMode('scale');else if(k==='g')ground();else if(k==='d')dup();else if(k==='delete'||k==='backspace')del();else if(k==='escape')select(null);
    if(k==='shift'){tc.setTranslationSnap(.25);tc.setRotationSnap(Math.PI/12);tc.setScaleSnap(.1);}});
  addEventListener('keyup',e=>{if(e.key==='Shift'){tc.setTranslationSnap(null);tc.setRotationSnap(null);tc.setScaleSnap(null);}});
  addEventListener('beforeunload',e=>{if(isDirty){e.preventDefault();e.returnValue='';}});
  return {get on(){return on;},exit:()=>{if(on){isDirty=false;exit();}}};
}
