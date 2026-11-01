import * as THREE from 'three';
// Close the thin turf sheet with a tapered soil/rock body, overlapping the cliff.
const material=new THREE.MeshStandardMaterial({roughness:1,flatShading:true,polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:2});
material.onBeforeCompile=s=>{
 s.vertexShader='attribute float soilDepth;varying float bedDepth;varying vec3 bedPosition;\n'+s.vertexShader;
 s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n bedDepth=soilDepth;bedPosition=position;');
 s.fragmentShader=`varying float bedDepth;varying vec3 bedPosition;
 float bedHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
 float bedNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(bedHash(i),bedHash(i+vec3(1,0,0)),f.x),mix(bedHash(i+vec3(0,1,0)),bedHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(bedHash(i+vec3(0,0,1)),bedHash(i+vec3(1,0,1)),f.x),mix(bedHash(i+vec3(0,1,1)),bedHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 `+s.fragmentShader;
 s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float coarse=bedNoise(bedPosition*.95),fine=bedNoise(bedPosition*7.);
 vec3 rock=mix(vec3(.14,.17,.19),vec3(.26,.29,.28),coarse);
 vec3 soil=mix(vec3(.10,.13,.035),vec3(.16,.13,.065),smoothstep(.06,.34,bedDepth));
 diffuseColor.rgb=mix(soil,rock,smoothstep(.22,.95,bedDepth))*(.83+fine*.22);
 `);
};
material.customProgramCacheKey=()=> 'continuous-turf-foundation';
export function addTerrainFoundation(scene,geometry,matrix,name){
 const a=geometry.getAttribute('position'),ix=geometry.index,points=[],lookup=new Map(),triangles=[],edges=new Map(),v=new THREE.Vector3();
 const vertex=i=>{v.fromBufferAttribute(a,i).applyMatrix4(matrix);const key=[v.x,v.y,v.z].map(n=>n.toFixed(5)).join(',');if(!lookup.has(key)){lookup.set(key,points.length);points.push(v.clone());}return lookup.get(key);};
 for(let i=0;i<ix.count;i+=3){const tri=[vertex(ix.getX(i)),vertex(ix.getX(i+1)),vertex(ix.getX(i+2))];triangles.push(tri);
  for(let j=0;j<3;j++){const x=tri[j],y=tri[(j+1)%3],key=[Math.min(x,y),Math.max(x,y)].join(',');const old=edges.get(key);edges.set(key,old?{...old,count:old.count+1}:{a:x,b:y,count:1});}
 }
 const boundary=[...edges.values()].filter(e=>e.count===1),ids=[...new Set(boundary.flatMap(e=>[e.a,e.b]))];
 if(!ids.length)return null;
 const center=new THREE.Vector3();for(const i of ids)center.add(points[i]);center.divideScalar(ids.length);
 const radius=Math.max(...ids.map(i=>Math.hypot(points[i].x-center.x,points[i].z-center.z))),depth=name.startsWith('01 Awakening meadow')?.08:Math.max(1.1,Math.min(2.0,radius*.14));
 const positions=[],depths=[],index=[];
 for(let layer=0;layer<3;layer++)for(const p of points){const drop=[.035,Math.min(.28,depth*.5),depth][layer],scale=[1,1,.97][layer];positions.push(center.x+(p.x-center.x)*scale,p.y-drop,center.z+(p.z-center.z)*scale);depths.push(drop);}
 const N=points.length;
 for(const t of triangles){index.push(...t);index.push(t[2]+N*2,t[1]+N*2,t[0]+N*2);}
 for(const e of boundary)for(let layer=0;layer<2;layer++){const a=e.a+layer*N,b=e.b+layer*N,c=e.a+(layer+1)*N,d=e.b+(layer+1)*N;index.push(b,a,c,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('soilDepth',new THREE.Float32BufferAttribute(depths,1));g.setIndex(index);g.computeVertexNormals();g.computeBoundingSphere();
 const bed=new THREE.Mesh(g,material);bed.name=name+' • continuous soil and rock foundation';bed.castShadow=true;bed.receiveShadow=true;scene.add(bed);
 return {mesh:bed,topVertices:points,depth,boundaryEdges:boundary.length};
}
