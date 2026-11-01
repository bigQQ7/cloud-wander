// 许愿泉喷水：中心水柱 + 向四周洒落的水花 + 落在池面上的涟漪 + 一点水雾。存档（交互）后开始喷。
export function createFountainFX({T,scene,fountain}){
  if(!fountain)return {update(){}};
  fountain.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(fountain),c=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
  // 量出池面高度和池子半径：从上往下打射线
  const ray=new T.Raycaster();const down=new T.Vector3(0,-1,0);
  const hitY=(dx,dz)=>{ray.set(new T.Vector3(c.x+dx,box.max.y+2,c.z+dz),down);const h=ray.intersectObject(fountain,true)[0];return h?h.point.y:null;};
  const waterY=Math.max(hitY(size.x*.22,0)??0,hitY(-size.x*.22,0)??0,hitY(0,size.z*.22)??0,hitY(0,-size.z*.22)??0)+.02;
  let bowlR=size.x*.2;for(let r=size.x*.2;r<size.x*.5;r+=.03){const y=hitY(r,0);if(y===null||y>waterY+.08){bowlR=r-.08;break;}}
  const tip=new T.Vector3(c.x,hitY(0,0)??box.max.y,c.z);// 水晶顶
  const g=new T.Group();g.name='fountain spray';scene.add(g);

  // 水滴粒子
  const N=2600,pos=new Float32Array(N*3),vel=new Float32Array(N*3),life=new Float32Array(N),kind=new Uint8Array(N);
  for(let i=0;i<N;i++){life[i]=-1;pos[i*3+1]=-999;}
  const dc=document.createElement('canvas');dc.width=dc.height=32;const dx=dc.getContext('2d');const grd=dx.createRadialGradient(16,16,0,16,16,16);grd.addColorStop(0,'rgba(255,255,255,1)');grd.addColorStop(.4,'rgba(225,248,255,.85)');grd.addColorStop(1,'rgba(200,240,255,0)');dx.fillStyle=grd;dx.fillRect(0,0,32,32);
  const dropTex=new T.CanvasTexture(dc);
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));
  const drops=new T.Points(geo,new T.PointsMaterial({map:dropTex,size:.06,transparent:true,depthWrite:false,color:'#e6fbff',opacity:.9}));drops.frustumCulled=false;g.add(drops);
  // 水雾
  const M=160,mpos=new Float32Array(M*3),mlife=new Float32Array(M).fill(-1);for(let i=0;i<M;i++)mpos[i*3+1]=-999;
  const mgeo=new T.BufferGeometry();mgeo.setAttribute('position',new T.BufferAttribute(mpos,3));
  const mist=new T.Points(mgeo,new T.PointsMaterial({map:dropTex,size:.42,transparent:true,depthWrite:false,color:'#ffffff',opacity:.18}));mist.frustumCulled=false;g.add(mist);
  // 池面涟漪
  const rings=[];const rmat=new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.6,depthWrite:false});
  for(let i=0;i<14;i++){const m=new T.Mesh(new T.RingGeometry(.9,1,40),rmat.clone());m.rotation.x=-Math.PI/2;m.visible=false;m.userData.t=1;g.add(m);rings.push(m);}
  // 中心水柱（半透明，轻微抖动）
  const colH=.32,col=new T.Mesh(new T.CylinderGeometry(.025,.05,colH,10,1,true),new T.MeshBasicMaterial({color:'#dff8ff',transparent:true,opacity:.55,depthWrite:false}));col.position.set(tip.x,tip.y+colH/2,tip.z);g.add(col);

  let power=0,burst=0,acc=0,ri=0,cursor=0;const rnd=Math.random;
  function emit(k){const i=cursor;cursor=(cursor+1)%N;life[i]=0;kind[i]=k;
    if(k===0){// 中心向上的水柱，顶端散开落回池中
      const a=rnd()*Math.PI*2,sp=.12+rnd()*.32;pos[i*3]=tip.x+Math.cos(a)*.02;pos[i*3+1]=tip.y+colH*.85;pos[i*3+2]=tip.z+Math.sin(a)*.02;vel[i*3]=Math.cos(a)*sp;vel[i*3+1]=2.05+rnd()*.45+burst*.8;vel[i*3+2]=Math.sin(a)*sp;}
    else{// 水晶四周向外的小弧线
      const a=Math.floor(rnd()*8)/8*Math.PI*2+(rnd()-.5)*.12,r=.16;pos[i*3]=tip.x+Math.cos(a)*r;pos[i*3+1]=tip.y-.08;pos[i*3+2]=tip.z+Math.sin(a)*r;const sp=(bowlR*.55)*(1.75+rnd()*.25);vel[i*3]=Math.cos(a)*sp;vel[i*3+1]=1.35+rnd()*.25;vel[i*3+2]=Math.sin(a)*sp;}}
  function ring(x,z,s){const m=rings[ri];ri=(ri+1)%rings.length;m.position.set(x,waterY+.005,z);m.userData.t=0;m.userData.s=s;m.visible=true;}
  return {waterY,bowlR,
    update(dt,on){
      power+=((on?1:0)-power)*Math.min(1,dt*1.5);burst=Math.max(0,burst-dt*.5);if(on&&power<.05)burst=1;
      g.visible=power>.01;col.scale.set(1,Math.max(.01,power),1);col.position.y=tip.y+colH*power/2;col.material.opacity=.5*power;col.rotation.y+=dt*3;
      acc+=dt*power*(1700+burst*900);while(acc>1){emit(rnd()<.55?0:1);acc--;}
      for(let i=0;i<N;i++){if(life[i]<0)continue;life[i]+=dt;vel[i*3+1]-=9.8*dt;pos[i*3]+=vel[i*3]*dt;pos[i*3+1]+=vel[i*3+1]*dt;pos[i*3+2]+=vel[i*3+2]*dt;
        const x=pos[i*3]-tip.x,z=pos[i*3+2]-tip.z,r=Math.hypot(x,z);
        if(pos[i*3+1]<waterY&&vel[i*3+1]<0){if(r<bowlR&&rnd()<.06)ring(pos[i*3],pos[i*3+2],.05+rnd()*.06);life[i]=-1;pos[i*3+1]=-999;
          if(rnd()<.08){const k=Math.floor(rnd()*M);mlife[k]=0;mpos[k*3]=tip.x+x;mpos[k*3+1]=waterY+.05;mpos[k*3+2]=tip.z+z;}}
        if(r>bowlR*1.05){life[i]=-1;pos[i*3+1]=-999;}}
      geo.attributes.position.needsUpdate=true;
      for(let k=0;k<M;k++){if(mlife[k]<0)continue;mlife[k]+=dt;mpos[k*3+1]+=dt*.25;if(mlife[k]>1.6){mlife[k]=-1;mpos[k*3+1]=-999;}}mgeo.attributes.position.needsUpdate=true;mist.material.opacity=.18*power;
      for(const m of rings){if(!m.visible)continue;m.userData.t+=dt;const t=m.userData.t;const s=m.userData.s*(1+t*5);m.scale.set(s,s,s);m.material.opacity=Math.max(0,.55*(1-t/.9))*power;if(t>.9)m.visible=false;}
    }};
}
