import * as THREE from 'three';
const placements=[[-44,1.1,-13,.72],[-28,1.1,-13,.62],[-18,5.1,19,.60],[-5,5.1,24,.67],[24,3.1,8,1.5]];
function geometry(buffer){
 const view=new DataView(buffer),nv=view.getInt32(0,true),nt=view.getInt32(4,true),g=new THREE.BufferGeometry();
 if(buffer.byteLength!==8+nv*40+nt*12)throw new Error('树木数据不完整');
 const data=new THREE.InterleavedBuffer(new Float32Array(buffer,8,nv*10),10);
 g.setAttribute('position',new THREE.InterleavedBufferAttribute(data,3,0));g.setAttribute('normal',new THREE.InterleavedBufferAttribute(data,3,3));g.setAttribute('uv',new THREE.InterleavedBufferAttribute(data,2,6));g.setAttribute('leafWind',new THREE.InterleavedBufferAttribute(data,2,8));
 g.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer,8+nv*40,nt*3),1));g.computeBoundingSphere();return g;
}
export async function createTrees(scene,renderer){
 const loader=new THREE.TextureLoader(),base='./assets/tree/',time={value:0};
 const [atlas,barkMap,barkNormal]=await Promise.all(['LeafAtlas.png','BarkColor.png','BarkNormal.png'].map(f=>loader.loadAsync(base+f)));
 for(const t of [atlas,barkMap])t.colorSpace=THREE.SRGBColorSpace;
 for(const t of [atlas,barkMap,barkNormal]){t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;}
 const bark=new THREE.MeshStandardMaterial({map:barkMap,normalMap:barkNormal,normalScale:new THREE.Vector2(.6,.6),roughness:.88});
 const leaf=new THREE.MeshStandardMaterial({map:atlas,side:THREE.DoubleSide,roughness:.78,metalness:0,emissive:'#ffffff',emissiveMap:atlas,emissiveIntensity:.045});
 const wind=s=>{
  s.uniforms.treeTime=time;
  s.vertexShader='attribute vec2 leafWind;uniform float treeTime;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   float phase=leafWind.y*6.2831853;
   float gust=sin(treeTime*1.05+phase+modelMatrix[3].x*.24+modelMatrix[3].z*.31)*.7+sin(treeTime*1.8165+phase*2.1)*.3;
   transformed.x+=gust*leafWind.x*leafWind.x*.028;
   transformed.z+=cos(treeTime*.8715+phase)*leafWind.x*leafWind.x*.0126;
  `);
 };
 leaf.onBeforeCompile=wind;leaf.customProgramCacheKey=()=> 'individual-leaf-wind';
 const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});depth.onBeforeCompile=wind;depth.customProgramCacheKey=()=> 'leaf-depth-wind';
 const meshes=await Promise.all([0,1,2].map(async level=>{
  return Promise.all(['Bark','Leaves'].map(async part=>{const r=await fetch(base+part+'_LOD'+level+'.bytes');if(!r.ok)throw new Error('树木加载失败');return geometry(await r.arrayBuffer());}));
 }));
 const trees=[];
 placements.forEach(([x,y,z,scale],i)=>{
  const lod=new THREE.LOD();lod.name=i===4?'回声树屋 • 独立叶片大树':`独立叶片树 • ${i+1}`;lod.position.set(x,y,z);lod.scale.setScalar(scale);lod.rotation.y=THREE.MathUtils.degToRad(i*53);
  for(let level=0;level<3;level++){
   const group=new THREE.Group(),trunk=new THREE.Mesh(meshes[level][0],bark),crown=new THREE.Mesh(meshes[level][1],leaf);
   trunk.castShadow=true;trunk.receiveShadow=true;crown.castShadow=level<2;crown.receiveShadow=true;crown.customDepthMaterial=depth;group.add(trunk,crown);
   lod.addLevel(group,[0,28*scale,65*scale][level],.12);
  }
  scene.add(lod);trees.push(lod);
 });
 return{objects:trees,count:trees.length,update(seconds){time.value=seconds;}};
}
