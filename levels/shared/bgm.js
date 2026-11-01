// 背景音乐：用 Web Audio 在浏览器里实时生成，不依赖任何外部音频文件。
// 用法：import {createBGM} from '../shared/bgm.js'; createBGM('sky' | 'garden' | 'sea' | 'map');
const THEMES={
 // 关卡地图：舒缓暖色铺底 + 稀疏钟声
 map:{bpm:64,beats:4,root:60,scale:[0,2,4,7,9],bars:2,prog:[[0,4,7,14],[-3,0,4,7],[5,9,12,16],[7,11,14,19]],pad:.05,filter:2200,arp:0,melody:.22,lead:'bell',leadOct:12,bass:.07,chime:.12,bubbles:0,waltz:false,wet:.45},
 // 第一关 云端初醒：D 大调五声，竖琴分解和弦 + 风铃
 sky:{bpm:72,beats:4,root:62,scale:[0,2,4,7,9],bars:2,prog:[[0,4,7,14],[-3,0,4,7],[5,9,12,16],[7,12,14,19]],pad:.045,filter:2600,arp:.55,melody:.3,lead:'pluck',leadOct:12,bass:.07,chime:.35,bubbles:0,waltz:false,wet:.4},
 // 第二关 云上花园：F 调利底亚，3/4 八音盒圆舞曲
 garden:{bpm:88,beats:3,root:65,scale:[0,2,4,6,7,9,11],bars:1,prog:[[0,4,7,11],[2,6,9,14],[-3,0,4,7],[-5,-1,2,7],[0,4,7,11],[2,6,9,14],[-1,2,7,11],[-5,-1,2,5]],pad:.03,filter:3200,arp:0,melody:.62,lead:'box',leadOct:24,bass:.065,chime:0,bubbles:0,waltz:true,wet:.35},
 // 第三关 海底：降 E 慢速，低通铺底 + 悠长回声 + 水泡
 sea:{bpm:56,beats:4,root:51,scale:[0,2,4,7,9,11],bars:2,prog:[[0,4,7,14],[-3,0,4,7,14],[5,9,12,16],[7,11,14,17]],pad:.06,filter:900,arp:.18,melody:.2,lead:'bell',leadOct:24,bass:.08,chime:0,bubbles:.22,waltz:false,wet:.6}
};
const hz=m=>440*Math.pow(2,(m-69)/12);
export function createBGM(themeName){
 let theme=THEMES[themeName]||THEMES.map;
 let settings={music:.55,on:true};try{Object.assign(settings,JSON.parse(localStorage.getItem('cloud-music')||'{}'));}catch{}
 let globalVol=1;try{const a=JSON.parse(localStorage.getItem('cloud-audio')||'{}');if(typeof a.volume==='number')globalVol=Math.max(0,Math.min(1,a.volume))/.65;}catch{}
 let ctx,out,dry,wet,delay,fb,timer=null,next=0,step=0,chordIdx=0,melodyNote=0,seed=7;
 const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
 function save(){try{localStorage.setItem('cloud-music',JSON.stringify(settings));}catch{}}
 let muted=false;function level(){return settings.on&&!muted&&!document.hidden?settings.music*.6*Math.min(1.5,globalVol):0;}
 function apply(fade=.6){if(out)out.gain.setTargetAtTime(level(),ctx.currentTime,fade);}
 function impulse(sec){const len=Math.floor(ctx.sampleRate*sec),b=ctx.createBuffer(2,len,ctx.sampleRate);for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6);}return b;}
 function init(){
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;ctx=new AC();
  out=ctx.createGain();out.gain.value=0;out.connect(ctx.destination);
  const verb=ctx.createConvolver();verb.buffer=impulse(3.2);wet=ctx.createGain();wet.gain.value=theme.wet;verb.connect(wet);wet.connect(out);
  dry=ctx.createGain();dry.gain.value=1;dry.connect(out);dry.connect(verb);
  delay=ctx.createDelay(2);delay.delayTime.value=60/theme.bpm*.75;fb=ctx.createGain();fb.gain.value=themeName==='sea'?.42:.28;const dl=ctx.createGain();dl.gain.value=.22;delay.connect(fb);fb.connect(delay);delay.connect(dl);dl.connect(verb);dl.connect(out);
  return true;}
 function env(g,t,a,peak,decay){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+decay);}
 function osc(type,f,t,end,dest,detune=0){const o=ctx.createOscillator();o.type=type;o.frequency.value=f;o.detune.value=detune;o.connect(dest);o.start(t);o.stop(end);return o;}
 function pad(notes,t,dur){const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=theme.filter;f.Q.value=.4;const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(theme.pad,t+Math.min(1.6,dur*.35));g.gain.setValueAtTime(theme.pad,t+dur*.75);g.gain.linearRampToValueAtTime(0,t+dur+1.2);f.connect(g);g.connect(dry);
  for(const n of notes){const fr=hz(theme.root+n);osc('triangle',fr,t,t+dur+1.3,f,-6);osc('sine',fr,t,t+dur+1.3,f,5);}}
 function bass(n,t,dur){const g=ctx.createGain();env(g,t,.04,theme.bass,dur*.9);g.connect(dry);osc('sine',hz(theme.root-12+n),t,t+dur+.2,g);}
 function pluck(m,t,vol=.06){const g=ctx.createGain();env(g,t,.006,vol,1.4);g.connect(dry);g.connect(delay);osc('triangle',hz(m),t,t+1.6,g);const g2=ctx.createGain();env(g2,t,.004,vol*.35,.5);g2.connect(dry);osc('sine',hz(m+12),t,t+.6,g2);}
 function bell(m,t,vol=.05,decay=2.6){const f=hz(m);for(const [r,v,d] of [[1,1,1],[2.76,.28,.45],[5.4,.1,.25]]){const g=ctx.createGain();env(g,t,.004,vol*v,decay*d);g.connect(dry);if(r===1)g.connect(delay);osc('sine',f*r,t,t+decay*d+.1,g);}}
 function box(m,t,vol=.05){const f=hz(m);for(const [r,v,d] of [[1,1,1.1],[4,.32,.35],[6.9,.08,.18]]){const g=ctx.createGain();env(g,t,.002,vol*v,d);g.connect(dry);osc('sine',f*r,t,t+d+.1,g);}}
 function bubble(t){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';const f0=260+rnd()*260;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f0*(2.4+rnd()),t+.12);env(g,t,.01,.025,.16);o.connect(g);g.connect(dry);g.connect(delay);o.start(t);o.stop(t+.3);}
 function lead(m,t){if(theme.lead==='pluck')pluck(m,t,.055);else if(theme.lead==='box')box(m,t,.05);else bell(m,t,.04,themeName==='sea'?4:2.6);}
 function scaleNote(i){const s=theme.scale,o=Math.floor(i/s.length),k=((i%s.length)+s.length)%s.length;return o*12+s[k];}
 function schedule(t){
  const per=theme.beats*2,stepDur=60/theme.bpm/2,inBar=step%per,bar=Math.floor(step/per);
  if(inBar===0&&bar%theme.bars===0){const chord=theme.prog[chordIdx%theme.prog.length];chordIdx++;pad(chord,t,stepDur*per*theme.bars);}
  const chord=theme.prog[(chordIdx-1+theme.prog.length)%theme.prog.length];
  if(inBar===0)bass(chord[0],t,stepDur*per*(theme.waltz?.9:1.6));
  if(theme.waltz&&(inBar===2||inBar===4))for(const n of chord.slice(1,3))box(theme.root+12+n,t,.022);
  if(theme.arp&&rnd()<theme.arp){const pat=[0,1,2,3,2,1,0,2],n=chord[pat[inBar%pat.length]%chord.length];pluck(theme.root+12+n,t,.04);}
  const onBeat=inBar%2===0;if(rnd()<theme.melody*(onBeat?1:.45)){melodyNote+=Math.round((rnd()-.5)*3.2);melodyNote=Math.max(-2,Math.min(9,melodyNote));lead(theme.root+theme.leadOct+scaleNote(melodyNote),t+(rnd()<.2?stepDur*.5:0));}
  if(theme.chime&&inBar===0&&rnd()<theme.chime)for(let i=0;i<3+Math.floor(rnd()*3);i++)bell(theme.root+24+scaleNote(Math.floor(rnd()*7)),t+i*(.09+rnd()*.12),.018,1.8);
  if(theme.bubbles&&rnd()<theme.bubbles)for(let i=0;i<1+Math.floor(rnd()*3);i++)bubble(t+rnd()*stepDur);
  step++;}
 function tick(){if(!ctx||ctx.state!=='running')return;const ahead=ctx.currentTime+.35;if(next<ctx.currentTime)next=ctx.currentTime+.05;while(next<ahead){schedule(next);next+=60/theme.bpm/2;}}
 function start(){if(!ctx&&!init())return;if(ctx.state==='suspended')ctx.resume().catch(()=>{});if(!timer){timer=setInterval(tick,90);apply(2.5);}}
 addEventListener('pointerdown',start,true);addEventListener('keydown',start,true);
 document.addEventListener('visibilitychange',()=>apply(.3));addEventListener('pagehide',()=>{if(ctx){out.gain.setTargetAtTime(0,ctx.currentTime,.05);ctx.suspend?.();}});
 addEventListener('cloud-settings',e=>{if(typeof e.detail?.volume==='number'){globalVol=e.detail.volume/.65;apply(.2);}});
 // 音量控件：优先并入已有的“♪ 声音”面板；没有面板的页面放一个小按钮
 function controls(){
  const panel=[...document.querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent.includes('声音'));
  const row=document.createElement('label');row.style.display='block';row.textContent='音乐';const r=document.createElement('input');r.type='range';r.min=0;r.max=1;r.step=.01;r.value=settings.music;r.setAttribute('aria-label','音乐音量');r.oninput=()=>{settings.music=Number(r.value);settings.on=settings.music>0;save();apply(.15);};row.append(r);
  if(panel){panel.append(row);const cb=panel.querySelector('[type=checkbox]');if(cb)cb.addEventListener('change',()=>{muted=!cb.checked;apply(.2);});return;}
  const b=document.createElement('button');b.type='button';b.id='bgm-toggle';b.style.cssText='position:fixed;left:16px;bottom:16px;z-index:9999;border:0;border-radius:999px;padding:8px 14px;background:#ffffffd9;color:#4b4a55;font:13px system-ui;box-shadow:0 4px 14px #0002;cursor:pointer';
  const label=()=>b.textContent=settings.on?'♪ 音乐 开':'♪ 音乐 关';label();b.onclick=e=>{e.stopPropagation();settings.on=!settings.on;if(settings.on&&!settings.music)settings.music=.55;save();label();start();apply(.3);};document.body.append(b);}
 if(document.readyState==='loading')addEventListener('DOMContentLoaded',()=>setTimeout(controls,1200));else setTimeout(controls,1200);
 return {setTheme(name){if(THEMES[name]&&name!==themeName){themeName=name;theme=THEMES[name];step=0;chordIdx=0;if(delay)delay.delayTime.value=60/theme.bpm*.75;if(wet)wet.gain.value=theme.wet;}},stop(){clearInterval(timer);timer=null;if(out)out.gain.setTargetAtTime(0,ctx.currentTime,.4);}};
}
