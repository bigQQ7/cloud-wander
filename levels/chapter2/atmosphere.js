// 午后粉色梦境氛围：粉色天空与大云团、远处粉色草丘和绒球树、浓一点的粉色雾、飘落的花瓣、柔光与粉色调色。
import {EffectComposer} from './vendor/postprocessing/EffectComposer.js';
import {RenderPass} from './vendor/postprocessing/RenderPass.js';
import {UnrealBloomPass} from './vendor/postprocessing/UnrealBloomPass.js';
import {OutputPass} from './vendor/postprocessing/OutputPass.js';
import {FXAAShader} from './vendor/shaders/FXAAShader.js';
import {ShaderPass} from './vendor/postprocessing/ShaderPass.js';

export function setupAtmosphere({T,scene,renderer,camera,lake}){
  let seed=2026;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const SHORE={x:12,z:-6};

  // ---- 天空与雾
  const sky=document.createElement('canvas');sky.width=16;sky.height=512;const sc=sky.getContext('2d'),gr=sc.createLinearGradient(0,0,0,512);
  gr.addColorStop(0,'#d9bfe8');gr.addColorStop(.35,'#f0cde6');gr.addColorStop(.62,'#fbdbea');gr.addColorStop(1,'#fde8f0');sc.fillStyle=gr;sc.fillRect(0,0,16,512);
  const st=new T.CanvasTexture(sky);st.colorSpace=T.SRGBColorSpace;scene.background=st;
  scene.fog=new T.Fog('#f2c9df',75,300);lake?.syncFog(scene.fog);

  // ---- 天上的大云团（参考图里那种柔软的白粉色云）
  const cc=document.createElement('canvas');cc.width=cc.height=256;const cx=cc.getContext('2d');
  for(let i=0;i<22;i++){const x=40+rnd()*176,y=95+rnd()*90-Math.abs(x-128)*.25,r=26+rnd()*42;const g=cx.createRadialGradient(x,y-r*.25,0,x,y,r);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.55,'rgba(255,246,251,.85)');g.addColorStop(1,'rgba(246,206,228,0)');cx.fillStyle=g;cx.beginPath();cx.arc(x,y,r,0,Math.PI*2);cx.fill();}
  const ct=new T.CanvasTexture(cc);ct.colorSpace=T.SRGBColorSpace;
  const clouds=[];
  for(let i=0;i<46;i++){
    const a=rnd()*Math.PI*2,d=165+rnd()*110,w=55+rnd()*95;
    const m=new T.SpriteMaterial({map:ct,color:new T.Color().setHSL(.92+rnd()*.05,.55,.93+rnd()*.06),transparent:true,opacity:.8+rnd()*.2,depthWrite:false,fog:false});
    const s=new T.Sprite(m);s.position.set(SHORE.x+Math.cos(a)*d,18+rnd()*70,SHORE.z+Math.sin(a)*d);s.scale.set(w,w*(.5+rnd()*.25),1);s.renderOrder=-3;scene.add(s);clouds.push(s);
  }

  // ---- 远处一圈粉色草丘：柔和起伏 + 按高度渐变 + 草地纹理 + 近岸草簇 + 岸边浪花
  const SM=T.MathUtils.smoothstep;
  const fbm=(x,z)=>{let v=0,a=1,f=.022;for(let o=0;o<4;o++){v+=a*Math.sin(x*f+o*1.7)*Math.cos(z*f*1.13+o*.9);a*=.5;f*=2.07;}return v;};
  const hillH=(x,z)=>{const r=Math.hypot(x,z);const rise=SM(r,84,104);const mound=Math.max(0,fbm(x*1.6+40,z*1.6-20))*4.2;return -1.0+rise*(3.0+fbm(x,z)*2.0+mound)+Math.max(0,(r-150)*.07);};
  const shoreGeo=new T.RingGeometry(80,270,260,44);shoreGeo.rotateX(-Math.PI/2);
  const pos=shoreGeo.getAttribute('position'),cols=[],uvs=[];
  const cLow=new T.Color('#e56fb0'),cMid=new T.Color('#f59ccb'),cTop=new T.Color('#ffcfe5'),cLilac=new T.Color('#d8a2ea'),cGold=new T.Color('#ffe08a'),tmp=new T.Color();
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i),h=hillH(x,z);pos.setY(i,h);uvs.push(x*.11,z*.11);
    const t=SM(h,-.6,7.5);tmp.copy(cLow).lerp(cMid,Math.min(1,t*1.6));if(t>.55)tmp.lerp(cTop,(t-.55)/.45);
    const patch=fbm(x*3.1+11,z*3.1-7);if(patch>.55)tmp.lerp(cLilac,Math.min(.6,(patch-.55)*1.8));
    if(fbm(x*9.7,z*9.7)>1.15)tmp.lerp(cGold,.55);
    cols.push(tmp.r,tmp.g,tmp.b);
  }
  shoreGeo.setAttribute('color',new T.Float32BufferAttribute(cols,3));shoreGeo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));shoreGeo.computeVertexNormals();
  const gc=document.createElement('canvas');gc.width=gc.height=512;const gx=gc.getContext('2d');gx.fillStyle='#f4eaf0';gx.fillRect(0,0,512,512);
  for(let i=0;i<9000;i++){const x=rnd()*512,y=rnd()*512,l=6+rnd()*12,a=-Math.PI/2+(rnd()-.5)*.9,v=200+rnd()*55|0;gx.strokeStyle=`rgba(${v},${v-28-rnd()*20|0},${v-12|0},${.35+rnd()*.4})`;gx.lineWidth=1+rnd()*1.6;gx.beginPath();gx.moveTo(x,y);gx.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);gx.stroke();}
  const gtex=new T.CanvasTexture(gc);gtex.wrapS=gtex.wrapT=T.RepeatWrapping;gtex.colorSpace=T.SRGBColorSpace;gtex.anisotropy=4;
  const shore=new T.Mesh(shoreGeo,new T.MeshLambertMaterial({vertexColors:true,map:gtex}));shore.position.set(SHORE.x,0,SHORE.z);shore.name='pink meadow shore';scene.add(shore);
  const hillAt=(wx,wz)=>hillH(wx-SHORE.x,wz-SHORE.z);
  // 近岸毛茸茸的草簇（两片交叉的草叶贴片）
  const tc=document.createElement('canvas');tc.width=tc.height=128;const tx=tc.getContext('2d');
  for(let i=0;i<38;i++){const bx=8+rnd()*112,h=50+rnd()*74,lean=(rnd()-.5)*34,g=tx.createLinearGradient(0,128,0,128-h);g.addColorStop(0,'#f28ec3');g.addColorStop(.55,'#ffb8da');g.addColorStop(1,'#fff3f9');tx.fillStyle=g;tx.beginPath();tx.moveTo(bx-2.2,128);tx.quadraticCurveTo(bx+lean*.4,128-h*.6,bx+lean,128-h);tx.quadraticCurveTo(bx+lean*.4+1.6,128-h*.55,bx+2.2,128);tx.fill();}
  const ttex=new T.CanvasTexture(tc);ttex.colorSpace=T.SRGBColorSpace;
  const tuftGeo=(()=>{const a=new T.PlaneGeometry(1,1);a.translate(0,.5,0);const b=a.clone();b.rotateY(Math.PI/2);const g=new T.BufferGeometry();const merge=[a,b];const p=[],u=[],n=[];for(const m of merge){p.push(...m.getAttribute('position').array);u.push(...m.getAttribute('uv').array);n.push(...m.getAttribute('normal').array.map((v,i)=>i%3===1?1:0));}g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(u,2));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));g.setIndex([0,2,1,2,3,1,4,6,5,6,7,5]);return g;})();
  const NTF=0,tufts=new T.InstancedMesh(tuftGeo,new T.MeshLambertMaterial({map:ttex,alphaTest:.4,side:T.DoubleSide,emissive:'#ff8fc6',emissiveIntensity:.22}),NTF);
  let ti=0;const tm=new T.Matrix4(),tq=new T.Quaternion(),tv=new T.Vector3(),ts=new T.Vector3(),te=new T.Euler();
  for(let k=0;k<NTF*3&&ti<NTF;k++){const a=rnd()*Math.PI*2,d=84+rnd()*44,x=SHORE.x+Math.cos(a)*d,z=SHORE.z+Math.sin(a)*d,y=hillAt(x,z);if(y<-.25)continue;const s=.32+rnd()*.38;te.set(0,rnd()*Math.PI,0);tq.setFromEuler(te);tm.compose(tv.set(x,y-.03,z),tq,ts.set(s*1.9,s,s*1.9));tufts.setMatrixAt(ti,tm);tufts.setColorAt(ti,new T.Color().setHSL(.93+rnd()*.03,.6+rnd()*.25,.8+rnd()*.08));ti++;}
  tufts.count=ti;tufts.instanceMatrix.needsUpdate=true;if(tufts.instanceColor)tufts.instanceColor.needsUpdate=true;// 草簇已按方案 A 去掉：只保留光滑草丘 + 细草叶纹理
  // 岸边浪花：沿草地与湖水的交界线画一圈柔和的白边
  {const N=360,fv=[],fu=[],fi=[];const fc=document.createElement('canvas');fc.width=4;fc.height=64;const fx=fc.getContext('2d'),fg=fx.createLinearGradient(0,0,0,64);fg.addColorStop(0,'rgba(255,255,255,0)');fg.addColorStop(.55,'rgba(255,248,252,.85)');fg.addColorStop(1,'rgba(255,255,255,0)');fx.fillStyle=fg;fx.fillRect(0,0,4,64);
   for(let i=0;i<=N;i++){const a=i/N*Math.PI*2,c=Math.cos(a),s=Math.sin(a);let r=82;while(r<120&&hillH(c*r,s*r)<-.33)r+=.25;for(const [dr,v] of [[-1.6,0],[.5,1]]){fv.push(SHORE.x+c*(r+dr),-.31,SHORE.z+s*(r+dr));fu.push(i/8,v);}if(i<N){const b=i*2;fi.push(b,b+2,b+1,b+1,b+2,b+3);}}
   const fgeo=new T.BufferGeometry();fgeo.setAttribute('position',new T.Float32BufferAttribute(fv,3));fgeo.setAttribute('uv',new T.Float32BufferAttribute(fu,2));fgeo.setIndex(fi);
   const ft=new T.CanvasTexture(fc);const foam=new T.Mesh(fgeo,new T.MeshBasicMaterial({map:ft,transparent:true,depthWrite:false,side:T.DoubleSide,fog:true}));foam.renderOrder=1;scene.add(foam);}

  // ---- 绒球树、粉色尖穗、灌木（实例化，开销很小）
  const trunkGeo=new T.CylinderGeometry(.18,.32,1,6);trunkGeo.translate(0,.5,0);
  const ballGeo=new T.SphereGeometry(1,14,10);
  const nT=110,trunks=new T.InstancedMesh(trunkGeo,new T.MeshLambertMaterial({color:'#b98aa6'}),nT);
  const balls=new T.InstancedMesh(ballGeo,new T.MeshLambertMaterial({color:'#ffffff'}),nT*3+260);
  const plumeGeo=new T.SphereGeometry(1,14,20);{const p=plumeGeo.getAttribute('position'),c=[],a=new T.Color('#d9579d'),b=new T.Color('#ffd6ea');for(let i=0;i<p.count;i++){const y=p.getY(i),t=(y+1)/2,taper=Math.pow(Math.sin(Math.min(1,t*1.15)*Math.PI*.5+.05),.8)*(1-Math.pow(t,2.2)*.9),j=1+(rnd()-.5)*.38;p.setX(i,p.getX(i)*taper*j);p.setZ(i,p.getZ(i)*taper*j);p.setY(i,y+1);const k=a.clone().lerp(b,Math.pow(t,1.3));c.push(k.r,k.g,k.b);}plumeGeo.setAttribute('color',new T.Float32BufferAttribute(c,3));plumeGeo.computeVertexNormals();}
  const spikes=new T.InstancedMesh(plumeGeo,new T.MeshLambertMaterial({vertexColors:true,emissive:'#ff9fcf',emissiveIntensity:.15,flatShading:true}),48);
  const m4=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),v=new T.Vector3(),sv=new T.Vector3();let bi=0;
  const ballCol=['#ff7fb8','#ff94c4','#f26aa8','#ffb0d4','#f58ac0'];
  for(let i=0;i<nT;i++){
    const a=rnd()*Math.PI*2,d=92+rnd()*80,x=SHORE.x+Math.cos(a)*d,z=SHORE.z+Math.sin(a)*d,y=hillAt(x,z),h=4+rnd()*6,tilt=(rnd()-.5)*.5;
    e.set(tilt,rnd()*6.28,(rnd()-.5)*.4);q.setFromEuler(e);m4.compose(v.set(x,y-.2,z),q,sv.set(1,h,1));trunks.setMatrixAt(i,m4);
    const top=new T.Vector3(0,h,0).applyQuaternion(q).add(new T.Vector3(x,y,z));
    for(let k=0;k<3;k++){const r=k===0?1.8+rnd()*1.2:1+rnd()*.9;m4.compose(v.set(top.x+(k?(rnd()-.5)*3.2:0),top.y+(k?(rnd()-.6)*2:0),top.z+(k?(rnd()-.5)*3.2:0)),q.identity(),sv.set(r,r*.9,r));balls.setMatrixAt(bi,m4);balls.setColorAt(bi,new T.Color(ballCol[Math.floor(rnd()*ballCol.length)]));bi++;}
  }
  for(let i=0;i<260;i++){const a=rnd()*Math.PI*2,d=86+rnd()*90,x=SHORE.x+Math.cos(a)*d,z=SHORE.z+Math.sin(a)*d,y=hillAt(x,z),r=.8+rnd()*1.6;m4.compose(v.set(x,y+r*.3,z),q.identity(),sv.set(r*1.3,r*.8,r*1.3));balls.setMatrixAt(bi,m4);balls.setColorAt(bi,new T.Color(rnd()<.5?'#f7a3cf':'#e6a6e8'));bi++;}
  balls.count=bi;
  for(let i=0;i<48;i++){const a=rnd()*Math.PI*2,d=90+rnd()*68,x=SHORE.x+Math.cos(a)*d,z=SHORE.z+Math.sin(a)*d,y=hillAt(x,z),h=3+rnd()*4;e.set((rnd()-.5)*.3,rnd()*6.28,(rnd()-.5)*.3);q.setFromEuler(e);const w=.55+rnd()*.3;m4.compose(v.set(x,y-.15,z),q,sv.set(w,h/2,w));spikes.setMatrixAt(i,m4);}
  for(const m of [trunks,balls,spikes]){m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;scene.add(m);}

  // ---- 飘落的花瓣
  const pc=document.createElement('canvas');pc.width=pc.height=32;const px=pc.getContext('2d');px.fillStyle='#ffd3e8';px.beginPath();px.ellipse(16,16,12,7,.6,0,Math.PI*2);px.fill();px.fillStyle='#ff9fca';px.beginPath();px.ellipse(18,17,6,3,.6,0,Math.PI*2);px.fill();
  const pt=new T.CanvasTexture(pc);pt.colorSpace=T.SRGBColorSpace;
  const NP=420,pp=new Float32Array(NP*3),seeds=[];
  for(let i=0;i<NP;i++){pp[i*3]=-45+rnd()*110;pp[i*3+1]=rnd()*16;pp[i*3+2]=-40+rnd()*65;seeds.push(rnd()*6.28);}
  const petalGeo=new T.BufferGeometry();petalGeo.setAttribute('position',new T.BufferAttribute(pp,3));
  const petals=new T.Points(petalGeo,new T.PointsMaterial({map:pt,size:.32,transparent:true,depthWrite:false,alphaTest:.05}));scene.add(petals);

  // ---- 后期：柔光 + 粉色调色 + 暗角
  // Keep post-processing buffers single-sampled; smooth edges in the final pass.
  // This avoids multisample resolves across nested lake-reflection renders.
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new T.Vector2(innerWidth/2,innerHeight/2),.22,.45,.9);composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade=new ShaderPass({uniforms:{tDiffuse:{value:null}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D tDiffuse;varying vec2 vUv;
    void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float l=dot(c,vec3(.299,.587,.114));
      c=mix(vec3(l),c,1.22);c=(c-.5)*1.08+.5;
      c=c*vec3(1.02,.96,1.0)+vec3(.025,.004,.02)*(1.-l);
      
      float v=(1.-smoothstep(.3,.95,length((vUv-.5)*vec2(1.15,1.))));c*=mix(vec3(.86,.74,.84),vec3(1.),v);
      gl_FragColor=vec4(clamp(c,0.,1.),1.);}`});
  composer.addPass(grade);
  const aa=new ShaderPass(FXAAShader);
  aa.clear=true;
  composer.addPass(aa);
  const drawSize=new T.Vector2();
  function updateAA(){
    renderer.getDrawingBufferSize(drawSize);
    aa.uniforms.resolution.value.set(1/drawSize.x,1/drawSize.y);
  }
  updateAA();

  return {
    composer,
    render(){renderer.setScissorTest(false);composer.render();},
    resize(){composer.setSize(innerWidth,innerHeight);updateAA();},
    update(t,dt){
      const a=petalGeo.getAttribute('position');
      for(let i=0;i<NP;i++){let y=a.getY(i)-dt*(.35+.2*Math.sin(seeds[i]));let x=a.getX(i)+dt*(1.6+.9*Math.sin(t*.7+seeds[i]));let z=a.getZ(i)+dt*(.55+.35*Math.cos(t*.5+seeds[i]));if(z>25)z-=65;if(y<-.3){y=14+rnd()*3;x=-45+rnd()*110;}if(x>65)x-=110;a.setXYZ(i,x,y,z);}
      a.needsUpdate=true;
    },
  };
}
