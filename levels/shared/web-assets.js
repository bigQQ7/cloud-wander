import {detailTextures} from './texture-details.js?v=3';
import {MeshoptDecoder} from '../../ui/vendor/meshopt_decoder.mjs';

// Keep model/animation URLs stable between releases; only change the version with the assets.
export function configureGLTFLoader(loader){
 loader.setMeshoptDecoder(MeshoptDecoder);
 const load=loader.loadAsync.bind(loader);
 loader.loadAsync=async function(url,onProgress){
  const resource=new URL(url,document.baseURI);resource.searchParams.set('v','web-assets-3');
  if(!('DecompressionStream' in globalThis))return load(resource.href,onProgress);
  const compressed=new URL(resource);compressed.pathname+='.gz';
  let response;
  for(let attempt=0;attempt<2;attempt++){
   try{response=await fetch(compressed);if(response.ok)break;if(response.status===404)return load(resource.href,onProgress);throw new Error('模型下载失败：'+response.status);}
   catch(error){if(attempt)throw error;}
  }
  const bytes=new Uint8Array(await response.arrayBuffer());
  // Some hosts already decompress gzip responses. Avoid decoding such responses twice.
  const buffer=bytes[0]===31&&bytes[1]===139
   ?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
   :bytes.buffer;
  const gltf=await loader.parseAsync(buffer,new URL('.',resource).href);
  for(const texture of await gltf.parser.getDependencies('texture')){
   const file=detailTextures[texture.name];
   if(file)texture.userData.cloudDetail=new URL('./web-textures/'+file,import.meta.url).href;
  }
  return gltf;
 };
 return loader;
}

const detailQueue=[],queued=new WeakSet();let activeDetails=0,lastDetailCheck=0;
function pumpDetails(){
 while(activeDetails<2&&detailQueue.length){
  const texture=detailQueue.shift();activeDetails++;
  const image=new Image();image.decoding='async';image.src=texture.userData.cloudDetail;
  image.decode().then(()=>{texture.image=image;texture.needsUpdate=true;texture.userData.cloudDetailLoaded=true;})
   .catch(()=>{texture.userData.cloudDetailRetry=(texture.userData.cloudDetailRetry||0)+1;queued.delete(texture);})
   .finally(()=>{activeDetails--;pumpDetails();});
 }
}
// Geometry, collision, and interactions are ready before play. Detail maps follow the camera.
export function updateAssetDetails(scene,camera){
 const now=performance.now();if(now-lastDetailCheck<1000||document.querySelector('.cloud-loading'))return;lastDetailCheck=now;
 const candidates=new Map();
 scene.traverse(object=>{
  if(!object.isMesh)return;for(let parent=object;parent;parent=parent.parent)if(!parent.visible)return;
  const matrix=object.matrixWorld.elements,distance=Math.hypot(matrix[12]-camera.position.x,matrix[13]-camera.position.y,matrix[14]-camera.position.z);
  if(distance>32)return;
  for(const material of Array.isArray(object.material)?object.material:[object.material])for(const texture of Object.values(material)){
   if(!texture?.isTexture||!texture.userData.cloudDetail||texture.userData.cloudDetailLoaded||queued.has(texture)||(texture.userData.cloudDetailRetry||0)>1)continue;
   candidates.set(texture,Math.min(candidates.get(texture)??Infinity,distance));
  }
 });
 for(const [texture] of [...candidates].sort((a,b)=>a[1]-b[1])){queued.add(texture);detailQueue.push(texture);}
 pumpDetails();
}
