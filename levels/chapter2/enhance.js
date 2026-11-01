export function enhance({T,scene,world,renderer,camera,controls,put,mesh,mat,ivory,gold,blue,assets,generatedChecks}){
 const animated=[];
 // Selectively lift purple cliff texels into pale lilac while keeping green foliage intact.
 for(const id of [1,2,3]){assets.get(id).traverse(o=>{if(!o.isMesh)return;const m=o.material;m.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 float violetMask=smoothstep(0.05,0.25,diffuseColor.b-diffuseColor.g)*smoothstep(-0.02,0.12,diffuseColor.r-diffuseColor.g);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.78,.73,.9)*(0.75+0.25*diffuseColor.b),violetMask*.85);`);};m.needsUpdate=true;});}
 // A graded sky and soft alpha cloud layers, rather than low-poly solid spheres.
 const sky=document.createElement('canvas');sky.width=32;sky.height=512;const sc=sky.getContext('2d'),gr=sc.createLinearGradient(0,0,0,512);gr.addColorStop(0,'#b7b3ec');gr.addColorStop(.5,'#f2d5ea');gr.addColorStop(1,'#ffe8d8');sc.fillStyle=gr;sc.fillRect(0,0,32,512);const st=new T.CanvasTexture(sky);st.colorSpace=T.SRGBColorSpace;scene.background=st;scene.fog=new T.Fog('#f1dbe9',55,165);
 const env=document.createElement('canvas');env.width=512;env.height=256;const ec=env.getContext('2d'),eg=ec.createLinearGradient(0,0,0,256);eg.addColorStop(0,'#f8f4eb');eg.addColorStop(.4,'#e3eafa');eg.addColorStop(.6,'#b0b8ce');eg.addColorStop(1,'#cad4e3');ec.fillStyle=eg;ec.fillRect(0,0,512,256);const et=new T.CanvasTexture(env);et.mapping=T.EquirectangularReflectionMapping;et.colorSpace=T.SRGBColorSpace;const pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromEquirectangular(et).texture;scene.environmentIntensity=.7;et.dispose();pmrem.dispose();

 const c=document.createElement('canvas');c.width=c.height=256;const cx=c.getContext('2d');for(const [x,y,r] of [[70,140,65],[115,105,69],[166,135,62],[125,155,77]]){const g=cx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.7,'rgba(255,255,255,.9)');g.addColorStop(1,'rgba(255,255,255,0)');cx.fillStyle=g;cx.fillRect(0,0,256,256);}const tex=new T.CanvasTexture(c);let seed=77;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 // Backdrop now comes from atmosphere.js (pink meadow shore, sky clouds).
 // Replace temporary assembled walls with the supplied Tripo panel.
 put(42,-23.1,2.02,-16.25,4.8,Math.PI/2);put(42,-26.1,2.02,-13.65,4.8,0);
 // Entry and exit contact lamps.
 for(const x of [-2.9,2.9]){put(33,x,.03,7.1,.8);put(33,x,4.03,-20.8,.7);}
 // Supplied chandelier is the suspended square platform; hammer is actually the lever.
 // Their broad planar top sits at ~0.09 source height; chains rise from that slab.
 
 // Place the existing tile slightly over the platform top, avoiding chain anchors.
 
 // Rune glyphs are textures on all faces of the cube, not another heavy mesh.
 const rune=document.createElement('canvas');rune.width=rune.height=256;const rc=rune.getContext('2d');rc.fillStyle='#0877cd';rc.fillRect(0,0,256,256);rc.strokeStyle='#8ef9ff';rc.lineWidth=8;rc.strokeRect(15,15,226,226);rc.strokeRect(30,30,196,196);rc.beginPath();rc.moveTo(128,52);rc.lineTo(190,96);rc.lineTo(174,173);rc.lineTo(128,204);rc.lineTo(82,173);rc.lineTo(66,96);rc.closePath();rc.stroke();rc.beginPath();rc.moveTo(128,61);rc.lineTo(128,195);rc.moveTo(70,99);rc.lineTo(128,133);rc.lineTo(186,99);rc.moveTo(85,167);rc.lineTo(128,141);rc.lineTo(171,167);rc.stroke();const rt=new T.CanvasTexture(rune);rt.colorSpace=T.SRGBColorSpace;world.traverse(o=>{if(o.isMesh&&o.geometry.type==='BoxGeometry'&&o.position.x===19.5&&o.position.y===6.55)o.material=new T.MeshStandardMaterial({map:rt,emissive:'#2cbcff',emissiveMap:rt,emissiveIntensity:.6,roughness:.3});});
 // Continuous animated caustics: no cracks between individual slide assets.
 const time={value:0};const water=new T.ShaderMaterial({side:T.DoubleSide,uniforms:{time},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float time;varying vec2 vUv;void main(){vec2 p=vec2(vUv.x*10.,vUv.y*5.-time*.8);float a=sin(p.x+sin(p.y*1.4)*1.5),b=sin(p.y+sin(p.x*1.3));float w=pow(1.-abs(a*b),16.);float edge=pow(abs(vUv.x-.5)*2.,12.);vec3 color=mix(vec3(.035,.46,.85),vec3(.35,.88,1.),.5+.25*sin(p.y));color=mix(color,vec3(.87,.99,1.),clamp(w*.9+edge*.7,0.,1.));gl_FragColor=vec4(color,1.);}`});world.traverse(o=>{if(o.isMesh&&o.material.isMeshBasicMaterial&&o.material.color?.getHexString()==='31c8ff')o.material=water;});
 // Reusable contact-shadow cards improve grounding without re-rendering every flower into a shadow map.
 const sh=document.createElement('canvas');sh.width=sh.height=64;const sx=sh.getContext('2d'),sg=sx.createRadialGradient(32,32,1,32,32,31);sg.addColorStop(0,'#34234d75');sg.addColorStop(1,'#34234d00');sx.fillStyle=sg;sx.fillRect(0,0,64,64);const sm=new T.MeshBasicMaterial({map:new T.CanvasTexture(sh),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});for(const [x,y,z,r]of [[5,.025,-1,2],[2,.025,-6,2.5],[-5,.025,3,2.3],[-22,2.025,-11,2.5],[0,4.025,-23,3]]){const o=mesh(new T.PlaneGeometry(r*2,r*2),sm,x,y,z);o.rotation.x=-Math.PI/2;}
 const status=document.createElement('span');status.id='geometry-check';status.hidden=true;status.textContent=JSON.stringify(generatedChecks);document.body.append(status);
 return {update(t){time.value=t;}};
}
