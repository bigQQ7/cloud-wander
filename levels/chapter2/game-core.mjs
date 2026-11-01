import {lanePoint,U_END,LILIES,SLIDE,slideY,inSlideGap,LANE_CPS,LANE_ENTRY,LANE_BACK,EXIT_SPAWN,CHUTE_PATH,HUB_LAND,BOX_U,GLIDE_GAPS,surfacesAt} from './lane-data.mjs?v=1793348657994569199';

export const SAVE_KEY='dream-garden-progress-v2';
export const START={x:0,y:0,z:2.6};// 记忆星仪移到了中央，出生点挪到它南侧
const CP_NAMES=['hub','courtyard','lane','laneEnd'];
const GRAVITY=18,JUMP=9.8,GLIDE_FALL=1.6;

export function normalizeSave(raw){
  const s=raw&&raw.version===2?raw:{};
  const key=!!s.key,box=!!s.musicBoxOpen;
  return {version:2,fountainOn:!!s.fountainOn,orbSeen:!!s.orbSeen,resonated:!!s.resonated||key,key,gateOpen:!!s.gateOpen,
    musicBoxOpen:box,slideDone:box&&!!s.slideDone,
    laneCp:LANE_CPS.some(c=>c.u===s.laneCp)?s.laneCp:LANE_CPS[0].u,
    checkpoint:CP_NAMES.includes(s.checkpoint)?s.checkpoint:'hub'};
}
export function missingExit(s){return [!s.key&&'金骨头',!s.slideDone&&'流水滑道'].filter(Boolean);}

export function createGame(level,save){
  const SP=level.spots||{},CH=SP.chest||[-22,-11],BN=SP.bone||[-22,-11],OR=SP.orb||[3.4,-5.5],FT=SP.fountain||[7,.9];
  let state=normalizeSave(save);
  let orbViews=0;let mode='play',pausedMode='play',elapsed=0,falls=0,doorOpen=false,zone='hub',lastSurface='hub',resonances=0,ghostUntil=-1;
  let message='从中央花园出发：左边是伙伴的房间，右边是两人最爱的滑梯',messageTTL=6;
  const actor={x:START.x,y:START.y,z:START.z,vy:0,grounded:true,gliding:false,dir:1};
  const lane={u:0};
  const slide={u:SLIDE.u0,jy:0,jvy:0,speed:4.2};
  const lilyOpen=LILIES.map(l=>l.k==='open'?0:1),lilyIdle=LILIES.map(()=>0);
  const cloudT={};
  const FREE_CP={hub:{...START},courtyard:{x:-21.5,y:2,z:-8.7},laneEnd:{...EXIT_SPAWN}};

  const notify=m=>{message=m;messageTTL=4.5;};
  const near=(x,z,r=1.6)=>Math.hypot(actor.x-x,actor.z-z)<r;
  const ghostOn=()=>elapsed<ghostUntil;
  const chute={d:0,dx:0,dz:1};const CH_LEN=CHUTE_PATH.reduce((a,p,i,arr)=>i?a+Math.hypot(p.x-arr[i-1].x,p.z-arr[i-1].z):0,0);
  const inLane=()=>mode==='lane'||mode==='slide'||(mode==='paused'&&(pausedMode==='lane'||pausedMode==='slide'));
  const laneTop=(u,maxY)=>surfacesAt(u,lilyOpen,ghostOn()).filter(s=>s.y<=maxY+.001).sort((a,b)=>b.y-a.y)[0]||null;
  const laneWall=(u,y)=>surfacesAt(u,lilyOpen,ghostOn()).some(s=>s.solid&&s.y>y+.45);

  function syncLane(){const p=lanePoint(mode==='slide'?slide.u:lane.u);actor.x=p.x;actor.z=p.z;}
  function setFree(p){mode='play';actor.x=p.x;actor.y=p.y;actor.z=p.z;actor.vy=0;actor.grounded=true;actor.gliding=false;}
  function setLane(u){mode='lane';lane.u=u;const top=laneTop(u,99);actor.y=top?top.y:.05;actor.vy=0;actor.grounded=true;actor.gliding=false;actor.dir=1;syncLane();}
  function resetTransient(){for(const p of level.pads||[]){p.dy=0;p.gone=false;p.fade=0;};for(const k in cloudT)delete cloudT[k];slide.u=SLIDE.u0;slide.jy=0;slide.jvy=0;slide.speed=4.2;}
  function place(){resetTransient();if(state.checkpoint==='lane')setLane(state.laneCp);else setFree(FREE_CP[state.checkpoint]||START);}
  function respawn(msg){place();falls++;notify(msg||'已回到检查点，任务进度保留');}
  function checkpoint(name){if(state.checkpoint!==name){state.checkpoint=name;}}
  place();

  function zoneAt(){
    if(mode==='slide')return 'slide';
    if(mode==='lane')return lane.u<86?'lily':lane.u<94.5?'box':'landing';
    if(actor.y<-.2)return 'fall';
    if(Math.hypot(actor.x+22,actor.z+12)<6.2)return 'courtyard';
    if(Math.hypot(actor.x,actor.z+22)<4.2)return 'exit';
    if(Math.hypot(actor.x,actor.z)<9.2)return 'hub';
    if(actor.x<-8)return 'cloud';
    return 'bridge';
  }

  function context(){
    if(mode==='won')return '梦境之门已开启';
    if(mode==='slide')return '空格：跳过横在水道上的花环';
    if(mode==='lane'){
      const u=lane.u;
      if(u<9)return 'A / D 左右移动 · 空格跳跃 · Shift 奔跑';
      if(GLIDE_GAPS.some(([a,b])=>u>a-3&&u<a+.5))return '前面距离太远：起跳后长按空格滑翔';
      if(u>59&&u<75.5)return ghostOn()?`倒影里的睡莲浮上来了 · 还剩 ${Math.ceil(ghostUntil-elapsed)} 秒`:'前面的睡莲只在倒影里 · 按 Q 共鸣让它们显形';
      if(u>86&&u<94.5)return state.musicBoxOpen?'八音盒已经打开 · 向右走上滑道':Math.abs(u-BOX_U)<1.7?'E 打开记忆八音盒':'走到蓝色的记忆八音盒前';
      if(u>=121)return '向右走，沿小桥回到中央花园';
      return 'A / D 移动 · 空格跳跃 · 空中长按空格滑翔 · Q 共鸣';
    }
    if(actor.x<-7.5&&actor.x>-20&&actor.z<4.5&&actor.z>-7&&actor.y<2.6&&!state.key)return '踩上粉云会被弹起来 · 落下时按空格弹得更高';
    if(!state.key&&!state.resonated&&near(BN[0],BN[1],3.5)&&actor.y>1.5)return '金骨头藏在木箱里 · 按 Q 共鸣震开木箱';
    if(!state.key&&state.resonated&&near(CH[0],CH[1],2))return 'E 拾取金骨头';
    if(!state.key&&state.resonated&&near(BN[0],BN[1],2.5))return 'E 拾取金骨头';
    if(!state.gateOpen&&near(-17,-11,2)&&actor.y>1.5)return actor.x<-17?'E 打开栅门，走拱桥回中央':'栅门锁着，只能从庭院那一侧打开';
    if(near(OR[0],OR[1],2.4)&&actor.y<1)return state.orbSeen?'记忆星仪 · 左星'+(state.key?'★':'☆')+' 右星'+(state.slideDone?'★':'☆'):'E 查看任务 · 记忆星仪';
    if(near(FT[0],FT[1],2.4)&&actor.y<1)return 'E 在许愿泉存档';
    if(near(0,-21,2.1)){const m=missingExit(state);return m.length?'E 查看出口 · 还缺：'+m.join('、'):doorOpen?'向金色光门内前进':'E 把金骨头放进门上的凹槽';}
    if(near(10.2,-5.6,2.4))return state.fountainOn?'前面是湖岸睡莲路（横版视角）':'湖面还很安静 · 先唤醒许愿泉';
    if(near(OR[0],OR[1],3.1)&&actor.y<1)return 'E 查看任务 · 记忆星仪';
    return 'WASD 移动 · Shift 奔跑 · 空格跳跃 · E 交互 · Q 共鸣 · R 回检查点';
  }

  function interact(){
    if(mode==='lane'){
      if(Math.abs(lane.u-BOX_U)<1.7&&Math.abs(actor.y-3.4)<.6&&!state.musicBoxOpen){state.musicBoxOpen=true;notify('八音盒响起了风铃的旋律……湖水被引上了滑道');}
      return;
    }
    if(mode!=='play')return;
    if(!state.key&&Math.abs(actor.y-2)<.7&&near(CH[0],CH[1],2)){if(!state.resonated){notify('木箱里有东西……按 Q 共鸣震开它');return;}state.key=true;notify('是你最喜欢的那根骨头。');return;}
    if(!state.key&&state.resonated&&near(BN[0],BN[1],2.5)&&Math.abs(actor.y-2)<.7){state.key=true;notify('拾起了金骨头。');return;}
    if(!state.key&&near(BN[0],BN[1],2)&&Math.abs(actor.y-2)<.7){notify(state.resonated?'地毯上的只是记忆里的影子，去开旁边的木箱':'骨头藏在木箱里，按 Q 共鸣震开它');return;}
    if(!state.gateOpen&&near(-17,-11,2)&&Math.abs(actor.y-2)<.8){if(actor.x<-17){state.gateOpen=true;notify('栅门打开了，沿拱桥回中央花园');}else notify('栅门只能从庭院那一侧打开');return;}
    if(near(OR[0],OR[1],3.1)&&actor.y<1){state.orbSeen=true;orbViews++;return;}
    if(near(FT[0],FT[1],2.4)&&actor.y<1){checkpoint('hub');state.fountainOn=true;notify('许愿泉涌出了泉水 · 进度已保存');return;}
    if(near(0,-21,2.1)&&Math.abs(actor.y-4)<.7){const m=missingExit(state);if(m.length){notify('梦境出口还缺：'+m.join('、'));return;}doorOpen=true;notify('金骨头嵌进了门上的凹槽——梦境出口打开了');}
  }

  function resonate(){
    if(mode!=='play'&&mode!=='lane')return;
    resonances++;
    if(mode==='lane'){ghostUntil=elapsed+6;notify('云之共鸣——倒影里的睡莲浮上来了（6 秒）');return;}
    if(!state.resonated&&!state.key&&Math.hypot(actor.x+22,actor.z+11)<3.5&&Math.abs(actor.y-2)<.7){state.resonated=true;notify('共鸣震开了木箱！金骨头掉出来了，靠近按 E 拾取。');return;}
    notify('云之共鸣……这里没有回响');
  }

  function blocked(x,z,y){
    if(!state.gateOpen&&y>1.5&&y<4&&x+.23>-17.15&&x-.23<-16.85&&z>-12.5&&z<-9.5)return true;
    if(level.entryClear?.(x,z,y))return false;
    return level.obstacles.some(b=>y+1.05>b.minY&&y+.18<b.maxY&&x+.23>b.minX&&x-.23<b.maxX&&z+.23>b.minZ&&z-.23<b.maxZ);
  }

  // 踩踏后散开，六秒后恢复。
  function updateClouds(dt){
    // 弹跳云：不再散开消失，只记录压扁回弹的时间供画面使用
    for(const p of level.pads||[]){p.gone=false;p.fade=0;if(p.sqT!==undefined)p.sqT+=dt;}
  }
  let bounces=0,lastBounce='';
  function bounceCheck(input){
    // 落到云上就被弹起来
    if(actor.grounded&&lastSurface.startsWith('cloud-')){const p=(level.pads||[]).find(q=>q.id===lastSurface);actor.vy=JUMP*1.3;actor.grounded=false;bounces++;lastBounce=lastSurface;if(p)p.sqT=0;}
  }
  function updateLilies(dt){
    LILIES.forEach((l,i)=>{
      if(l.k!=='open')return;
      const d=mode==='lane'?Math.abs(lane.u-l.u):99;
      if(d<4.2){lilyOpen[i]=Math.min(1,lilyOpen[i]+dt*3);lilyIdle[i]=0;}
      else{lilyIdle[i]+=dt;if(lilyIdle[i]>3)lilyOpen[i]=Math.max(0,lilyOpen[i]-dt*1.5);}
    });
  }

  function landingETA(){
    if(mode==='slide'){
      if(slide.jy<=0||slide.jvy>=-.2||inSlideGap(slide.u))return Infinity;
      const v=-slide.jvy;return (Math.sqrt(v*v+2*GRAVITY*slide.jy)-v)/GRAVITY;
    }
    if(actor.grounded||actor.vy>=-.2)return Infinity;
    const f=mode==='lane'?laneTop(lane.u,actor.y+.05):mode==='play'?level.height(actor.x,actor.z,actor.y+.05):null;
    if(!f)return Infinity;const gap=Math.max(0,actor.y-f.y),v=-actor.vy;
    if(gap>5.8)return Infinity;
    return actor.gliding?gap/v:(Math.sqrt(v*v+2*GRAVITY*gap)-v)/GRAVITY;
  }
  function vertical(dt,input,topFn){
    if(actor.grounded&&input.jump){actor.vy=JUMP;actor.grounded=false;}
    const sup=topFn(actor.y+.28);
    if(actor.grounded&&sup&&sup.y>=actor.y-.45){actor.y=sup.y;actor.vy=0;lastSurface=sup.id;actor.gliding=false;return;}
    actor.grounded=false;const oldY=actor.y;actor.y+=actor.vy*dt;actor.vy-=GRAVITY*dt;
    actor.gliding=!!input.jumpHeld&&actor.vy<0;
    if(actor.gliding&&actor.vy<-GLIDE_FALL)actor.vy=-GLIDE_FALL;
    const f=topFn(oldY+.28);
    if(actor.vy<=0&&f&&oldY>=f.y-.06&&actor.y<=f.y){actor.y=f.y;actor.vy=0;actor.grounded=true;actor.gliding=false;lastSurface=f.id;}
  }

  function freeTick(dt,input){
    const len=Math.hypot(input.x||0,input.z||0),speed=input.sprint?6.3:5.2;
    const dx=len?(input.x||0)/Math.max(1,len)*speed*dt:0,dz=len?(input.z||0)/Math.max(1,len)*speed*dt:0;
    if(dx||dz){
      const x=actor.x+dx,z=actor.z+dz;const sup=level.height(x,z,actor.y+.28);const y=actor.grounded&&sup&&sup.y>=actor.y-.45?sup.y:actor.y;
      if(!blocked(x,z,y)){actor.x=x;actor.z=z;}else if(!blocked(x,actor.z,y))actor.x=x;else if(!blocked(actor.x,z,y))actor.z=z;
    }
    bounceCheck(input);
    vertical(dt,input,maxY=>level.height(actor.x,actor.z,maxY));
    if(actor.y<-.3){respawn('掉进湖里了，回到检查点');return;}
    zone=zoneAt();
    if(actor.grounded){if(zone==='courtyard')checkpoint('courtyard');if(zone==='hub'&&Math.hypot(actor.x,actor.z)<7.4)checkpoint('hub');}
    if(actor.grounded&&Math.hypot(actor.x-LANE_ENTRY.x,actor.z-LANE_ENTRY.z)<.9&&!state.fountainOn){if(message!=='湖面还很安静……先去中央花园唤醒许愿泉'||!messageTTL)notify('湖面还很安静……先去中央花园唤醒许愿泉');}
    else if(actor.grounded&&Math.hypot(actor.x-LANE_ENTRY.x,actor.z-LANE_ENTRY.z)<.9){
      if(state.checkpoint!=='lane')state.laneCp=LANE_CPS[0].u;
      setLane(LANE_ENTRY.u);checkpoint('lane');notify('湖岸睡莲路');
    }
    if(doorOpen&&zone==='exit'&&actor.z<-22.1&&Math.abs(actor.x)<1.2){mode='won';notify('梦境之门 · 通关成功');}
  }

  function laneTick(dt,input){
    const mv=Math.max(-1,Math.min(1,input.x||0));if(mv)actor.dir=Math.sign(mv);
    let du=mv*(input.sprint?6.3:5.2)*dt;
    if(!state.musicBoxOpen&&lane.u+du>93.4)du=Math.max(0,93.4-lane.u);
    if(du&&!laneWall(lane.u+du+Math.sign(du)*.2,actor.y))lane.u+=du;
    vertical(dt,input,maxY=>laneTop(lane.u,maxY));
    syncLane();
    if(actor.y<-.3){place();falls++;notify('掉进湖里了，回到本段开头');return;}
    if(actor.grounded)for(const c of LANE_CPS)if(lane.u>=c.u&&state.laneCp<c.u)state.laneCp=c.u;
    if(state.musicBoxOpen&&lane.u>=SLIDE.u0-.05&&lane.u<SLIDE.u0+2.5&&actor.y>slideY(lane.u)-.3){mode='slide';slide.u=Math.max(SLIDE.u0,lane.u);const jy=Math.max(0,actor.y-slideY(slide.u));slide.jy=jy;slide.jvy=jy>0?actor.vy:0;slide.speed=4.2;notify('坐上滑道，顺着水流滑下去！');return;}
    if(lane.u>=U_END-.3){setFree(EXIT_SPAWN);checkpoint(state.slideDone?'laneEnd':'hub');notify(state.slideDone?'回到中央花园 · 记忆星仪的右星亮了':'回到中央花园');return;}
    if(lane.u<-.3){setFree(LANE_BACK);checkpoint('hub');}
  }

  function slideTick(dt,input){
    slide.speed=Math.min(7.5,slide.speed+dt*.35);slide.u+=slide.speed*dt;
    if(slide.jy>0||slide.jvy>0){slide.jy+=slide.jvy*dt;slide.jvy-=GRAVITY*dt;if(slide.jy<=0){slide.jy=0;slide.jvy=0;}}
    else if(input.jump){slide.jvy=7.5;slide.jy=.001;}
    if(inSlideGap(slide.u)&&slide.jy<.5){mode='lane';lane.u=BOX_U+.6;actor.y=3.4;actor.vy=0;actor.grounded=true;slide.jy=0;slide.jvy=0;syncLane();notify('撞上花环了，回到滑道起点再来一次');return;}
    if(slide.u>=U_END){mode='chute';chute.d=0;notify('顺着水道滑回中央花园！');return;}
    actor.y=slideY(slide.u)+slide.jy;actor.grounded=slide.jy===0;actor.dir=1;syncLane();
  }

  function tick(dt,input={}){
    dt=Math.min(Math.max(dt,0),.05);if(mode==='won'||mode==='paused')return;
    elapsed+=dt;messageTTL=Math.max(0,messageTTL-dt);
    if(input.respawn){respawn();return;}
    updateClouds(dt);updateLilies(dt);
    if(mode==='slide'){slideTick(dt,input);zone=zoneAt();return;}
    if(mode==='chute'){chute.d+=Math.max(5,slide.speed)*dt;let d=chute.d,i=1;for(;i<CHUTE_PATH.length;i++){const a=CHUTE_PATH[i-1],b=CHUTE_PATH[i],l=Math.hypot(b.x-a.x,b.z-a.z);if(d<=l){const t=d/l;actor.x=a.x+(b.x-a.x)*t;actor.z=a.z+(b.z-a.z)*t;actor.y=a.y+(b.y-a.y)*t;chute.dx=(b.x-a.x)/l;chute.dz=(b.z-a.z)/l;break;}d-=l;}
      if(chute.d>=CH_LEN){state.slideDone=true;setFree(HUB_LAND);checkpoint('laneEnd');notify('滑道完成！记忆星仪的右星亮了');}zone='slide';return;}
    if(input.interact)interact();if(input.resonate)resonate();
    if(mode==='lane')laneTick(dt,input);else if(mode==='play')freeTick(dt,input);
    zone=zoneAt();
  }

  return {tick,interact,respawn,
    pause(v){if(mode==='won')return;if(v&&mode!=='paused'){pausedMode=mode;mode='paused';}else if(!v&&mode==='paused')mode=pausedMode;},
    snapshot(){return {landingETA:landingETA(),state:JSON.parse(JSON.stringify(state)),actor:{...actor},lane:{u:lane.u},slide:{...slide},chute:{...chute},mode,inLane:inLane(),elapsed,falls,doorOpen,zone,resonances,bounces,lastBounce,
      ghostOn:ghostOn(),lilyOpen:[...lilyOpen],orbViews,message:messageTTL?message:'',hint:context(),lastSurface};}};
}
