// 镜湖水面：倒影 + 波纹扭曲 + 菲涅尔 + 阳光闪点 + 物体接水处的涟漪泡沫 + 角色走过的水纹 + 远处融进雾里。
const MAX_RINGS=72;
export function createLake({T,scene,Reflector,y=-.35}){
  const shader={
    name:'MirrorLakeShader',
    uniforms:{
      color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null},
      time:{value:0},
      deepColor:{value:new T.Color('#b06aa6')},shallowColor:{value:new T.Color('#e8b3d6')},
      fogColor:{value:new T.Color('#f5d3e6')},fogNear:{value:45},fogFar:{value:170},
      sunDir:{value:new T.Vector3(-.45,.62,.64).normalize()},
      rings:{value:Array.from({length:MAX_RINGS},()=>new T.Vector3(0,0,-1))},ringCount:{value:0},
      player:{value:new T.Vector3(0,10,0)},playerMove:{value:0},
    },
    vertexShader:/* glsl */`
      uniform mat4 textureMatrix;varying vec4 vUv;varying vec3 vWorld;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){vUv=textureMatrix*vec4(position,1.);vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader:/* glsl */`
      uniform vec3 color;uniform sampler2D tDiffuse;uniform float time;uniform vec3 deepColor,shallowColor,fogColor,sunDir;uniform float fogNear,fogFar;
      uniform vec3 rings[${MAX_RINGS}];uniform int ringCount;uniform vec3 player;uniform float playerMove;
      varying vec4 vUv;varying vec3 vWorld;
      #include <logdepthbuf_pars_fragment>
      float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      const vec2 W=vec2(.94,.34);const vec2 W2=vec2(.72,-.69);
      float gust(vec2 p){return smoothstep(.42,.82,vnoise(p*.055-W*time*.42)*.7+vnoise(p*.17-W*time*.9)*.3);}
      float waves(vec2 p){
        float gm=gust(p);
        float swell=sin(dot(p,W)*1.15-time*1.9)*.22+sin(dot(p,W2)*1.9-time*2.6)*.1;
        float chop=vnoise(p*.9-W*time*1.35)*.35+vnoise(p*2.4-W*time*2.3)*.18+vnoise(p*5.2-W2*time*3.2)*.08;
        return swell*(.6+.8*gm)+chop*(.55+1.3*gm)+vnoise(p*.3+vec2(time*.05,time*.03))*.3;
      }
      void main(){
        #include <logdepthbuf_fragment>
        vec2 p=vWorld.xz;float dist=length(cameraPosition-vWorld);
        float e=.12,h0=waves(p);vec2 g=vec2(waves(p+vec2(e,0.))-h0,waves(p+vec2(0.,e))-h0)/e;
        g*=mix(1.,.35,clamp(dist/120.,0.,1.));
        float foam=0.,shade=0.;
        for(int i=0;i<${MAX_RINGS};i++){
          if(i>=ringCount)break;vec3 c=rings[i];vec2 dv=p-c.xy;float dd=length(dv);float d=dd-c.z;
          if(d<-.05){foam=max(foam,.15);continue;}
          float fall=exp(-d*1.25);float ph=sin(d*7.5-time*2.4);
          g+=dv/max(dd,.001)*ph*.16*fall;
          foam=max(foam,smoothstep(.3,0.,d)*.85+fall*.32*smoothstep(.55,1.,ph));
          shade=max(shade,smoothstep(1.2,0.,d)*.18);
        }
        float pd=length(p-player.xz);float near=step(player.y,.9)*playerMove;
        float pr=sin(pd*9.-time*6.)*exp(-pd*1.1)*near;g+=(p-player.xz)/max(pd,.001)*pr*.2;foam=max(foam,smoothstep(.45,0.,abs(pd-.55))*.6*near);
        vec3 N=normalize(vec3(-g.x*.9,1.,-g.y*.9));
        vec4 uv=vUv;uv.xy+=g*.06*uv.w;
        vec3 refl=texture2DProj(tDiffuse,uv).rgb*color;
        vec3 V=normalize(cameraPosition-vWorld);
        float fres=.3+.7*pow(1.-max(dot(V,N),0.),4.);
        vec3 body=mix(shallowColor,deepColor,clamp(.25+dist/140.,0.,1.));
        vec3 col=mix(body,refl,fres);float gm=gust(p);col=mix(col,col*vec3(.9,.86,.93),gm*.35*(1.-smoothstep(60.,140.,dist)));
        col*=1.-shade;
        vec3 H=normalize(sunDir+V);float spec=pow(max(dot(N,H),0.),260.)*2.2+pow(max(dot(N,H),0.),40.)*.08;
        col+=vec3(1.,.96,.93)*spec;
        col=mix(col,vec3(1.,.97,.99),clamp(foam,0.,1.)*.7);
        col=mix(col,fogColor,smoothstep(fogNear,fogFar,dist));
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
  const lake=new Reflector(new T.CircleGeometry(330,96),{shader,color:'#fff4f9',textureWidth:Math.round(innerWidth*.6),textureHeight:Math.round(innerHeight*.6),multisample:0});
  lake.rotation.x=-Math.PI/2;lake.position.y=y;lake.name='mirror lake';scene.add(lake);
  const U=lake.material.uniforms;
  lake.setRings=list=>{const n=Math.min(MAX_RINGS,list.length);for(let i=0;i<n;i++)U.rings.value[i].set(list[i][0],list[i][1],list[i][2]);U.ringCount.value=n;};
  lake.syncFog=fog=>{U.fogColor.value.copy(fog.color);U.fogNear.value=fog.near;U.fogFar.value=fog.far;};
  return lake;
}
