// 湖岸睡莲路的画面搭建：栈桥、睡莲（稳定 / 会开合 / 倒影里的）、石柱、八音盒平台、流水滑道、回中央的小栈桥。
import {lanePoint,DECKS,LILIES,LILY_Y,SLIDE,slideY,BOX_U,ENTRY_DECK,EXIT_PATH,U_END,TOWER_SPOT,POOL,CHANNEL_PTS} from './lane-data.mjs?v=1793348657994569199';

export function buildLane({T,world,assets,put}){
  const M=(c,o={})=>new T.MeshStandardMaterial({color:c,roughness:.55,side:T.DoubleSide,...o});
  const texCanvas=(w,h,draw)=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;return t;};
  let ts=7;const tr=()=>{ts=(1664525*ts+1013904223)>>>0;return ts/4294967296;};
  const paverTex=texCanvas(512,512,(x,w,h)=>{x.fillStyle='#c9ad95';x.fillRect(0,0,w,h);const rows=4;for(let r=0;r<rows;r++){const y0=r*h/rows,off=r%2?w/4:0;for(let k=-1;k<3;k++){const x0=off+k*w/2;const l=212+tr()*30|0;x.fillStyle=`rgb(${l+16},${l},${l-18})`;x.fillRect(x0+5,y0+5,w/2-10,h/rows-10);for(let s=0;s<60;s++){x.fillStyle=`rgba(${150+tr()*60|0},${120+tr()*40|0},${100+tr()*30|0},${tr()*.12})`;x.beginPath();x.arc(x0+8+tr()*(w/2-16),y0+8+tr()*(h/rows-16),1+tr()*6,0,7);x.fill();}const g=x.createLinearGradient(0,y0,0,y0+h/rows);g.addColorStop(0,'rgba(255,255,255,.25)');g.addColorStop(1,'rgba(120,80,60,.12)');x.fillStyle=g;x.fillRect(x0+4,y0+4,w/2-8,h/rows-8);}}});
  const marbleTex=texCanvas(512,512,(x,w,h)=>{x.fillStyle='#f8eef4';x.fillRect(0,0,w,h);for(let v=0;v<26;v++){x.strokeStyle=`rgba(${190+tr()*40|0},${160+tr()*40|0},${190+tr()*40|0},${.12+tr()*.2})`;x.lineWidth=.6+tr()*2.2;x.beginPath();let px=tr()*w,py=0;x.moveTo(px,py);while(py<h){px+=(tr()-.5)*40;py+=10+tr()*30;x.lineTo(px,py);}x.stroke();}for(let s=0;s<400;s++){x.fillStyle=`rgba(255,255,255,${tr()*.25})`;x.fillRect(tr()*w,tr()*h,2,2);}});
  const deckMat=new T.MeshStandardMaterial({map:paverTex,roughness:.7,side:T.DoubleSide});
  const ivory=M('#f3dcc0'),stone=M('#dcc4dc'),gold=M('#d8ad48',{metalness:.65,roughness:.35}),padMat=M('#a9cf9b',{roughness:.8});
  const rings=[];let basinSpot=null;let seed=11;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const V=(x,y,z)=>new T.Vector3(x,y,z);
  const arc=(u0,u1,yFn,step=.5)=>{const pts=[];for(let u=u0;u<u1;u+=step){const p=lanePoint(u);pts.push(V(p.x,yFn(u),p.z));}const p=lanePoint(u1);pts.push(V(p.x,yFn(u1),p.z));return pts;};

  function ribbon(pts,width,depth,mat,offset=0){
    const vs=[],ix=[],top=[],uv=[],n=pts.length;let L=0;
    for(let i=0;i<n;i++){
      if(i)L+=pts[i].distanceTo(pts[i-1]);const a=pts[Math.max(0,i-1)],b=pts[Math.min(n-1,i+1)];const t=V(b.x-a.x,0,b.z-a.z).normalize();const s=V(-t.z,0,t.x);
      for(const [sg,dy] of [[-1,0],[1,0],[1,-depth],[-1,-depth]]){const v=pts[i].clone().addScaledVector(s,offset+width*.5*sg);v.y+=dy;vs.push(v.x,v.y,v.z);uv.push(sg<0?0:1,L/width);}
      if(i<n-1)for(let k=0;k<4;k++){const a0=i*4+k,b0=i*4+(k+1)%4;(k===0?top:ix).push(a0,b0,b0+4,a0,b0+4,a0+4);}
    }
    ix.push(0,3,2,0,2,1);const q=(n-1)*4;ix.push(q,q+1,q+2,q,q+2,q+3);const nTop=top.length;ix.unshift(...top);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vs,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();g.addGroup(0,nTop,0);g.addGroup(nTop,ix.length-nTop,1);
    const m=new T.Mesh(g,mat);world.add(m);return m;
  }
  function edgeTubes(pts,width,lift=.05,r=.06){
    for(const sg of [-1,1]){const e=pts.map((p,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];const t=V(b.x-a.x,0,b.z-a.z).normalize();return p.clone().add(V(-t.z*sg*width*.5,lift,t.x*sg*width*.5));});
      world.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(e),Math.max(8,e.length*2),r,6,false),gold));}
  }
  const ringsAlong=(u0,u1,r,step=1.6)=>{for(let u=u0;u<=u1;u+=step){const p=lanePoint(u);rings.push([p.x,p.z,r]);}};

  // ---- 栈桥平台
  for(const d of DECKS){if(d.id==='shore'){ringsAlong(0,d.u1,1.3);continue;}// 湖岸小路与入口栈桥合成一整段
    const u0=d.id==='shore'?0:Math.max(d.u0,-.6),u1=Math.min(d.u1,U_END);const pts=arc(u0,u1,()=>d.y);
    const tall=d.y>1;
    if(tall)ribbon(pts,2.3,d.y+.45,stone);
    ribbon(pts,2.6,tall?.18:.42,[deckMat,ivory]);edgeTubes(pts,2.6);
    ringsAlong(u0,u1,tall?1.25:1.3);
  }
  // 进出横版段的两条弧形栈桥（与横版路线相切衔接）
  const deckCurve=(list,tail=[])=>{const c=new T.CatmullRomCurve3(list.map(p=>V(p.x,p.y,p.z)));const pts=[...c.getPoints(36),...tail];ribbon(pts,2.6,.42,[deckMat,ivory]);edgeTubes(pts,2.6);for(let i=0;i<=36;i+=6){const p=pts[i];rings.push([p.x,p.z,1.25]);}return c;};
  const SH=DECKS.find(d=>d.id==='shore');const entryCurve=deckCurve(ENTRY_DECK,arc(.5,SH.u1,()=>SH.y).slice(0)),exitCurve=new T.CatmullRomCurve3(EXIT_PATH.map(p=>V(p.x,p.y,p.z)));
  // 清掉挡在两条栈桥上的花丛和灯
  const plantIds=new Set([23,30,32,33,34,35,36]);
  const nearPath=(p,list)=>{for(let i=1;i<list.length;i++){const a=list[i-1],b=list[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));if(Math.hypot(p.x-(a.x+dx*t),p.z-(a.z+dz*t))<2.1)return true;}return false;};
  for(const o of [...world.children]){if(!plantIds.has(o.userData.assetId)||o.position.y>1)continue;if(nearPath(o.position,ENTRY_DECK)||nearPath(o.position,EXIT_PATH))world.remove(o);}

  // ---- 睡莲与石柱
  const lilies=[];
  const lotus=(x,z,size,top)=>{const o=put(31,x,0,z,size,rnd()*6.28);const box=new T.Box3().setFromObject(o);o.position.y+=top-box.max.y;return o;};
  for(const l of LILIES){
    const p=lanePoint(l.u);
    if(l.k==='post'){
      const col=new T.Mesh(new T.CylinderGeometry(.82,.95,l.y+.45,40),stone);col.position.set(p.x,(l.y-.45)/2,p.z);world.add(col);
      const cap=new T.Mesh(new T.CylinderGeometry(.92,.92,.12,40),ivory);cap.position.set(p.x,l.y-.06,p.z);world.add(cap);
      const rim=new T.Mesh(new T.TorusGeometry(.92,.04,6,48),gold);rim.rotation.x=Math.PI/2;rim.position.set(p.x,l.y,p.z);world.add(rim);
      rings.push([p.x,p.z,.95]);lilies.push({kind:'post'});continue;
    }
    const g=new T.Group();g.position.set(p.x,0,p.z);world.add(g);
    const pad=new T.Mesh(new T.CircleGeometry(1.25,28,.35,5.6),padMat);pad.rotation.x=-Math.PI/2;pad.position.y=.0;pad.visible=false;g.add(pad);// 睡莲叶片按要求去掉
    const o=lotus(p.x,p.z,2.0,LILY_Y);world.remove(o);o.position.set(0,o.position.y,0);g.add(o);
    const k0=o.scale.x,baseY=o.position.y;
    let glow=null;
    if(l.k==='ghost'){glow=new T.Mesh(new T.TorusGeometry(1.15,.05,6,48),new T.MeshBasicMaterial({color:'#bff3ff',transparent:true,opacity:.9}));glow.rotation.x=-Math.PI/2;glow.position.y=.1;g.add(glow);g.traverse(m=>m.layers.set(1));}
    else rings.push([p.x,p.z,1.15]);
    lilies.push({kind:l.k,group:g,flower:o,pad,k0,baseY,glow,shown:null});
  }

  // ---- 八音盒（原来的符文蓝方块）放在平台上
  const bp=lanePoint(BOX_U);const boxPos=V(bp.x,3.4+.62,bp.z);
  const plinth=new T.Mesh(new T.CylinderGeometry(.75,.85,.3,32),ivory);plinth.position.set(bp.x,3.4+.15,bp.z);world.add(plinth);

  // ---- 流水滑道（断口处断开）
  const flow={value:0},time={value:0};
  const waterMat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{flow,time},
    vertexShader:`varying vec2 vUv;varying vec3 vW;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform float flow,time;varying vec2 vUv;varying vec3 vW;
      float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      void main(){float x=vUv.x,y=vUv.y;float t=time*2.6;
        float r=n(vec2(x*5.,y*1.6-t))*.55+n(vec2(x*11.,y*3.5-t*1.6))*.3+n(vec2(x*23.,y*7.-t*2.3))*.15;
        float edge=smoothstep(.22,0.,x)+smoothstep(.78,1.,x);
        float streak=smoothstep(.62,.8,n(vec2(x*7.,y*.9-t*1.2)))*.7;
        vec3 deep=vec3(.0,.4,.62),light=vec3(.18,.78,.9);
        vec3 c=mix(deep,light,smoothstep(.25,.85,r)+.35*(1.-abs(x-.5)*2.));
        c=mix(c,vec3(.95,1.,1.),clamp(edge*.6+streak*.5,0.,1.));
        vec3 V=normalize(cameraPosition-vW);float spec=pow(max(0.,1.-abs(dot(V,vec3(0,1,0)))),3.)*.25;c+=spec;
        gl_FragColor=vec4(c,flow*.97);}`});
  // 横截面扫掠：沿路径把一条轮廓线（侧向偏移, 高度偏移）拉成实体
  const toRim=(v,t)=>{const b=v.x*t.x+v.z*t.z,c=v.x*v.x+v.z*v.z-POOL.r*POOL.r,d=b*b-c;if(d<0)return v;const k=-b-Math.sqrt(d);return v.clone().add(V(t.x*k,0,t.z*k));};
  function sweep(pts,profile,mat,closed=false,capEnd=true,clipEnd=false){
    const vs=[],ix=[],uv=[],n=pts.length,m=profile.length;let L=0;
    for(let i=0;i<n;i++){
      if(i)L+=pts[i].distanceTo(pts[i-1]);const a=pts[Math.max(0,i-1)],b=pts[Math.min(n-1,i+1)];const t=V(b.x-a.x,0,b.z-a.z).normalize();const sd=V(-t.z,0,t.x);
      profile.forEach(([lat,dy],k)=>{let v=pts[i].clone().addScaledVector(sd,lat);v.y+=dy;if(clipEnd&&i===n-1)v=toRim(v,t);vs.push(v.x,v.y,v.z);uv.push(k/(m-1),L);});
      if(i<n-1)for(let k=0;k<(closed?m:m-1);k++){const a0=i*m+k,b0=i*m+(k+1)%m;ix.push(a0,b0,b0+m,a0,b0+m,a0+m);}
    }
    if(closed){for(const base of capEnd?[0,(n-1)*m]:[0])for(let k=1;k<m-1;k++)ix.push(base,base+k,base+k+1);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vs,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();
    const mesh=new T.Mesh(g,mat);world.add(mesh);return mesh;
  }
  const pearl=new T.MeshStandardMaterial({map:marbleTex,roughness:.32,metalness:.05,side:T.DoubleSide}),lilac=M('#d9bfe0',{roughness:.6});
  const R=1.6,A=40*Math.PI/180,N=14,arcP=(r,a0,a1,lift)=>Array.from({length:N+1},(_,k)=>{const a=a0+(a1-a0)*k/N;return [Math.sin(a)*r,-Math.cos(a)*r+lift];});
  const inner=arcP(R,-A,A,R-.05),outer=arcP(R+.2,A*1.02,-A*1.02,R-.05).map(([l,d])=>[l,d-.08]);
  const shell=[...inner,...outer];
  const lipL=[Math.sin(-A)*R,-Math.cos(A)*R+R-.05+.02],lipR=[Math.sin(A)*R,lipL[1]];
  // 一整根连续的水槽：八音盒平台 → 湖上弧线 → 转弯 → 花园边缘（中间不再断开）
  const inPool=p=>Math.hypot(p.x,p.z)<POOL.r;// 水槽在花园边缘结束
  const exitPts=CHANNEL_PTS.map(p=>V(p.x,p.y,p.z));// 末端垂直截断，两侧槽沿都停在花园边缘外
  const chPts=[...arc(SLIDE.u0,U_END,slideY,.3),...exitPts.slice(1)];
  sweep(chPts,shell,pearl,true,false,true);// 末端敞口，并沿花园圆弧截齐
  for(const lip of [lipL,lipR]){const e=chPts.map((p,i)=>{const a=chPts[Math.max(0,i-1)],b=chPts[Math.min(chPts.length-1,i+1)];const t=V(b.x-a.x,0,b.z-a.z).normalize();const q=p.clone().add(V(-t.z*lip[0],lip[1],t.x*lip[0]));return i===chPts.length-1?toRim(q,t):q;});world.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(e),e.length*2,.07,8,false),gold));}
  {const w=sweep(chPts,arcP(R-.03,-A*.82,A*.82,R-.05+.06),waterMat,false,true,true);w.renderOrder=2;}
  for(let i=6;i<exitPts.length-4;i+=10){const p=exitPts[i];rings.push([p.x,p.z,1.1]);}
  // 引水渡槽式支撑：一对细柱 + 小拱
  for(let u=SLIDE.u0+1.4;u<U_END-1;u+=4.2){
    const p=lanePoint(u),yb=slideY(u)-.2,sd=V(-p.tz,0,p.tx);if(yb<.9)continue;
    for(const sg of [-1,1]){const c=new T.Mesh(new T.CylinderGeometry(.13,.17,yb-.75+.45,12),lilac);c.position.set(p.x+sd.x*.72*sg,(yb-.75-.45)/2,p.z+sd.z*.72*sg);world.add(c);const cap=new T.Mesh(new T.SphereGeometry(.17,12,8),gold);cap.position.set(c.position.x,yb-.75,c.position.z);world.add(cap);rings.push([c.position.x,c.position.z,.2]);}
    const ar=new T.Mesh(new T.TorusGeometry(.72,.07,8,24,Math.PI),lilac);ar.position.set(p.x,yb-.75,p.z);ar.rotation.y=Math.atan2(-sd.z,sd.x);world.add(ar);
  }
  // 起点和终点的金色圆钮
  {const p=lanePoint(SLIDE.u0),sd=V(-p.tz,0,p.tx),y=slideY(SLIDE.u0);for(const lip of [lipL,lipR]){const f=new T.Mesh(new T.SphereGeometry(.16,14,10),gold);f.position.set(p.x+sd.x*lip[0],y+lip[1]+.12,p.z+sd.z*lip[0]);world.add(f);}}
  {const e=chPts[chPts.length-1],e0=chPts[chPts.length-2],t=V(e.x-e0.x,0,e.z-e0.z).normalize(),sd=V(-t.z,0,t.x);const ends=[lipL,lipR].map(lip=>toRim(V(e.x+sd.x*lip[0],e.y+lip[1],e.z+sd.z*lip[0]),t));for(const p of ends){const f=new T.Mesh(new T.SphereGeometry(.12,14,10),gold);f.position.copy(p);world.add(f);}
   const a0=Math.atan2(ends[0].z,ends[0].x);let a1=Math.atan2(ends[1].z,ends[1].x);if(a1-a0>Math.PI)a1-=Math.PI*2;if(a0-a1>Math.PI)a1+=Math.PI*2;const arcPts=Array.from({length:17},(_,k)=>{const a=a0+(a1-a0)*k/16;return V(Math.cos(a)*POOL.r,ends[0].y+(ends[1].y-ends[0].y)*k/16,Math.sin(a)*POOL.r);});
   world.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(arcPts),24,.05,8,false),gold));}// 末端金边：沿花园圆弧
  // 横在水道上的花环（滑行时按空格跳过）
  const roseM=new T.MeshStandardMaterial({color:'#ff86bd',roughness:.6}),leafM=new T.MeshStandardMaterial({color:'#7fb36a',roughness:.8});
  for(const bu of SLIDE.bars){const p=lanePoint(bu),sd=V(-p.tz,0,p.tx),y=slideY(bu)+lipL[1]+.38,g=new T.Group();g.position.set(p.x,y,p.z);g.rotation.y=Math.atan2(sd.x,sd.z);
    const vine=new T.Mesh(new T.CylinderGeometry(.07,.07,2.05,10),leafM);vine.rotation.x=Math.PI/2;g.add(vine);
    for(let k=0;k<14;k++){const z=-.95+k*.146,r=k%3===1?.12:.095;const b=new T.Mesh(new T.SphereGeometry(r,12,10),k%3===1?roseM:(k%2?leafM:roseM));b.position.set((k%2?.06:-.05),(k%2?.05:-.03),z);g.add(b);}
    for(const sg of [-1,1]){const post=new T.Mesh(new T.CylinderGeometry(.05,.06,.42,10),gold);post.position.set(0,-.2,sg*1.0);g.add(post);const knob=new T.Mesh(new T.SphereGeometry(.09,12,8),gold);knob.position.set(0,.04,sg*1.0);g.add(knob);}
    world.add(g);}
  // 八音盒平台后方的石柱（上面放蓝顶细塔）
  {const T0=TOWER_SPOT;const col=new T.Mesh(new T.CylinderGeometry(1.05,1.2,T0.y+.45,40),stone);col.position.set(T0.x,(T0.y-.45)/2,T0.z);world.add(col);
   const cap=new T.Mesh(new T.CylinderGeometry(1.15,1.15,.14,40),ivory);cap.position.set(T0.x,T0.y-.07,T0.z);world.add(cap);
   const rim=new T.Mesh(new T.TorusGeometry(1.15,.05,6,48),gold);rim.rotation.x=Math.PI/2;rim.position.set(T0.x,T0.y,T0.z);world.add(rim);rings.push([T0.x,T0.z,1.2]);}

  return {basinSpot,entryCurve,exitCurve,rings,lilies,boxPos,waterMat,flow,time};
}
