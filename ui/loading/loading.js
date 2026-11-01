/* Cloud Loading — dependency-free Canvas component */
(function(){
const levels={1:{name:'云端初醒',text:'正在加载中很快就好～',color:'#3d9bff',deep:'#146bc8',charm:'charm_lv1.png',bubbles:16},2:{name:'云上花园',text:'云上花园 · 正在加载',color:'#f6afe3',deep:'#9467cb',charm:'charm_lv2.png',bubbles:16},3:{name:'海底',text:'海底 · 正在加载',color:'#ffe9a0',deep:'#d59b43',charm:'charm_lv3.png',bubbles:30}};
const scriptBase = new URL(".", document.currentScript.src);
let active;
const params={glow:1,saturation:1.3,brightness:1.12,halo:1,characterScale:.7,characterY:0,stripeCount:8,stripeSpeed:16,duration:5,textX:-32,textY:-98,numberSize:59,percentSize:40,labelSize:13,textGap:0};
let debugOpen=false,panel,paused=false,editingLevel=1;
function syncColors(){if(!panel)return;const cfg=levels[editingLevel];panel.querySelector('[data-color="color"]').value=cfg.color;panel.querySelector('[data-color="deep"]').value=cfg.deep;panel.querySelectorAll('[data-color]').forEach(input=>panel.querySelector('#cl-color-'+input.dataset.color).value=input.value);panel.querySelector('.cl-level-select').value=editingLevel;panel.querySelector('.cl-label-text').value=cfg.text}

const controls=[['glow','液体发光强度',0,3,.05],['saturation','液体饱和度',0,2.5,.05],['brightness','液体亮度',.4,2,.05],['halo','瓶内光晕强度',0,3,.05],['characterScale','角色大小',.3,1.5,.01],['characterY','角色上下偏移',-50,50,1],['stripeCount','水纹密度',1,16,1],['stripeSpeed','水纹流动速度',0,60,1],['duration','加载总时长（秒）',2,30,.5],['textX','文字整体左右位置',-500,500,1],['textY','文字整体上下位置',-300,300,1],['numberSize','进度数字字号',24,180,1],['percentSize','百分号相对大小（%）',15,100,1],['labelSize','说明文字字号',8,48,1],['textGap','数字与说明间距',0,100,1]];
function toggleDebug(){
 debugOpen=!debugOpen;
 if(!panel){panel=document.createElement('aside');panel.className='cl-debug';panel.setAttribute('aria-label','加载动画调参');
 panel.innerHTML='<header>质感调参 <small>D 开关</small></header>'+controls.map(([k,n,min,max,step])=>`<label>${n}<output id="cl-value-${k}">${params[k]}</output><input aria-label="${n}" data-key="${k}" type="range" min="${min}" max="${max}" step="${step}" value="${params[k]}"></label>`).join('')+'<label>配色关卡<select class="cl-level-select" aria-label="配色关卡"><option value="1">云端初醒</option><option value="2">云上花园</option><option value="3">海底</option></select></label><label>当前关卡说明文字<input class="cl-label-text" type="text" aria-label="当前关卡说明文字" placeholder="输入加载说明"></label><label>液体主色<output id="cl-color-color"></output><input type="color" data-color="color" aria-label="液体主色"></label><label>液体深色<output id="cl-color-deep"></output><input type="color" data-color="deep" aria-label="液体深色"></label><p>打开面板时循环预览；暂停后仍可调参。</p><button class="cl-pause" type="button" aria-pressed="false">暂停</button><button class="cl-copy-params" type="button">复制参数 JSON</button><div class="cl-debug-status" role="status"></div>';document.body.append(panel);
 syncColors();
 panel.querySelector('.cl-level-select').onchange=e=>{editingLevel=Number(e.target.value);syncColors();showLoading(editingLevel)};
 panel.querySelector('.cl-pause').onclick=e=>{paused=!paused;e.target.textContent=paused?'继续':'暂停';e.target.setAttribute('aria-pressed',String(paused))};
 panel.addEventListener('input',e=>{if(e.target.classList.contains('cl-label-text')){levels[editingLevel].text=e.target.value;return}if(e.target.dataset.color){levels[editingLevel][e.target.dataset.color]=e.target.value;syncColors();return}const k=e.target.dataset.key;if(!k)return;params[k]=Number(e.target.value);panel.querySelector('#cl-value-'+k).value=params[k]});
 panel.querySelector('.cl-copy-params').onclick=async()=>{const data=JSON.stringify({...params,levels:Object.fromEntries(Object.entries(levels).map(([id,cfg])=>[id,{color:cfg.color,deep:cfg.deep,text:cfg.text}]))},null,2),status=panel.querySelector('.cl-debug-status');try{await navigator.clipboard.writeText(data);status.textContent='已复制参数 JSON'}catch{let area=panel.querySelector('textarea');if(!area){area=document.createElement('textarea');panel.append(area)}area.value=data;area.select();status.textContent='请手动复制下方参数'}};
 }
 panel.hidden=!debugOpen;
 if(debugOpen&&!active)showLoading(1);
}
addEventListener('keydown',e=>{if(window.CloudLoading?.debug&&e.key.toLowerCase()==='d'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!/INPUT|TEXTAREA/.test(e.target.tagName)){e.preventDefault();toggleDebug()}});

window.CloudLoading={params,levels,assetPath:new URL('assets/loading/',scriptBase).href,hold:1500};
window.showLoading=function(levelId,onDone,options={}){
if(active)active.cancel();
editingLevel=Number(levelId)||1;syncColors();
const cfg=levels[levelId]||levels[1],root=document.createElement('div');root.className='cloud-loading';root.innerHTML='<canvas></canvas><div class="cl-copy"><div class="cl-number" role="progressbar" aria-valuemin="0" aria-valuemax="100">0<span>%</span></div><p></p></div>';document.body.append(root);
const tint=(amount)=>{const rgb=[1,3,5].map(i=>Math.round(parseInt(cfg.color.slice(i,i+2),16)*(1-amount)+255*amount));return '#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('')};
const c=root.querySelector('canvas'),ctx=c.getContext('2d'),num=root.querySelector('.cl-number'),label=root.querySelector('p');label.textContent=cfg.text;
let previousProgress=0,stepPhase=0,lastNumber=-1,numberTime=0;
let progress=0,target=0,start=performance.now(),last=start,complete=0,raf,dead=false,angle=.75,velocity=0,drag=false,lastDrag=0,scale=1,ox=0,oy=0;
let wallLast=start,animationNow=start;
const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
const images={};['ip_crawl.png',...Array.from({length:4},(_,i)=>`ip_crawl_${i+1}.png`),'ip_hang.png',cfg.charm].forEach(n=>{let im=new Image();im.onload=()=>{images[n]=im;if(n.startsWith('ip_')){const tmp=document.createElement('canvas');tmp.width=im.width;tmp.height=im.height;const tc=tmp.getContext('2d');tc.drawImage(im,0,0);const a=tc.getImageData(0,0,tmp.width,tmp.height).data;let l=im.width,r=0,top=im.height,b=0;for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++)if(a[(y*im.width+x)*4+3]>24){l=Math.min(l,x);r=Math.max(r,x);top=Math.min(top,y);b=Math.max(b,y)}im.bounds={l,top,w:r-l+1,h:b-top+1}}};im.onerror=()=>{};im.src=(CloudLoading.embeddedAssets||{})[n] || CloudLoading.assetPath+n});
const stars=Array.from({length:72},(_,i)=>({x:Math.random(),y:Math.random(),radius:i%13===0?2.2+Math.random()*1.2:.45+Math.random()*1.3,phase:Math.random()*Math.PI*2,speed:.45+Math.random()*1.2,cross:i%13===0}));
function resize(){const d=Math.min(devicePixelRatio||1,2);c.width=innerWidth*d;c.height=innerHeight*d;c.style.width=innerWidth+'px';c.style.height=innerHeight+'px';ctx.setTransform(d,0,0,d,0,0);scale=Math.min(innerWidth/1180,innerHeight/740,1.2);ox=innerWidth/2-35*scale;oy=innerHeight*.43;root.querySelector('.cl-copy').style.top=(oy+175*scale)+'px'}resize();addEventListener('resize',resize);
function pic(n,x,y,w,h){const im=images[n];if(im)ctx.drawImage(im,x,y,w,h);else{ctx.fillStyle=cfg.color;ctx.beginPath();ctx.roundRect(x+w*.2,y+h*.2,w*.6,h*.6,12);ctx.fill()}}
function line(x,y,X,Y,color,width){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(X,Y);ctx.stroke()}
function bottle(){ctx.beginPath();ctx.moveTo(-300,-52);ctx.bezierCurveTo(-365,-52,-365,62,-300,62);ctx.lineTo(240,62);ctx.quadraticCurveTo(277,62,290,32);ctx.lineTo(330,32);ctx.lineTo(330,-30);ctx.lineTo(290,-30);ctx.quadraticCurveTo(277,-52,240,-52);ctx.closePath()}
function makeWater(){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192;
 const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false});if(!gl)return null;
 const vertex='attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
 const fragment=`precision mediump float;
 varying vec2 uv;uniform float time,density;uniform vec3 tint;
 vec2 hash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
 float cells(vec2 p,float t){
 vec2 ip=floor(p),fp=fract(p);float a=20.,b=20.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
 vec2 n=vec2(float(x),float(y)),h=hash(ip+n);
 vec2 site=.5+.34*sin(t*.6+6.28318*h),r=n+site-fp;float d=dot(r,r);
 if(d<a){b=a;a=d;}else if(d<b){b=d;}
 }return sqrt(b)-sqrt(a);
 }
 void main(){
 float t=time;vec2 p=vec2(uv.x*density,uv.y*1.85);
 // Domain warping bends cell boundaries into broad, fluid ribbons.
 p+=vec2(.34*sin(p.y*2.5+t*.67)+.19*sin(p.x*1.6-t*.43),.26*sin(p.x*1.9+t*.53)+.14*cos(p.y*3.-t*.41));
 float edge=cells(p+vec2(t*.10,0.),t);
 float core=exp(-edge*edge*950.);
 float ribbon=exp(-edge*edge*115.);
 float bloom=exp(-edge*edge*20.);
 float pulse=.72+.28*sin(p.x*2.+p.y*2.8-t*.8);
 float depth=.5+.5*sin(p.x*2.3-p.y*1.5+t*.55);
 float beams=pow(.5+.5*sin(p.x*3.8+.9*sin(p.y*2.+t*.4)-t*.35),5.);
 float alpha=(core*.46+ribbon*.27+bloom*.12)*pulse+beams*.075+depth*.025;
 vec3 col=mix(tint,vec3(1.),.36+core*.52);
 gl_FragColor=vec4(col,alpha);
 }`;
 const program=gl.createProgram();
 for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){gl.deleteProgram(program);return null}gl.attachShader(program,sh)}
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return null;gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 const loc=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);gl.viewport(0,0,1024,192);
 const clock=gl.getUniformLocation(program,'time'),density=gl.getUniformLocation(program,'density'),color=gl.getUniformLocation(program,'tint');
 return {draw(context,t){gl.uniform1f(clock,t*params.stripeSpeed/14);gl.uniform1f(density,params.stripeCount*.65+1.5);gl.uniform3fv(color,[1,3,5].map(i=>parseInt(cfg.color.slice(i,i+2),16)/255));gl.drawArrays(gl.TRIANGLES,0,6);context.drawImage(canvas,-350,-53,690,106)},dispose(){gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext()}};
}
const liquidCanvas=document.createElement("canvas");liquidCanvas.width=900;liquidCanvas.height=240;const water=makeWater();
const glass3D=window.createGlassRenderer?.();

function cleanup(){if(dead)return;dead=true;water?.dispose();glass3D?.dispose();cancelAnimationFrame(raf);removeEventListener('resize',resize);root.remove();document.body.style.overflow=oldOverflow;if(active===api)active=null}
const api={setProgress(v){if(Number.isFinite(v))target=Math.max(target,Math.min(100,Math.max(0,v)))},complete(){target=100},cancel:cleanup};active=api;
c.onpointerdown=e=>{if(!complete||paused)return;const x=(e.clientX-ox)/scale,y=(e.clientY-oy)/scale;if(Math.hypot(x-(335+Math.sin(angle)*145),y-(Math.cos(angle)*145))<100){drag=true;c.setPointerCapture(e.pointerId);lastDrag=performance.now()}};
c.onpointermove=e=>{if(!drag||paused)return;const next=Math.max(-1.4,Math.min(1.4,Math.atan2((e.clientX-ox)/scale-335,(e.clientY-oy)/scale)));velocity=(next-angle)/Math.max(.016,(performance.now()-lastDrag)/1000);angle=next;lastDrag=performance.now()};c.onpointerup=c.onpointercancel=()=>{drag=false};
function frame(wallNow){if(dead)return;const elapsedWall=wallNow-wallLast;wallLast=wallNow;if(!paused)animationNow+=elapsedWall;const now=animationNow;if(!images['ip_crawl_1.png']&&now-start<1500){raf=requestAnimationFrame(frame);return;}let dt=Math.min((now-last)/1000,.04);last=now;let t=(now-start)/1000;
if(!options.manual){const elapsed=t*3.8/params.duration;const keys=[[0,0],[.8,0],[1.55,40],[1.85,40],[2.65,75],[2.95,75],[3.8,100]];for(let i=1;i<keys.length;i++)if(elapsed>=keys[i-1][0]){let a=keys[i-1],b=keys[i];target=a[1]+(b[1]-a[1])*Math.min(1,(elapsed-a[0])/(b[0]-a[0]))}}
previousProgress=progress;progress+=(target-progress)*Math.min(1,dt*18);const moving=progress-previousProgress>.012;if(moving)stepPhase+=dt/.48;if(target===100&&progress>99.8)progress=100;
if(progress===100&&!complete){complete=now;label.textContent='准备好啦 ✦'}const done=complete?(now-complete)/1000:0;
const digit=Math.floor(progress);if(digit!==lastNumber){lastNumber=digit;numberTime=now;num.innerHTML=digit+'<span>%</span>'}let np=Math.min(1,(now-numberTime)/260);num.style.transform='translateY('+(-Math.sin(np*Math.PI)*3)+'px) scale('+(complete?1+Math.sin(Math.min(1,done/.5)*Math.PI)*.16:1)+')';num.setAttribute('aria-valuenow',Math.floor(progress));
if(!complete)label.textContent=cfg.text;
const copy=root.querySelector('.cl-copy');copy.style.left=`calc(50% + ${params.textX}px)`;copy.style.top=(oy+175*scale+params.textY)+'px';num.style.fontSize=params.numberSize+'px';num.querySelector('span').style.fontSize=params.percentSize/100+'em';label.style.fontSize=params.labelSize+'px';label.style.marginTop=params.textGap+'px';
ctx.clearRect(0,0,innerWidth,innerHeight);ctx.fillStyle='#030710';ctx.fillRect(0,0,innerWidth,innerHeight);
for(const star of stars){
 const twinkle=Math.pow((1+Math.sin(t*star.speed+star.phase))/2,2),alpha=.1+twinkle*.75;
 const x=star.x*innerWidth,y=(star.y*innerHeight-t*(star.cross?1:2)+innerHeight)%innerHeight,r=star.radius;
 ctx.save();ctx.globalAlpha=alpha;
 const haze=ctx.createRadialGradient(x,y,0,x,y,r*5);haze.addColorStop(0,cfg.color+'88');haze.addColorStop(1,cfg.color+'00');ctx.fillStyle=haze;ctx.fillRect(x-r*5,y-r*5,r*10,r*10);
 ctx.fillStyle=star.cross?'#f2f7ff':cfg.color;ctx.beginPath();ctx.arc(x,y,r*(.7+twinkle*.3),0,Math.PI*2);ctx.fill();
 if(star.cross){ctx.globalAlpha=alpha*.65;ctx.strokeStyle='#ecf6ff';ctx.lineWidth=.65;const reach=r*(1.5+twinkle);ctx.beginPath();ctx.moveTo(x-reach,y);ctx.lineTo(x+reach,y);ctx.moveTo(x,y-reach);ctx.lineTo(x,y+reach);ctx.stroke()}
 ctx.restore();
}ctx.globalAlpha=1;
ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);
ctx.save();ctx.scale(1,.8); // Flatten the bottle and liquid together by 20%.
ctx.save();ctx.clip(glassPath());let halo=ctx.createRadialGradient(0,0,25,0,0,480);const haloAlpha=Math.min(.85,(.025+progress/100*.32)*params.halo);halo.addColorStop(0,cfg.color+Math.round(haloAlpha*255).toString(16).padStart(2,'0'));halo.addColorStop(.45,cfg.color+Math.round(haloAlpha*90).toString(16).padStart(2,'0'));halo.addColorStop(1,cfg.color+'00');ctx.fillStyle=halo;ctx.fillRect(-500,-350,1000,700);ctx.restore();

if(!glass3D){ctx.save();bottle();ctx.shadowColor=cfg.color;ctx.shadowBlur=20;ctx.strokeStyle=cfg.color+'30';ctx.lineWidth=3;ctx.stroke();ctx.restore();}
// Outer glass and inset liquid retain matching cap, shoulder and neck geometry.
function glassPath(){return new Path2D('M -350 0 C -350 -31 -329 -53 -300 -53 L 239 -53 Q 265 -53 288 -29 L 335 -29 L 335 29 L 288 29 Q 265 53 239 53 L -300 53 C -329 53 -350 31 -350 0 Z')}
// Six design units of glass thickness, following the same cap, shoulder and neck.
function innerPath(){return new Path2D('M -344 0 C -344 -27 -325 -47 -300 -47 L 239 -47 Q 262 -47 285 -23 L 329 -23 L 329 23 L 285 23 Q 262 47 239 47 L -300 47 C -325 47 -344 27 -344 0 Z')}
const front=-345+675*progress/100;
let wave='M -360 -60 L '+front+' -60';
for(let y=-60;y<=60;y+=2){const bend=progress>=99.8?0:Math.cos(y/60*Math.PI/2)*5+Math.sin(y*.085-t*Math.PI*2/1.2)*3.5;wave+=' L '+(front+bend)+' '+y}wave+=' L -360 60 Z';
const liquidShape=new Path2D(wave),inside=innerPath();
// Render an isolated liquid layer so the two drop shadows can escape its clip.
const lc=liquidCanvas,lx=lc.getContext('2d');lx.setTransform(1,0,0,1,0,0);lx.clearRect(0,0,900,240);lx.translate(450,120);lx.save();lx.clip(inside);lx.clip(liquidShape);
let g=lx.createLinearGradient(0,-45,0,45);g.addColorStop(0,tint(.72));g.addColorStop(.12,cfg.color);g.addColorStop(.48,cfg.color);g.addColorStop(1,cfg.deep);lx.fillStyle=g;lx.fillRect(-360,-60,710,120);
let volume=lx.createLinearGradient(0,-45,0,45);volume.addColorStop(0,'#ffffff60');volume.addColorStop(.22,'#ffffff00');volume.addColorStop(.72,'#001b2910');volume.addColorStop(1,'#001b2940');lx.fillStyle=volume;lx.fillRect(-360,-60,710,120);
lx.save();lx.scale(1,1/.8); // Preserve water-pattern proportions inside the flattened bottle.
if(water){water.draw(lx,t)}else{
// Animated Voronoi caustics: connected, organically drifting light cells.
const cell=740/(params.stripeCount+3),clock=t*params.stripeSpeed/22,seeds=[];
for(let row=-2;row<5;row++)for(let col=-2;col<15;col++){
 const id=row*31+col*17;
 seeds.push({x:-390+col*cell+(row%2)*cell*.5+Math.sin(clock*.65+id*1.7)*cell*.21,y:-95+row*cell*.68+Math.cos(clock*.8+id*.83)*cell*.18});
}
lx.beginPath();
for(const seed of seeds){if(seed.x < -440||seed.x>410||seed.y < -120||seed.y>120)continue;
 let poly=[[-450,-160],[450,-160],[450,160],[-450,160]];
 for(const other of seeds){if(other===seed||Math.abs(other.x-seed.x)>cell*2.5||Math.abs(other.y-seed.y)>cell*2.5)continue;
 const nx=other.x-seed.x,ny=other.y-seed.y,limit=(other.x*other.x+other.y*other.y-seed.x*seed.x-seed.y*seed.y)/2,next=[];
 for(let i=0;i<poly.length;i++){const u=poly[i],v=poly[(i+1)%poly.length],du=u[0]*nx+u[1]*ny-limit,dv=v[0]*nx+v[1]*ny-limit;if(du<=0)next.push(u);if((du<=0)!=(dv<=0)){const f=du/(du-dv);next.push([u[0]+(v[0]-u[0])*f,u[1]+(v[1]-u[1])*f])}}poly=next;if(!poly.length)break;
 }
 if(poly.length){lx.moveTo(...poly[0]);for(let i=1;i<poly.length;i++)lx.lineTo(...poly[i]);lx.closePath()}
}
lx.save();lx.strokeStyle=tint(.65)+'5c';lx.lineWidth=3;lx.shadowColor=tint(.75);lx.shadowBlur=5;lx.stroke();lx.shadowBlur=0;lx.strokeStyle=tint(.9)+'99';lx.lineWidth=.85;lx.stroke();lx.restore();
for(let i=0;i<14;i++){let x=-345+(i*57+clock*5)%690,y=48-(i*21+t*(5+i%3))%96;lx.strokeStyle=tint(.9)+'60';lx.lineWidth=1;lx.beginPath();lx.arc(x,y,1.5+i%3,0,Math.PI*2);lx.stroke()}
}
lx.restore();
lx.strokeStyle='#ffffffc9';lx.lineWidth=2.6;lx.beginPath();lx.moveTo(-334,-31);lx.quadraticCurveTo(-322,-41,-297,-41);lx.lineTo(270,-41);lx.stroke();
lx.strokeStyle=tint(.8)+'b0';lx.lineWidth=1.6;lx.beginPath();for(let y=-48;y<=48;y+=2){const x=front+Math.cos(y/60*Math.PI/2)*5+Math.sin(y*.085-t*Math.PI*2/1.2)*3.5;y===-48?lx.moveTo(x,y):lx.lineTo(x,y)}lx.stroke();lx.restore();
ctx.save();ctx.clip(glassPath());ctx.filter=`saturate(${params.saturation}) brightness(${params.brightness}) drop-shadow(0 0 ${12*params.glow}px ${cfg.color}) drop-shadow(0 0 ${30*params.glow}px ${cfg.color})`;ctx.drawImage(lc,-450,-120);ctx.restore();
ctx.save();ctx.clip(inside);ctx.clip(liquidShape);
if(Number(levelId)===1){}
else if(Number(levelId)===2){for(let i=0;i<15;i++){ctx.save();ctx.translate(-340+(i*53+t*9)%670,Math.sin(i+t*.4)*35);ctx.rotate(i+t*.35);ctx.fillStyle=i%2?'#ffd4eeaa':'#e6ceffaa';ctx.beginPath();ctx.ellipse(0,0,4,8,0,0,7);ctx.fill();ctx.restore()}}
else{for(let i=0;i<cfg.bubbles;i++){let x=-340+((i*47+t*5)%660),y=52-((i*19+t*(12+i%4))%100);ctx.strokeStyle='#ffffff80';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,2+i%4,0,7);ctx.stroke()}}
ctx.restore();
if(glass3D){
glass3D.draw(ctx,c,ox,oy,scale,done);
// Glass and liquid use exactly the same contour, avoiding independent 3D silhouettes.
ctx.save();ctx.clip(glassPath());ctx.fillStyle='#c8f6ff08';ctx.fillRect(-360,-60,710,120);
let sheen=ctx.createLinearGradient(0,-53,0,53);sheen.addColorStop(0,'#f4ffff70');sheen.addColorStop(.10,'#ffffff20');sheen.addColorStop(.28,'#ffffff00');sheen.addColorStop(.82,'#ffffff00');sheen.addColorStop(1,'#bdfaf32a');ctx.fillStyle=sheen;ctx.fillRect(-360,-60,710,120);
ctx.strokeStyle='#f1ffff85';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(-327,-35);ctx.quadraticCurveTo(-317,-47,-295,-47);ctx.lineTo(238,-47);ctx.stroke();
ctx.restore();
}else{
// Layered glass: transparent body, thick lower rim, curved specular reflections.
ctx.save();bottle();ctx.clip();
let glass=ctx.createLinearGradient(0,-55,0,63);glass.addColorStop(0,'#e5f4ff45');glass.addColorStop(.09,'#ffffff13');glass.addColorStop(.28,'#b9e1fa03');glass.addColorStop(.65,'#adccdf02');glass.addColorStop(.9,'#99bcd31b');glass.addColorStop(1,'#e0f6ff65');ctx.fillStyle=glass;ctx.fillRect(-370,-60,710,130);
let reflection=ctx.createLinearGradient(-320,0,300,0);reflection.addColorStop(0,'#ffffff00');reflection.addColorStop(.12,'#ffffffad');reflection.addColorStop(.65,'#ffffff45');reflection.addColorStop(.95,'#ffffff05');ctx.strokeStyle=reflection;ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-331,-22);ctx.quadraticCurveTo(-320,-43,-292,-43);ctx.lineTo(226,-43);ctx.quadraticCurveTo(258,-43,282,-22);ctx.stroke();
ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(-305,-34);ctx.lineTo(165,-34);ctx.stroke();
ctx.strokeStyle='#e7faff4d';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-329,34);ctx.quadraticCurveTo(-317,55,-288,55);ctx.lineTo(236,55);ctx.quadraticCurveTo(263,55,284,27);ctx.stroke();
let edge=ctx.createLinearGradient(-356,0,-300,0);edge.addColorStop(0,'#ecfaff77');edge.addColorStop(.25,'#92b9d22b');edge.addColorStop(.6,'#d5f5ff08');edge.addColorStop(1,'#ffffff00');ctx.fillStyle=edge;ctx.fillRect(-360,-55,65,120);ctx.restore();
bottle();ctx.strokeStyle='#b8d0df70';ctx.lineWidth=1.3;ctx.stroke();
// Thick elliptical lip with a dark bore and offset highlights.
ctx.save();ctx.translate(329,1);let lip=ctx.createLinearGradient(-12,0,13,0);lip.addColorStop(0,'#7893a6');lip.addColorStop(.22,'#e5f4fc');lip.addColorStop(.43,'#5b7489');lip.addColorStop(.7,'#a8c3d1');lip.addColorStop(1,'#f1fcff');ctx.fillStyle=lip;ctx.beginPath();ctx.roundRect(-10,-38,19,76,6);ctx.fill();ctx.fillStyle='#101e2e';ctx.beginPath();ctx.ellipse(9,0,7,31,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d8f2ffb0';ctx.lineWidth=2;ctx.stroke();line(-5,-31,-5,29,'#ffffffbf',2);ctx.restore();
// Tapered cork, cylindrical lighting, deterministic pores and end grain.
ctx.save();ctx.translate(342+(complete?Math.sin(Math.min(done,1)*Math.PI)*30:0),0);ctx.rotate(complete?Math.min(done,1)*.25:0);
ctx.beginPath();ctx.moveTo(-8,-24);ctx.lineTo(26,-28);ctx.quadraticCurveTo(32,-28,33,-21);ctx.lineTo(33,22);ctx.quadraticCurveTo(32,29,26,28);ctx.lineTo(-8,24);ctx.closePath();ctx.save();ctx.clip();let cork=ctx.createLinearGradient(0,-28,0,29);cork.addColorStop(0,'#a7804e');cork.addColorStop(.18,'#dcc094');cork.addColorStop(.4,'#bf9767');cork.addColorStop(.72,'#987046');cork.addColorStop(1,'#503923');ctx.fillStyle=cork;ctx.fillRect(-10,-30,46,60);
for(let i=0;i<150;i++){let x=-8+((Math.sin(i*127.1)*43758.54)%1+1)%1*43,y=-27+((Math.sin(i*311.7)*17932.3)%1+1)%1*54;ctx.fillStyle=i%3?'#49311d55':'#f2d9ad55';ctx.beginPath();ctx.ellipse(x,y,.35+i%3*.3,.25+i%4*.3,.3,0,7);ctx.fill()}line(-7,-16,30,-19,'#f6d8a044',1);ctx.restore();
let end=ctx.createLinearGradient(22,0,36,0);end.addColorStop(0,'#8c613b');end.addColorStop(.6,'#c4a073');end.addColorStop(1,'#ab8255');ctx.fillStyle=end;ctx.beginPath();ctx.ellipse(30,0,5,27,0,0,7);ctx.fill();ctx.strokeStyle='#efcea16b';ctx.lineWidth=.8;ctx.stroke();for(let i=0;i<20;i++){ctx.fillStyle='#68442b70';ctx.fillRect(27+(i*7%6),-23+(i*13%46),.8,1.6)}ctx.restore();
}
// Shared contour replaces the former independently scaled silhouette.
if(complete&&done<.24){ctx.save();bottle();ctx.fillStyle='rgba(255,255,255,'+(.65*(1-done/.24))+')';ctx.fill();ctx.restore()}
if(!complete&&t<.8){for(let i=0;i<22;i++){let u=Math.max(0,Math.min(1,t/.8-i*.013));ctx.save();ctx.globalAlpha=Math.sin(u*Math.PI)*.32;ctx.filter='blur(8px)';ctx.fillStyle=cfg.color;ctx.beginPath();ctx.ellipse(365-u*700,Math.sin(u*8+i*.4)*14,28,10+i%4,0,0,7);ctx.fill();ctx.restore()}}
ctx.restore(); // Keep the character and charms at their original aspect ratio.
if(!complete){ctx.save();const frames=[1,2,3,4].every(i=>images[`ip_crawl_${i}.png`]);const sprite=frames?images[`ip_crawl_${moving?Math.floor(stepPhase*4)%4+1:1}.png`]:images['ip_crawl.png'];const size=145*params.characterScale;
ctx.translate(-328+progress*6.35,-49*.8+params.characterY);
if(sprite?.bounds){const b=sprite.bounds,h=size*b.h/b.w;ctx.drawImage(sprite,b.l,b.top,b.w,b.h,-size/2,-h+(frames?0:Math.sin(t*3)*1.5),size,h)}
ctx.restore();for(let i=0;i<20;i++){let u=i/19,x=345+u*89,y=22+Math.sin(u*Math.PI)*64;ctx.strokeStyle=i%2?'#e3b960':'#ffdfa0';ctx.lineWidth=2.6;ctx.beginPath();ctx.ellipse(x,y,4,6,-Math.cos(u*Math.PI)*.6,0,7);ctx.stroke()}pic(cfg.charm,365,-32+Math.sin(t*1.4)*3,150,150)}else{
if(done<.18){angle=-.65;velocity=2.3}if(!drag){velocity+=(-8*Math.sin(angle)-1.2*velocity)*dt;angle+=velocity*dt}ctx.save();ctx.translate(335,0);ctx.rotate(-angle);for(let y=12;y<145;y+=9){ctx.strokeStyle=y%2?'#f9d38e':'#b98a42';ctx.lineWidth=2.6;ctx.beginPath();ctx.ellipse(0,y,3,6,0,0,7);ctx.stroke()}pic(cfg.charm,-65,120,130,130);const raw=Math.max(0,Math.min(1,(done-.25)/.8));const descend=Math.min(1,(Math.floor(raw*7)+Math.pow((raw*7)%1,2))/7);pic('ip_hang.png',-84,-110+descend*212,110,140);ctx.restore();
if(done>.12&&done<1.05){for(let i=0;i<24;i++){const a=i/24*Math.PI*2,r=(done-.12)*150;ctx.globalAlpha=1-done/.9;ctx.fillStyle=cfg.color;ctx.beginPath();ctx.arc(360+Math.cos(a)*r,75+Math.sin(a)*r,2.5,0,7);ctx.fill();if(i%5===0){let sx=360+Math.cos(a)*r,sy=75+Math.sin(a)*r;line(sx-5,sy,sx+5,sy,cfg.color,1.5);line(sx,sy-5,sx,sy+5,cfg.color,1.5)}}ctx.globalAlpha=1}}
ctx.restore();if(complete&&done>2+CloudLoading.hold/1000&&!drag){root.style.opacity=Math.max(0,1-(done-2-CloudLoading.hold/1000)/.45);if(done>2.45+CloudLoading.hold/1000){cleanup();if(debugOpen){showLoading(levelId,onDone,options)}else if(typeof onDone==='function')onDone();return}}raf=requestAnimationFrame(frame)}raf=requestAnimationFrame(frame);return api;
};})();
