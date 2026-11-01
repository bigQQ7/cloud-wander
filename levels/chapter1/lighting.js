import * as THREE from 'three';

// One sun direction shared by the directional light, the sky dome and the volumetric clouds.
// Lower, warm afternoon sun (about 30° above the horizon) for long soft light across the meadow.
export const sunDirection=new THREE.Vector3(-.66,.56,-.71).normalize();
export const sunColor=new THREE.Color('#fff0d5');
// Warm haze that the horizon, distant clouds and far islands fade into.
export const hazeColor=new THREE.Color('#c8dfef');

// Shared, linear-radiance skylight for every standard/physical material.
export function addSkyLighting(scene,renderer){
 const w=256,h=128,pixels=new Float32Array(w*h*4);
 const zenith=new THREE.Color(.48,.69,1.02),horizon=new THREE.Color(.86,.93,1.02),ground=new THREE.Color(.46,.50,.51),c=new THREE.Color();
 for(let y=0;y<h;y++){
  const elevation=-Math.cos(Math.PI*(y+.5)/h);
  c.copy(horizon).lerp(elevation>=0?zenith:ground,Math.pow(Math.abs(elevation),.55));
  for(let x=0;x<w;x++){const i=(y*w+x)*4;pixels[i]=c.r;pixels[i+1]=c.g;pixels[i+2]=c.b;pixels[i+3]=1;}
 }
 const texture=new THREE.DataTexture(pixels,w,h,THREE.RGBAFormat,THREE.FloatType);texture.mapping=THREE.EquirectangularReflectionMapping;texture.needsUpdate=true;
 const pmrem=new THREE.PMREMGenerator(renderer),target=pmrem.fromEquirectangular(texture);scene.environment=target.texture;scene.environmentIntensity=.45;texture.dispose();pmrem.dispose();
 // Sky from above, sunlit cloud sea bouncing warm light from below.
 scene.add(new THREE.HemisphereLight('#c5dcff','#bcc5ba',.36));
 return target;
}

// Golden-hour sky dome: deep blue zenith, warm hazy horizon, soft sun disk and glow.
export function createSkyDome(){
 return new THREE.Mesh(new THREE.SphereGeometry(640,48,32),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,toneMapped:false,
  uniforms:{sunDir:{value:sunDirection},sunTint:{value:sunColor},haze:{value:hazeColor}},
  vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform vec3 sunDir;uniform vec3 sunTint;uniform vec3 haze;varying vec3 direction;
  void main(){
   vec3 d=normalize(direction);float h=d.y;
   // ACES tone mapping washes out pale colours, so the sky stays strongly saturated
   // and only a narrow band near the horizon turns warm and hazy.
   vec3 zenith=vec3(.065,.24,.57),mid=vec3(.21,.47,.77);
   vec3 col=mix(mid,zenith,pow(clamp(h,0.,1.),.6));
   col=mix(col,haze*.92,exp(-max(h,0.)*5.5));
   if(h<0.)col=mix(haze*.92,vec3(.34,.49,.66),clamp(-h*2.2,0.,1.));
   float s=max(dot(d,sunDir),0.);
   // Wide warm glow, tighter halo, then the disk itself.
   col+=sunTint*pow(s,8.)*.14;
   col+=sunTint*pow(s,90.)*.42;
   col+=mix(sunTint,vec3(1.),.35)*smoothstep(.9994,.99975,s)*2.4;
   gl_FragColor=vec4(col,1.);
  }`}));
}
