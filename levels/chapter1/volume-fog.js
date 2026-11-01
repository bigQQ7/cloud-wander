import * as THREE from 'three';
import {sunDirection,sunColor,hazeColor} from './lighting.js?v=mvp3';

const vertex=`varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`;
const fragment=`precision highp float;
precision highp sampler3D;
varying vec2 vUv;
uniform sampler2D sceneDepth;
uniform sampler3D cloudNoise;
uniform mat4 inverseProjection;
uniform mat4 cameraWorld;
uniform vec3 cameraPositionWorld;
uniform float time;
uniform int steps;
uniform vec3 cloudCenters[39];
uniform vec3 cloudRadii[39];
uniform vec3 sunDir;
uniform vec3 sunTint;
uniform vec3 haze;
uniform int seaSteps;
float noiseField(vec3 p){
 vec3 drift=vec3(time*.00015,0.,time*.00006);
 return texture(cloudNoise,p*.035+drift).r*.60
      + texture(cloudNoise,p*.084+drift*1.6).r*.28
      + texture(cloudNoise,p*.19+drift*2.1).r*.12;
}
float density(vec3 p){
 float hull=-10.;
 if(p.y>22.){
  for(int i=27;i<39;i++){
   vec3 r=cloudRadii[i],center=cloudCenters[i];
   vec3 q=(p-center)/r;
   vec3 crown=(p-center-vec3(r.x*.22,r.y*.55,0.))/(r*vec3(.55,.93,.70));
   vec3 shoulder=(p-center-vec3(-r.x*.36,r.y*.25,r.z*.10))/(r*vec3(.48,.8,.68));
   hull=max(hull,max(1.-dot(q,q),max(1.-dot(crown,crown),1.-dot(shoulder,shoulder))));
  }
 }else{
  for(int i=0;i<27;i++){
   vec3 q=(p-cloudCenters[i])/cloudRadii[i]*vec3(1.16,1.,1.16);
   hull=max(hull,1.-dot(q,q));
  }
 }
 if(hull<-.35)return 0.;
 float n=noiseField(p.y>22.?p*.33:p);
 return smoothstep(.02,.48,hull+(n-.5)*1.9)*.9;

}
// Continuous sea of clouds below the islands: a rolling top surface with billows.
float seaTop(vec3 p){
 vec3 drift=vec3(0.);
 p.xz-=vec2(.32,.14)*time;
 // Large swells plus rounded cumulus billows give the surface readable relief.
 vec2 warped=p.xz+vec2(
  texture(cloudNoise,vec3(p.xz*.0017,.21)+drift).r,
  texture(cloudNoise,vec3(p.zx*.0019,.73)+drift).r)*24.;
 float swell=texture(cloudNoise,vec3(warped*.0025,.31)+drift).r;
 float broad=texture(cloudNoise,vec3(warped*.007,.67)+drift*1.3).r;
 float detail=texture(cloudNoise,vec3(warped*.016,.13)+drift*1.7).r;
 return -20.+(swell-.5)*5.85+(smoothstep(.18,.82,broad)-.5)*5.2+(detail-.5)*1.17;
}
float seaDensity(vec3 p){
 float hull=(seaTop(p)-p.y)/3.5;
 if(hull<-.6)return 0.;
 float n=texture(cloudNoise,(p-vec3(.32,0.,.14)*time)*.018).r;
 vec2 moving=p.xz-vec2(.32,.14)*time;
 float patches=texture(cloudNoise,vec3(moving*.0045,.46)).r;
 float breakup=texture(cloudNoise,vec3(moving*.012,.82)).r;
 float coverage=smoothstep(.35,.64,patches*.78+breakup*.22);
 float layer=1.-smoothstep(8.,23.,seaTop(p)-p.y);
 float edgeFade=1.-smoothstep(950.,1500.,max(abs(p.x),abs(p.z)));
 return smoothstep(-.18,.72,hull+(n-.5)*.35)*coverage*layer*edgeFade;
}
vec3 reconstruct(float depth){
 vec4 q=inverseProjection*vec4(vUv*2.-1.,depth*2.-1.,1.);
 q/=q.w;return (cameraWorld*q).xyz;
}
vec2 interval(vec3 lo,vec3 hi,vec3 origin,vec3 direction,float limit){
 vec3 a=(lo-origin)/direction,b=(hi-origin)/direction;
 vec3 nearT=min(a,b),farT=max(a,b);
 return vec2(max(max(nearT.x,nearT.y),max(nearT.z,0.)),min(min(farT.x,farT.y),min(farT.z,limit)));
}
vec4 traceBank(vec2 span,vec3 origin,vec3 direction,bool upper,bool sea){
 if(span.y<=span.x)return vec4(0.);
 int count=sea?seaSteps:(upper?48:steps);
 float ds=(span.y-span.x)/float(count);
 float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
 float t=span.x+ds*(.5+(jitter-.5)*.08),transmittance=1.;vec3 scatter=vec3(0.);
 vec3 lightDirection=sunDir;
 float silver=pow(max(dot(direction,lightDirection),0.),6.);
 float lightStep=upper?11.:(sea?4.:2.5);
 for(int i=0;i<80;i++){
  if(i>=count||transmittance<.018)break;
  vec3 p=origin+direction*t;float d=sea?seaDensity(p):density(p);
  if(d>.003){
   float sunVisibility=sea?exp(-(seaDensity(p+lightDirection*lightStep)+seaDensity(p+lightDirection*lightStep*2.4)*.65)*2.6):exp(-(density(p+lightDirection*lightStep)+density(p+lightDirection*lightStep*2.4)*.65)*1.7);
   // Cool blue-grey in the troughs, warm golden on sunlit tops (golden hour).
   vec3 lighting=mix(vec3(.40,.48,.64),sunTint*1.36,.12+.88*sunVisibility);
   if(sea){
    // Deeper inside the sea is darker and bluer; billow crests catch the warm sun.
    float inside=clamp((seaTop(p)-p.y)/9.,0.,1.);
    lighting=mix(vec3(.43,.52,.68),sunTint*1.22,.25+.75*sunVisibility)*mix(1.,.82,inside);
   }
   lighting+=sunTint*silver*(sea?.18:.42)*sunVisibility;
   // Aerial perspective: far clouds melt into the warm horizon haze.
   lighting=mix(lighting,haze*1.05,1.-exp(-t*(sea?.0012:.0022)));
   float opacity=1.-exp(-d*ds*(upper?.075:(sea?.45:.28)));
   scatter+=transmittance*opacity*lighting;transmittance*=1.-opacity;
  }
  t+=ds;
 }
 return vec4(scatter,1.-transmittance);
}
void main(){
 vec3 origin=cameraPositionWorld,direction=normalize(reconstruct(1.)-origin);
 float depth=texture2D(sceneDepth,vUv).r;
 float limit=depth>.99999?1600.:length(reconstruct(depth)-origin);
 vec2 lower=interval(vec3(-145.,-50.,-100.),vec3(145.,22.,165.),origin,direction,limit);
 vec2 upper=interval(vec3(-360.,24.,-340.),vec3(360.,205.,350.),origin,direction,limit);
 vec2 seaSpan=interval(vec3(-1550.,-48.,-1550.),vec3(1550.,-4.,1550.),origin,direction,limit);
 vec4 low=traceBank(lower,origin,direction,false,false),high=traceBank(upper,origin,direction,true,false),seaLayer=traceBank(seaSpan,origin,direction,false,true);
 // Composite cloud layers in distance order, including when editing from above.
 vec4 front=lower.x<upper.x?low+high*(1.-low.a):high+low*(1.-high.a);
 // The sea sits beneath the floating banks, so it composites behind them.
 vec4 clouds=front+seaLayer*(1.-front.a);
 if(depth>.99999){
  float belowHorizon=max(-direction.y,0.);
  float horizonBlend=smoothstep(.015,.24,belowHorizon);
  float depthTint=smoothstep(.08,.48,belowHorizon);
  vec3 deepBlue=mix(haze*.92,vec3(.25,.42,.63),depthTint);
  float backgroundAlpha=(1.-clouds.a)*horizonBlend;
  clouds.rgb+=deepBlue*backgroundAlpha;
  clouds.a+=backgroundAlpha;
 }

 gl_FragColor=clouds;
}`;
const composite=`varying vec2 vUv;
uniform sampler2D sceneColor;
uniform sampler2D fogColor;
uniform sampler2D sceneDepth;
uniform vec2 fogTexel;
uniform vec2 clipPlanes;
float linearDepth(vec2 uv){float d=texture2D(sceneDepth,uv).r;return 2.*clipPlanes.x*clipPlanes.y/(clipPlanes.y+clipPlanes.x-(d*2.-1.)*(clipPlanes.y-clipPlanes.x));}
void main(){
 vec3 scene=texture2D(sceneColor,vUv).rgb;
 // Depth-aware upsampling prevents low-resolution fog leaking onto rock edges.
 float centerDepth=linearDepth(vUv),weight=0.;vec4 fog=vec4(0.);
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 at=vUv+vec2(float(x),float(y))*fogTexel;
  float spatial=exp(-float(x*x+y*y)*.75);
  float w=spatial*exp(-abs(linearDepth(at)-centerDepth)*.8);
  fog+=texture2D(fogColor,at)*w;weight+=w;
 }
 fog/=max(weight,.00001);
 gl_FragColor=vec4(scene*(1.-fog.a)+fog.rgb,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

// A small periodic 3D density field, smoothly interpolated on the GPU.
function makeNoise(){
 const N=64,values=new Uint8Array(N*N*N),lattice=new Float32Array(8*8*8);
 let seed=917;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
 for(let i=0;i<lattice.length;i++)lattice[i]=random();
 const at=(x,y,z)=>lattice[(x&7)+8*((y&7)+8*(z&7))];
 const smooth=t=>t*t*(3-2*t),mix=(a,b,t)=>a+(b-a)*t;
 for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const ix=x>>3,iy=y>>3,iz=z>>3,tx=smooth((x%8)/8),ty=smooth((y%8)/8),tz=smooth((z%8)/8);
  const a=mix(mix(at(ix,iy,iz),at(ix+1,iy,iz),tx),mix(at(ix,iy+1,iz),at(ix+1,iy+1,iz),tx),ty);
  const b=mix(mix(at(ix,iy,iz+1),at(ix+1,iy,iz+1),tx),mix(at(ix,iy+1,iz+1),at(ix+1,iy+1,iz+1),tx),ty);
  values[x+N*(y+N*z)]=Math.round(mix(a,b,tz)*255);
 }
 const tex=new THREE.Data3DTexture(values,N,N,N);tex.format=THREE.RedFormat;tex.type=THREE.UnsignedByteType;
 tex.minFilter=tex.magFilter=THREE.LinearFilter;tex.wrapS=tex.wrapT=tex.wrapR=THREE.RepeatWrapping;tex.unpackAlignment=1;tex.needsUpdate=true;return tex;
}

// [x,y,z, radiusX,radiusY,radiusZ]. Tops stay below walking surfaces.
const cloudBanks=[
 [-56,-24,-25,38,11,26],[-25,-17,-33,15,6,11],[-61,-7,-4,7,3,6],
 [-25,-5,-1,5,2.6,4],[-5,-12,2,16,7,11],[10,-25,-13,28,5,16],
 [-18,-21,32,27,9,19],[-37,-10,31,6,3,5],[-5,8,42,7,3,5],
 [20,-9,-2,12,4,9],[38,-27,-14,35,10,23],[38,-4,22,6,3,5],
 [57,-10,10,18,7,12],[70,-26,34,37,12,25],[40,-14,47,11,4,8],
 [-78,-28,25,43,12,29],[-50,-15,69,14,5,10],[-4,-31,73,34,9,22],
 [30,-18,86,17,7,12],[83,-34,80,44,13,28],[-86,-17,-49,16,6,11],
 [-7,-31,-57,42,9,27],[68,-15,-45,12,5,9],[105,-29,15,33,11,24],
 [-52,7,16,8,4,6],[5,9,-18,4,2,3],[73,11,2,5,2.8,4],
 [-190,48,-150,68,23,43],[-80,95,-220,19,9,14],[80,62,-190,42,16,30],
 [200,124,-100,80,28,53],[230,39,80,17,8,12],[140,91,210,55,22,37],
 [10,55,230,25,12,18],[-140,126,190,72,29,48],[-230,64,50,36,15,25],
 [-85,84,20,13,7,10],[70,112,40,43,20,30],[0,38,-95,20,10,15]
];

export class VolumeFog {
 constructor(renderer){
  this.startedAt=null;this.motionStamp=-1;this.renderer=renderer;this.size=new THREE.Vector2();this.width=0;this.height=0;
  const mobile=matchMedia('(pointer:coarse)').matches;
  this.cloudResolution=mobile?.5:.65;
  const type=renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType;
  this.sceneTarget=new THREE.WebGLRenderTarget(1,1,{type,depthBuffer:true,stencilBuffer:true});
  this.sceneTarget.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedInt248Type);
  this.sceneTarget.depthTexture.format=THREE.DepthStencilFormat;
  this.fogTarget=new THREE.WebGLRenderTarget(1,1,{type,depthBuffer:false});
  this.fogTarget.texture.minFilter=this.fogTarget.texture.magFilter=THREE.LinearFilter;
  this.volume=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,depthTest:false,depthWrite:false,toneMapped:false,
   uniforms:{sceneDepth:{value:this.sceneTarget.depthTexture},cloudNoise:{value:makeNoise()},cloudCenters:{value:cloudBanks.map(b=>new THREE.Vector3(...b.slice(0,3)))},cloudRadii:{value:cloudBanks.map(b=>new THREE.Vector3(...b.slice(3)))},inverseProjection:{value:new THREE.Matrix4()},cameraWorld:{value:new THREE.Matrix4()},cameraPositionWorld:{value:new THREE.Vector3()},time:{value:0},steps:{value:mobile?44:80},seaSteps:{value:mobile?48:80},sunDir:{value:sunDirection},sunTint:{value:sunColor},haze:{value:hazeColor}}});
  this.composite=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:composite,depthTest:false,depthWrite:false,
   uniforms:{sceneColor:{value:this.sceneTarget.texture},fogColor:{value:this.fogTarget.texture},sceneDepth:{value:this.sceneTarget.depthTexture},fogTexel:{value:new THREE.Vector2()},clipPlanes:{value:new THREE.Vector2()}}});
  this.screen=new THREE.Scene();this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.volume);this.quad.frustumCulled=false;this.screen.add(this.quad);this.camera=new THREE.Camera();
 }
 render(scene,camera,seconds){
  const r=this.renderer;r.getDrawingBufferSize(this.size);
  if(this.startedAt===null)this.startedAt=seconds;
  const elapsed=Math.max(0,seconds-this.startedAt);
  const motion=matchMedia('(prefers-reduced-motion: reduce)').matches?.2:1;
  const driftTime=elapsed*motion*1.5;
  const centers=this.volume.uniforms.cloudCenters.value;
  cloudBanks.forEach((bank,i)=>{
   // Long, continuous arcs avoid wrapping, popping, and camera-dependent drift.
   const phase=i*1.37,rate=.008+(i%4)*.0015;
   const amplitude=i<27?9:21;
   const dx=amplitude*(Math.sin(driftTime*rate+phase)-Math.sin(phase));
   const dz=amplitude*.44*(Math.sin(driftTime*rate*.63+phase*.8)-Math.sin(phase*.8));
   centers[i].set(bank[0]+dx,bank[1],bank[2]+dz);
  });
  const stamp=Math.floor(elapsed);
  if(stamp!==this.motionStamp){this.motionStamp=stamp;r.domElement.dataset.cloudMotion='slow-drift';r.domElement.dataset.cloudDrift=JSON.stringify(centers.slice(0,3).map(v=>[+v.x.toFixed(3),+v.y.toFixed(3),+v.z.toFixed(3)]));}

  if(this.width!==this.size.x||this.height!==this.size.y){this.width=this.size.x;this.height=this.size.y;this.sceneTarget.setSize(this.width,this.height);this.fogTarget.setSize(Math.max(1,Math.ceil(this.width*this.cloudResolution)),Math.max(1,Math.ceil(this.height*this.cloudResolution)));}
  r.setRenderTarget(this.sceneTarget);r.render(scene,camera);
  const u=this.volume.uniforms;u.inverseProjection.value.copy(camera.projectionMatrixInverse);u.cameraWorld.value.copy(camera.matrixWorld);u.cameraPositionWorld.value.copy(camera.position);u.time.value=driftTime;
  this.quad.material=this.volume;r.setRenderTarget(this.fogTarget);r.render(this.screen,this.camera);
  this.composite.uniforms.fogTexel.value.set(1/this.fogTarget.width,1/this.fogTarget.height);this.composite.uniforms.clipPlanes.value.set(camera.near,camera.far);
  this.quad.material=this.composite;r.setRenderTarget(null);r.render(this.screen,this.camera);
 }
}
