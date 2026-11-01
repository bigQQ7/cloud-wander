import * as THREE from 'three';
import {zones,obstacles} from './physics.js?v=spawn2';

// Real tapered blades and flower heads: no transparent billboards or cutout edges.
function geometry(build){
 const p=[],c=[],u=[];
 const tri=(a,b,d,color,heights=[0,0,1])=>{for(const [i,v] of [a,b,d].entries()){p.push(...v);c.push(...color);u.push(0,heights[i]);}};
 const quad=(a,b,d,e,color,h0=0,h1=1)=>{tri(a,b,d,color,[h0,h0,h1]);tri(b,e,d,color,[h0,h1,h1]);};
 build(tri,quad);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));g.computeVertexNormals();return g;
}
export function createMeadow(scene,data,groundMeshes,coarse=false){
 let seed=94817;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
 const wind={value:0},materials=[];let pond;const pondInverse={value:new THREE.Matrix4()},pondRadius={value:0};
 const footprints={value:Array.from({length:8},()=>new THREE.Vector4(0,-1000,0,-1000))};
 let footprintIndex=0,lastFootprintTime=-1000;

 function material(stiffness=1,glow=.5){const m=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.92});
  m.onBeforeCompile=s=>{s.uniforms.pondInverse=pondInverse;s.uniforms.pondRadius=pondRadius;s.uniforms.meadowTime=wind;s.uniforms.meadowFootprints=footprints;s.vertexShader='uniform mat4 pondInverse;uniform float pondRadius;uniform float meadowTime;uniform vec4 meadowFootprints[8];\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vec3 root=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
   float gust=sin(root.x*.37+root.z*.24+meadowTime*1.15)*.65+sin(root.z*.83-meadowTime*1.6)*.35;
   transformed.x+=gust*uv.y*uv.y*${(.095*stiffness).toFixed(3)};
   transformed.z+=sin(root.x*.46+meadowTime*.9)*uv.y*uv.y*${(.045*stiffness).toFixed(3)};
   float pressure=0.;vec2 push=vec2(0.);
   for(int i=0;i<8;i++){
    vec4 foot=meadowFootprints[i];float age=meadowTime-foot.w;
    vec2 away=root.xz-foot.xz;float distanceToFoot=length(away);
    float contact=(1.-smoothstep(.18,1.05,distanceToFoot))*(1.-smoothstep(.35,2.0,age));
    contact*=1.-smoothstep(.45,1.1,abs(root.y-foot.y));
    if(contact>pressure){pressure=contact;push=(away+vec2(.001))/max(distanceToFoot,.12);}
   }
   mat4 worldGrass=modelMatrix*instanceMatrix;
   vec3 displacement=vec3(push.x*.65,0.,push.y*.65)*pressure*uv.y*uv.y;
   transformed.x+=dot(displacement,worldGrass[0].xyz)/max(dot(worldGrass[0].xyz,worldGrass[0].xyz),.001);
   transformed.z+=dot(displacement,worldGrass[2].xyz)/max(dot(worldGrass[2].xyz,worldGrass[2].xyz),.001);
   transformed.y*=1.-pressure*.78*uv.y;
   vec3 pondPoint=(pondInverse*vec4(root,1.)).xyz;
   if(pondRadius>0.&&length(pondPoint.xz)<pondRadius&&abs(pondPoint.y)<2.)transformed=vec3(0.);
   meadowTip=uv.y;
  `);s.vertexShader='varying float meadowTip;\n'+s.vertexShader;
  // Thin blades let golden-hour light through: tips glow warm, roots stay deep green.
  s.fragmentShader='varying float meadowTip;\n'+s.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n totalEmissiveRadiance+=diffuseColor.rgb*vec3(1.,.86,.55)*meadowTip*meadowTip*'+glow.toFixed(2)+';\n diffuseColor.rgb*=mix(.55,1.,meadowTip);');};m.customProgramCacheKey=()=>`meadow-wind-${stiffness}-${glow}`;materials.push(m);return m;}
 const grass=geometry((tri,quad)=>{
  for(let b=0;b<12;b++){
   const angle=rnd()*Math.PI*2,az=rnd()*Math.PI*2,r=rnd()*.21,ox=Math.cos(az)*r,oz=Math.sin(az)*r,h=.48+rnd()*.72,w=.0084+rnd()*.012,bend=.20+rnd()*.40,dry=rnd()<.16;
   const rows=[];
   for(let k=0;k<=4;k++){const t=k/4,spread=w*(1-t)*(.8+Math.sin(t*Math.PI)*.5),x=ox+Math.cos(angle)*bend*t*t,z=oz+Math.sin(angle)*bend*t*t;
    rows.push([[x-Math.sin(angle)*spread,h*t,z+Math.cos(angle)*spread],[x+Math.sin(angle)*spread,h*t,z-Math.cos(angle)*spread]]);}
   for(let k=0;k<4;k++){const t=(k+.5)/4;const col=dry?[.06+t*.30,.075+t*.24,.02+t*.06]:[.03+t*.13,.065+t*.21,.012+t*.04];quad(rows[k][0],rows[k][1],rows[k+1][0],rows[k+1][1],col,k/4,(k+1)/4);}
  }
 });
 function flowers(kind){return geometry((tri,quad)=>{
  for(let stem=0;stem<3;stem++){
   const x=(rnd()-.5)*.35,z=(rnd()-.5)*.35,h=.43+rnd()*.42;
   quad([x-.005,0,z],[x+.005,0,z],[x-.005,h,z],[x+.005,h,z],[.035,.09,.012]);
   if(kind==='purple'){
    for(let k=0;k<7;k++)for(let j=0;j<4;j++){const a=j*Math.PI/2+k*.8,y=h-.2+k*.045,dx=Math.cos(a),dz=Math.sin(a),r=.035*(1-k*.07);tri([x,y-.025,z],[x+dx*r-dz*.013,y,z+dz*r+dx*.013],[x+dx*r+dz*.013,y+.025,z+dz*r-dx*.013],[.40,.24,.62],[.7,.9,1]);}
   }else{
    const petals=kind==='white'?7:5,sz=kind==='white'?.065:.039;
    for(let j=0;j<petals;j++){const a=j*Math.PI*2/petals,dx=Math.cos(a),dz=Math.sin(a);const center=[x,h,z],left=[x+dx*sz*.58-dz*sz*.31,h+.018,z+dz*sz*.58+dx*sz*.31],tip=[x+dx*sz,h+.009,z+dz*sz],right=[x+dx*sz*.58+dz*sz*.31,h+.018,z+dz*sz*.58-dx*sz*.31];
     const color=kind==='white'?[.95,.93,.86]:[.86,.56,.03];tri(center,left,tip,color,[1,1,1]);tri(center,tip,right,color,[1,1,1]);}
    for(let j=0;j<6;j++){const a=j*Math.PI/3,b=(j+1)*Math.PI/3;tri([x,h+.021,z],[x+Math.cos(a)*.019,h+.021,z+Math.sin(a)*.019],[x+Math.cos(b)*.019,h+.021,z+Math.sin(b)*.019],[.78,.50,.02],[1,1,1]);}
   }
   for(let k=0;k<3;k++){const a=k*2.6,dx=Math.cos(a),dz=Math.sin(a),y=h*(.2+k*.17);tri([x,y,z],[x+dx*.08-dz*.018,y+.07,z+dz*.08+dx*.018],[x+dx*.14,y+.1,z+dz*.14],[.035,.11,.015],[.2,.4,.6]);}
  }
 });}
 const seeds=geometry((tri,quad)=>{
  for(let stem=0;stem<4;stem++){
   const x=(rnd()-.5)*.3,z=(rnd()-.5)*.3,h=.7+rnd()*.45,lean=(rnd()-.5)*.18;
   quad([x-.004,0,z],[x+.004,0,z],[x-.003+lean,h,z],[x+.003+lean,h,z],[.12,.13,.05],0,1);
   for(let k=0;k<9;k++){const y=h-.02+k*.022,a=k*2.1,dx=Math.cos(a)*.016,dz=Math.sin(a)*.016;
    tri([x+lean-dz*.5,y,z+dx*.5],[x+lean+dz*.5,y,z-dx*.5],[x+lean+dx,y+.05,z+dz],[.62,.50,.24],[1,1,1]);}
  }
 });
 const fern=geometry((tri,quad)=>{
  for(let f=0;f<5;f++){const a=f*Math.PI*.4,dx=Math.cos(a),dz=Math.sin(a),h=.55+rnd()*.35;
   for(let k=1;k<=10;k++){const t=k/11,y=h*t,center=[dx*t*t*.55,y,dz*t*t*.55],len=.16*Math.sin(t*Math.PI);
    for(const sign of [-1,1]){const tip=[center[0]-dz*len*sign+dx*.075,center[1]+.055,center[2]+dx*len*sign+dz*.075];const mid=[(center[0]+tip[0])/2,(center[1]+tip[1])/2,(center[2]+tip[2])/2];tri(center,[mid[0]+dx*.018,mid[1]+.012,mid[2]+dz*.018],tip,[.045,.14,.017],[t,t,t]);tri(center,tip,[mid[0]-dx*.018,mid[1]-.012,mid[2]-dz*.018],[.035,.105,.012],[t,t,t]);}
   }
  }
 });
 const paths=data.objects.filter(o=>o.name.startsWith('Path • aged limestone')).map(o=>o.position);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);scene.updateMatrixWorld(true);
 const surfaces=[];
 for(const ground of groundMeshes)for(let id=0;id<ground.count;id++){
  const matrix=new THREE.Matrix4();ground.getMatrixAt(id,matrix);matrix.premultiply(ground.matrixWorld);
  const mesh=new THREE.Mesh(ground.geometry,ground.material);mesh.matrixAutoUpdate=false;mesh.matrixWorld.copy(matrix);
  const box=ground.geometry.boundingBox.clone().applyMatrix4(matrix),center=box.getCenter(new THREE.Vector3());
  const zone=zones.reduce((best,z)=>Math.hypot(z.x-center.x,z.z-center.z)<Math.hypot(best.x-center.x,best.z-center.z)?z:best,zones[0]);
  const edges=new Map(),pos=ground.geometry.attributes.position,ix=ground.geometry.index;
  for(let i=0;i<(ix?ix.count:pos.count);i+=3){
   const vs=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(pos,ix?ix.getX(i+j):i+j).applyMatrix4(matrix));
   for(let j=0;j<3;j++){const a=vs[j],b=vs[(j+1)%3],key=[a.toArray().map(v=>v.toFixed(4)).join(','),b.toArray().map(v=>v.toFixed(4)).join(',')].sort().join('|');const e=edges.get(key);if(e)e.n++;else edges.set(key,{a,b,n:1});}
  }
  surfaces.push({mesh,box,zone,normal:new THREE.Matrix3().getNormalMatrix(matrix),edges:[...edges.values()].filter(e=>e.n===1)});
 }
 function sample(surface){
  const {box,mesh,zone}=surface,x=box.min.x+rnd()*(box.max.x-box.min.x),z=box.min.z+rnd()*(box.max.z-box.min.z);
  ray.set(new THREE.Vector3(x,box.max.y+1,z),down);ray.far=box.max.y-box.min.y+2;
  const hit=ray.intersectObject(mesh,false)[0];
  if(!hit||hit.face.normal.clone().applyNormalMatrix(surface.normal).y<Math.cos(Math.PI*35/180))return null;
  const y=hit.point.y;
  if(paths.some(p=>Math.abs(p[1]-y)<1&&Math.abs(p[0]-x)<1.1&&Math.abs(p[2]-z)<.9))return null;
  if(obstacles.some(o=>y<o.h&&((o.x-x)/(o.rx+.35))**2+((o.z-z)/(o.rz+.35))**2<1))return null;
  let edge=1.5;
  for(const {a,b} of surface.edges){const dx=b.x-a.x,dz=b.z-a.z,t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);edge=Math.min(edge,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));}
  const taper=.3+.7*THREE.MathUtils.smoothstep(edge,0,1.5);
  if(rnd()>taper)return null;
  return{x,z,y:y-.015,taper};
 }
 const groups=[{g:grass,mat:material(1,.16),density:coarse?30:60,name:'细叶草丛'}, {g:grass,mat:material(.75,.10),density:coarse?7:14,size:.42,name:'低矮草层'}, {g:flowers('white'),mat:material(.65,.18),density:.3,name:'白色野菊'}, {g:flowers('yellow'),mat:material(.7,.25),density:.2,name:'黄色野花'}, {g:flowers('purple'),mat:material(.55,.3),density:.16,name:'紫色花穗'}, {g:seeds,mat:material(.6,.6),density:coarse?.12:.22,name:'金色草穗'}, {g:fern,mat:material(.4,.3),density:.12,name:'蕨叶'}];
 let total=0;const objects=[];
 for(const def of groups)for(const surface of surfaces){
  const {box,zone}=surface,count=Math.round((box.max.x-box.min.x)*(box.max.z-box.min.z)*def.density),chunks=new Map();
  for(let i=0;i<count;i++){const p=sample(surface);if(!p)continue;const key=Math.floor(p.x/8)+','+Math.floor(p.z/8);if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(p);}
  for(const [key,points] of chunks){
   for(let i=points.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[points[i],points[j]]=[points[j],points[i]];}
   const mesh=new THREE.InstancedMesh(def.g,def.mat,points.length),dummy=new THREE.Object3D(),color=new THREE.Color();mesh.name=`${zone.name} • ${def.name} • ${key}`;
   points.forEach((p,i)=>{const sz=(.65+rnd()*.65)*(def.size||1);dummy.position.set(p.x,p.y,p.z);dummy.rotation.y=rnd()*Math.PI*2;dummy.scale.set(sz,sz*(.8+rnd()*.35)*p.taper*(/草丛|草层|草穗/.test(def.name)&&zone.name!=='风之塔'?.45:1),sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);const v=.78+rnd()*.45;mesh.setColorAt(i,color.setRGB(v,v,v*.85));});
   mesh.userData.meadowCapacity=points.length;mesh.receiveShadow=true;mesh.castShadow=false;mesh.frustumCulled=true;mesh.computeBoundingSphere();mesh.boundingSphere.radius+=1;scene.add(mesh);objects.push(mesh);total+=points.length;
  }
 }
 const frustum=new THREE.Frustum(),projection=new THREE.Matrix4(),sphere=new THREE.Sphere();let lodFrame=0,managed=[];
 return {objects,count:total,setPond(value){pond=value;},update(seconds,player,walking=false,camera){
  if(camera&&lodFrame++%4===0){
   if(!managed.length||lodFrame%120===1){managed=[];scene.traverse(o=>{if(o.isInstancedMesh&&o.userData.meadowCapacity)managed.push(o);});}
   projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);
   let requested=0;const active=[];
   for(const mesh of managed){let visible=true;for(let p=mesh;p;p=p.parent)if(!p.visible)visible=false;if(!visible)continue;
    sphere.copy(mesh.boundingSphere).applyMatrix4(mesh.matrixWorld);if(!frustum.intersectsSphere(sphere)){mesh.count=0;continue;}
    const distance=sphere.center.distanceTo(camera.position),count=Math.floor(mesh.userData.meadowCapacity*(distance<25?1:distance<50?.35:.1));active.push({mesh,count});requested+=count;
   }
   const budget=Math.min(1,60000/Math.max(1,requested));let drawn=0;
   for(const {mesh,count} of active){mesh.count=Math.floor(count*budget);drawn+=mesh.count;}
   const canvas=document.querySelector('#world');if(canvas)canvas.dataset.grassDrawn=String(drawn);
  }
  if(pond){pondRadius.value=pond.sync()?pond.radius*1.12:0;pondInverse.value.copy(pond.inverse);}
  wind.value=seconds;
  if(walking&&player?.grounded&&seconds-lastFootprintTime>=.12){
   footprints.value[footprintIndex].set(player.pos.x,player.pos.y,player.pos.z,seconds);
   footprintIndex=(footprintIndex+1)%footprints.value.length;lastFootprintTime=seconds;
  }
 }};
}

let soilTexture;
export function styleMeadowGround(mat){
 if(!soilTexture){
  const size=256,bytes=new Uint8Array(size*size*4);let seed=178;
  const lattice=new Float32Array(1024);for(let i=0;i<lattice.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;lattice[i]=(seed>>>0)/4294967296;}
  const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),sx=x-ix,sy=y-iy,tx=sx*sx*(3-2*sx),ty=sy*sy*(3-2*sy),at=(a,b)=>lattice[(a&31)+32*(b&31)];return(at(ix,iy)*(1-tx)+at(ix+1,iy)*tx)*(1-ty)+(at(ix,iy+1)*(1-tx)+at(ix+1,iy+1)*tx)*ty;};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   seed=(Math.imul(seed,1664525)+1013904223)|0;
   const fine=(seed>>>0)/4294967296,patch=noise(x/32,y/32)-.5,grain=noise(x/8,y/8)-.5;
   const v=Math.round(220+patch*18+fine*10+grain*12),i=(x+y*size)*4;bytes[i]=v;bytes[i+1]=v;bytes[i+2]=Math.max(0,v-12);bytes[i+3]=255;
  }
  soilTexture=new THREE.DataTexture(bytes,size,size);soilTexture.wrapS=soilTexture.wrapT=THREE.RepeatWrapping;soilTexture.magFilter=THREE.LinearFilter;soilTexture.minFilter=THREE.LinearMipmapLinearFilter;soilTexture.generateMipmaps=true;soilTexture.needsUpdate=true;
 }
 mat.color.setRGB(.035,.075,.016);
 mat.onBeforeCompile=s=>{s.uniforms.meadowSoil={value:soilTexture};s.vertexShader='varying vec3 meadowPosition;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vec4 meadowLocal=vec4(transformed,1.);\n #ifdef USE_INSTANCING\n meadowLocal=instanceMatrix*meadowLocal;\n #endif\n meadowPosition=(modelMatrix*meadowLocal).xyz;');s.fragmentShader='varying vec3 meadowPosition;uniform sampler2D meadowSoil;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n diffuseColor.rgb*=texture2D(meadowSoil,meadowPosition.xz*.45).rgb;');};
 mat.customProgramCacheKey=()=> 'natural-meadow-soil';
}
