import * as THREE from 'three';

// Orthographic PCSS: the penumbra grows with blocker/receiver separation.
// Keep the sampling pattern fixed in light space, so standing still is stable.
// The same function shades the hero, architecture, terrain and vegetation.
const settings={width:170,height:160,near:5,far:250,angularRadius:.025};
export function penumbraRadius(distance){return Math.max(0,distance)*settings.angularRadius;}
export function configureSunShadows(sun,renderer,coarse=false){
 const size=Math.min(coarse?2048:4096,renderer.capabilities.maxTextureSize);
 sun.shadow.mapSize.set(size,size);
 Object.assign(sun.shadow.camera,{left:-settings.width/2,right:settings.width/2,top:settings.height/2,bottom:-settings.height/2,near:settings.near,far:settings.far});
 sun.shadow.camera.updateProjectionMatrix();
 // Bias is in normalized depth. The old .0004 displaced contact by ~10 cm.
 sun.shadow.bias=-.000025;
 sun.shadow.normalBias=.012;
 const chunk=THREE.ShaderChunk.shadowmap_pars_fragment;
 if(!chunk.includes('cloudContactShadow')){
  const depthRange=settings.far-settings.near;
  const samples=Array.from({length:16},(_,i)=>{
   const radius=Math.sqrt((i+.5)/16),angle=i*2.399963229728653;
   return `vec2(${(Math.cos(angle)*radius).toFixed(7)},${(Math.sin(angle)*radius).toFixed(7)})`;
  });
  const code=`
  float cloudContactShadow(sampler2D map, vec2 mapSize, vec3 coord) {
   vec2 texel=1.0/mapSize;
   vec2 disk[16];
   ${samples.map((s,i)=>`disk[${i}]=${s};`).join('\n')}
   // Receiver-plane correction prevents large PCSS taps shadowing the same
   // sloped surface. Bound grazing-angle derivatives for narrow grass blades.
   vec3 dx=dFdx(coord),dy=dFdy(coord);
   float determinant=dx.x*dy.y-dx.y*dy.x;
   vec2 slope=vec2(0.0);
   if(abs(determinant)>1e-10) slope=clamp(vec2(dy.y*dx.z-dx.y*dy.z,dx.x*dy.z-dy.x*dx.z)/determinant,vec2(-2.0),vec2(2.0));
   float blockerSum=0.0,blockers=0.0;
   vec2 search=max(texel*2.0,vec2(.32)/vec2(${settings.width.toFixed(1)},${settings.height.toFixed(1)}));
   for(int i=0;i<8;i++) {
    vec2 offset=disk[i*2]*search;
    float depth=unpackRGBAToDepth(texture2D(map,coord.xy+offset));
    float receiver=coord.z+dot(slope,offset);
    if(depth<receiver-.00002){blockerSum+=depth-dot(slope,offset);blockers+=1.0;}
   }
   float separation=blockers>0.0?max(0.0,coord.z-blockerSum/blockers)*${depthRange.toFixed(1)}:0.0;
   vec2 radius=max(texel*.65,vec2(min(separation*.025,.65))/vec2(${settings.width.toFixed(1)},${settings.height.toFixed(1)}));
   float visibility=0.0;
   for(int i=0;i<16;i++){
    vec2 offset=disk[i]*radius;
    visibility+=texture2DCompare(map,coord.xy+offset,coord.z+dot(slope,offset));
   }
   return visibility/16.0;
  }
  `;
  const marker='\tfloat getShadow( sampler2D shadowMap';
  if(!chunk.includes(marker))throw new Error('Unsupported Three.js shadow shader');
  THREE.ShaderChunk.shadowmap_pars_fragment=chunk.replace(marker,code+marker).replace('if ( frustumTest ) {','if ( frustumTest ) {\n return mix(1.0,cloudContactShadow(shadowMap,shadowMapSize,shadowCoord.xyz),shadowIntensity);');
 }
 renderer.domElement.dataset.shadows='contact-hardening';
 renderer.domElement.dataset.shadowResolution=String(size);
}
