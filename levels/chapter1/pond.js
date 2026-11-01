import * as THREE from 'three';
import {sunDirection,hazeColor} from './lighting.js?v=mvp3';
import {obstacles} from './physics.js?v=walk1';
export function createPond(scene,options={}){
 const object=new THREE.Group();object.name='镜湖水池';object.userData.groundAnchor='shoreline';object.position.set(options.x??-1,options.y??5.23,options.z??13);
 const radius=options.radius??2.7,segments=80,positions=[0,0,0],uv=[.5,.5],indices=[];
 const shoreline=a=>radius*(1+.11*Math.sin(3*a+.4)+.055*Math.sin(7*a));
 for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,r=shoreline(a);positions.push(Math.cos(a)*r,0,Math.sin(a)*r);uv.push(.5+Math.cos(a)*.5,.5+Math.sin(a)*.5);if(i<segments)indices.push(0,i+2,i+1);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const uniforms={time:{value:0},sun:{value:sunDirection},haze:{value:hazeColor}};
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms,
 vertexShader:`varying vec2 tex;varying vec3 world;void main(){tex=uv;world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,
 fragmentShader:`uniform float time;uniform vec3 sun;uniform vec3 haze;varying vec2 tex;varying vec3 world;
 float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}float fbm(vec2 p){float v=0.,a=.57;for(int i=0;i<3;i++){v+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.13+13.7;a*=.5;}return v;}float cells(vec2 p){vec2 g=floor(p),f=fract(p);float first=9.,second=9.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));vec2 d=o+vec2(hash(g+o),hash(g+o+17.))-f;float v=length(d);if(v<first){second=first;first=v;}else second=min(second,v);}return second-first;}
 float wave(vec2 p){return fbm(p*2.+vec2(time*.22,time*.085))*.6+fbm(p*3.1+vec2(-time*.14,time*.19))*.4;}
 void main(){float r=length(tex-.5)*2.;vec2 p=world.xz;float h=wave(p);vec2 slope=vec2(wave(p+vec2(.025,0.))-h,wave(p+vec2(0.,.025))-h)/.025;
 vec3 n=normalize(vec3(-slope.x*.045,1.,-slope.y*.045));vec3 viewDir=normalize(cameraPosition-world);float nv=max(dot(n,viewDir),.001);float fresnel=.02+.98*pow(1.-nv,5.);
 float depth=max(0.,1.2*(1.-pow(r*.88,2.))-.25);vec2 refracted=p+n.xz*depth*.7;
 float sand=fbm(refracted*8.);
 float caustic=(1.-smoothstep(.025,.14,min(cells(refracted*3.+vec2(time*.14,time*.055)),cells(refracted*3.7+vec2(2.,-time*.12)))))*.3*(1.-smoothstep(.15,.85,depth));
 vec3 bottomColor=mix(vec3(.12,.16,.12),vec3(.26,.29,.20),sand)+vec3(.24,.42,.39)*caustic;
 vec3 transmission=exp(-vec3(2.8,.85,.48)*depth*2.);vec3 color=bottomColor*transmission+vec3(.018,.18,.23)*(1.-transmission);
 vec3 reflected=reflect(-viewDir,n);vec3 sky=mix(haze,vec3(.22,.46,.72),smoothstep(0.,.85,reflected.y));color=mix(color,sky,fresnel);
 vec3 halfDir=normalize(sun+viewDir);float nh=max(dot(n,halfDir),0.);vec3 dx=dFdx(n),dy=dFdy(n);float alpha2=.0025+min(.25*(dot(dx,dx)+dot(dy,dy)),.18);float d=nh*nh*(alpha2-1.)+1.;float spec=alpha2/(3.141593*d*d);color+=vec3(1.,.94,.80)*min(spec*.012,1.8)*max(dot(n,sun),0.);
 float foam=smoothstep(.965,.985,r)*(1.-smoothstep(.985,1.,r));color=mix(color,vec3(.65,.81,.79),foam*.4);
 gl_FragColor=vec4(color,mix(.97,.12,smoothstep(.85,1.,r)));
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 const water=new THREE.Mesh(geometry,material);water.name='镜湖水面';water.position.y=-.30;water.scale.set(.88,1,.88);water.castShadow=false;water.renderOrder=2;object.add(water);
 const maskMaterial=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,depthTest:false,side:THREE.DoubleSide,stencilWrite:true,stencilRef:1,stencilFunc:THREE.AlwaysStencilFunc,stencilZPass:THREE.ReplaceStencilOp});
 const mask=new THREE.Mesh(geometry,maskMaterial);mask.renderOrder=-10000;mask.castShadow=false;object.add(mask);
 for(const ground of (options.groundMeshes||[]).filter(Boolean)){for(const mat of Array.isArray(ground.material)?ground.material:[ground.material]){mat.stencilWrite=true;mat.stencilRef=1;mat.stencilFunc=THREE.NotEqualStencilFunc;mat.stencilFail=THREE.KeepStencilOp;mat.stencilZFail=THREE.KeepStencilOp;mat.stencilZPass=THREE.KeepStencilOp;}}
 const bowlPositions=[],bowlUV=[],bowlIndices=[];
 for(let j=0;j<=16;j++){const t=j/16;for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,r=shoreline(a)*t;bowlPositions.push(Math.cos(a)*r,-.05-1.2*(1-t*t),Math.sin(a)*r);bowlUV.push(.5+Math.cos(a)*t*.5,.5+Math.sin(a)*t*.5);if(j<16&&i<segments){const k=j*(segments+1)+i;bowlIndices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}}}
 const bowlGeometry=new THREE.BufferGeometry();bowlGeometry.setAttribute('position',new THREE.Float32BufferAttribute(bowlPositions,3));bowlGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(bowlUV,2));bowlGeometry.setIndex(bowlIndices);bowlGeometry.computeVertexNormals();
 const bedMaterial=new THREE.ShaderMaterial({side:THREE.DoubleSide,vertexShader:material.vertexShader,fragmentShader:`varying vec2 tex;varying vec3 world;float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}float fbm(vec2 p){float v=0.,a=.57;for(int i=0;i<3;i++){v+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.13+13.7;a*=.5;}return v;}float cells(vec2 p){vec2 g=floor(p),f=fract(p);float first=9.,second=9.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));vec2 d=o+vec2(hash(g+o),hash(g+o+17.))-f;float v=length(d);if(v<first){second=first;first=v;}else second=min(second,v);}return second-first;}void main(){float r=length(tex-.5)*2.;float grain=fbm(world.xz*9.);vec3 color=mix(vec3(.055,.045,.027),vec3(.15,.17,.075),r)*(.65+grain*.55);gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 const bowl=new THREE.Mesh(bowlGeometry,bedMaterial);bowl.name='镜湖池壁与池底';object.add(bowl);
 let seed=541;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const rockShapes=Array.from({length:6},(_,seed)=>{const g=new THREE.IcosahedronGeometry(1,4),p=g.attributes.position;for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i),n=v.clone().normalize();let f=0;for(let k=1;k<=3;k++){const q=v.clone().multiplyScalar(k*1.7).addScalar(seed*7.3);const hash=(x,y,z)=>{const t=Math.abs(x*127.1+y*311.7+z*74.7);return (t*t*.1031)%1;};const x=Math.floor(q.x),y=Math.floor(q.y),z=Math.floor(q.z),u=q.x-x,w=q.y-y,t=q.z-z;const smooth=a=>a*a*(3-2*a);let value=0;for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let c=0;c<2;c++)value+=hash(x+a,y+b,z+c)*(a?smooth(u):1-smooth(u))*(b?smooth(w):1-smooth(w))*(c?smooth(t):1-smooth(t));f+=(value-.5)*.24/k;}v.addScaledVector(n,f);v.y=Math.max(-.55,v.y*.75);p.setXYZ(i,v.x,v.y,v.z);}g.computeVertexNormals();return g;});
 const rockMaterials=Array.from({length:4},(_,i)=>new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(.20+i*.015,.08+i*.025,.30+i*.06),roughness:1,flatShading:false}));
 for(let i=0;i<22;i++){const cluster=i%7,a=cluster*.86+(random()-.5)*.35,r=shoreline(a)+(random()-.5)*.35,rock=new THREE.Mesh(rockShapes[i%6],rockMaterials[i%4]);const size=.15+random()*.45;rock.position.set(Math.cos(a)*r,-.08,Math.sin(a)*r);rock.scale.set(size*(1+random()*.6),size*(.5+random()*.5),size);rock.rotation.set(random(),random()*6.28,random()*.4);rock.castShadow=true;rock.receiveShadow=true;object.add(rock);}
 const leafMaterial=new THREE.MeshStandardMaterial({color:'#53764c',roughness:.7,side:THREE.DoubleSide});
 const reeds=new THREE.InstancedMesh(new THREE.ConeGeometry(.035,.9,3),leafMaterial,28),dummy=new THREE.Object3D();
 for(let i=0;i<28;i++){const a=(i%4)*1.65+.2+(random()-.5)*.2,r=shoreline(a)+.24;dummy.position.set(Math.cos(a)*r,.3,Math.sin(a)*r);dummy.scale.set(1,.65+random()*.7,1);dummy.rotation.set(random()*.2,random()*6,random()*.25);dummy.updateMatrix();reeds.setMatrixAt(i,dummy.matrix);}object.add(reeds);
 const lilyGeo=new THREE.CircleGeometry(.23,18,.12,Math.PI*2-.3);lilyGeo.rotateX(-Math.PI/2);
 for(let i=0;i<5;i++){const a=i*2.4,r=.7+random();const lily=new THREE.Mesh(lilyGeo,leafMaterial);lily.position.set(Math.cos(a)*r,-.275,Math.sin(a)*r);lily.rotation.y=a;object.add(lily);if(i<2){const flower=new THREE.Group();for(let j=0;j<6;j++){const petal=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshStandardMaterial({color:'#f1eadb'}));const a=j*Math.PI/3;petal.scale.set(.045,.018,.10);petal.position.set(Math.sin(a)*.065,.025,Math.cos(a)*.065);petal.rotation.y=a;flower.add(petal);}flower.position.copy(lily.position);object.add(flower);}}
 scene.add(object);const obstacle={x:0,z:0,h:0,rx:radius,rz:radius};obstacles.push(obstacle);
 const inverse=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion();
 function sync(){object.updateWorldMatrix(true,false);object.matrixWorld.decompose(position,rotation,scale);inverse.copy(object.matrixWorld).invert();let visible=true;for(let p=object;p;p=p.parent)if(!p.visible)visible=false;const e=object.matrixWorld.elements;Object.assign(obstacle,{x:position.x,z:position.z,h:visible?position.y+4*Math.abs(scale.y):-10000,rx:radius*1.1*Math.abs(scale.x),rz:radius*1.1*Math.abs(scale.z),yaw:Math.atan2(-e[2],e[0])});return visible;}
 sync();return{object,radius,inverse,sync,update(seconds){uniforms.time.value=seconds;object.traverse(o=>{if(o.material?.uniforms?.time)o.material.uniforms.time.value=seconds;});sync();}};
}
