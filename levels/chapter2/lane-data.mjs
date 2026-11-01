// 第二章右线 · 湖岸睡莲路（横版）—— 纯数据与几何，核心逻辑和画面共用。
// 路径是一段圆弧：玩家沿弧线左右走，镜头放在圆心一侧向外看（背景是远处的粉色草丘和中央花园）。
export const LANE={cx:35.9,cz:-0.92,R:23,phi0:197*Math.PI/180};
export const U_END=131;

export function lanePoint(u){
  const p=LANE.phi0+u/LANE.R,c=Math.cos(p),s=Math.sin(p);
  return {x:LANE.cx+LANE.R*c,z:LANE.cz+LANE.R*s,nx:c,nz:s,tx:-s,tz:c};
}

// 平台（solid = 下面一直连到水里，侧面会挡人）
export const DECKS=[
  {id:'shore',u0:-1.2,u1:8,y:.05},
  {id:'box',u0:86.6,u1:94,y:3.4},
];
// 睡莲：stable 稳定；open 靠近才张开、离开 3 秒合拢；ghost 只在倒影里，Q 共鸣后 6 秒可站；post 升高的石柱
export const LILIES=[
  {u:10.6,k:'stable'},{u:14,k:'stable'},{u:17.4,k:'stable'},
  {u:21.2,k:'open'},{u:25,k:'open'},{u:29,k:'open'},
  {u:39,k:'open'},{u:43,k:'open'},{u:47,k:'open'},
  {u:57,k:'open'},{u:61,k:'open'},
  {u:65,k:'ghost'},{u:69,k:'ghost'},{u:73,k:'ghost'},
  {u:77,k:'post',y:1},{u:80.5,k:'post',y:2},{u:84,k:'post',y:3},
];
export const LILY_Y=.08;
export const BOX_U=92;
export const GLIDE_GAPS=[[30,38],[48,56]];
export const SLIDE={u0:94,u1:121.6,y0:3.25,y1:.3,gaps:[[102.6,103.6],[112.1,113.1]],bars:[103.1,112.6]};
export function slideY(u){const t=Math.min(1,Math.max(0,(u-SLIDE.u0)/(SLIDE.u1-SLIDE.u0)));return SLIDE.y0+(SLIDE.y1-SLIDE.y0)*t+.25*Math.sin(t*Math.PI*3);}
export const inSlideGap=u=>SLIDE.gaps.some(([a,b])=>u>a&&u<b);
// 本段检查点（掉水后回到所在小节开头）
export const LANE_CPS=[{u:.8,name:'湖岸小路'},{u:17.4,name:'睡莲连跳'},{u:88,name:'八音盒平台'}];

// 从中央花园东北侧接入横版段的小栈桥；横版段尾端接回原来的东南小桥。
function bez(p0,p1,p2,p3,n){const o=[];for(let i=0;i<=n;i++){const t=i/n,a=(1-t)**3,b=3*(1-t)**2*t,c=3*(1-t)*t*t,d=t**3;o.push({x:a*p0.x+b*p1.x+c*p2.x+d*p3.x,y:a*p0.y+b*p1.y+c*p2.y+d*p3.y,z:a*p0.z+b*p1.z+c*p2.z+d*p3.z});}return o;}
// 入口：从中央花园东北边沿径向伸出，顺弧线切入横版路线起点（两端方向都连续，没有折角）
const S=lanePoint(0),HUB_IN={x:7.54,y:.03,z:-4.15},OUT={x:.877,z:-.482};
export const ENTRY_DECK=bez(HUB_IN,{x:HUB_IN.x+OUT.x*2.6,y:.04,z:HUB_IN.z+OUT.z*2.6},{x:S.x-S.tx*2.6,y:.05,z:S.z-S.tz*2.6},{x:S.x,y:.05,z:S.z},12);
export const LANE_ENTRY=(()=>{const p=lanePoint(.3);return {u:.6,x:p.x,z:p.z};})();
export const LANE_BACK={...ENTRY_DECK[4],y:.05};
// 出口：横版终点顺势左转 90°（半径 3 米），再直行回到中央花园
const E=lanePoint(U_END),EN={x:E.tz,z:-E.tx},TR=3,EC={x:E.x+EN.x*TR,z:E.z+EN.z*TR};
export const EXIT_PATH=[...Array.from({length:10},(_,i)=>{const th=i/9*Math.PI/2;return {x:EC.x-TR*EN.x*Math.cos(th)+TR*E.tx*Math.sin(th),y:.05,z:EC.z-TR*EN.z*Math.cos(th)+TR*E.tz*Math.sin(th)};}),...[1.1,2.2,3.3].map(d=>({x:EC.x+TR*E.tx+EN.x*d,y:.04,z:EC.z+TR*E.tz+EN.z*d}))];
EXIT_PATH.forEach((p,i,a)=>{p.y=.3-.1*i/(a.length-1);});
// 水道出口：滑到中央花园边缘后，落到花园里面一点的位置
const _e=EXIT_PATH[EXIT_PATH.length-1],_p=EXIT_PATH[EXIT_PATH.length-2],_l=Math.hypot(_e.x-_p.x,_e.z-_p.z),_d={x:(_e.x-_p.x)/_l,z:(_e.z-_p.z)/_l};
const _r=Math.hypot(_e.x,_e.z),_u={x:_e.x/_r,z:_e.z/_r};// 沿半径往花园里收，保证池子整个在花园里
export const POOL={x:0,z:0,r:8.95};// 落水池已去掉：水槽在花园边缘结束（POOL 用来表示“花园边缘”以内）
// 水槽末端：垂直于水流方向截断，截在“靠花园一侧的槽沿刚碰到花园边缘”的位置（两侧槽沿都在花园外）
const LIP=1.05,_dense=[];for(let i=1;i<EXIT_PATH.length;i++){const A=EXIT_PATH[i-1],B=EXIT_PATH[i],L=Math.hypot(B.x-A.x,B.z-A.z),n=Math.max(1,Math.ceil(L/.05));for(let k=(i===1?0:1);k<=n;k++){const t=k/n;_dense.push({x:A.x+(B.x-A.x)*t,y:A.y+(B.y-A.y)*t,z:A.z+(B.z-A.z)*t,tx:(B.x-A.x)/L,tz:(B.z-A.z)/L});}}
const _outside=p=>[-1,1].every(s=>Math.hypot(p.x-p.tz*LIP*s,p.z+p.tx*LIP*s)>=POOL.r+.03);
let _endI=0;for(let i=0;i<_dense.length;i++){if(_outside(_dense[i]))_endI=i;else break;}
export const CHANNEL_END=_dense[_endI];
export const CHANNEL_PTS=_dense.slice(0,_endI+1).filter((p,i,a)=>i%5===0||i===a.length-1).map(({x,y,z})=>({x,y,z}));
const _dir={x:CHANNEL_END.tx,z:CHANNEL_END.tz};let _hd=0;while(Math.hypot(CHANNEL_END.x+_dir.x*_hd,CHANNEL_END.z+_dir.z*_hd)>POOL.r-1.3&&_hd<6)_hd+=.05;
export const HUB_LAND={x:CHANNEL_END.x+_dir.x*_hd,y:0,z:CHANNEL_END.z+_dir.z*_hd};
export const CHUTE_PATH=[...CHANNEL_PTS,{x:CHANNEL_END.x+_dir.x*_hd*.55,y:.06,z:CHANNEL_END.z+_dir.z*_hd*.55},{...HUB_LAND}];
export const EXIT_SPAWN={...HUB_LAND};
// 八音盒平台后方的蓝顶细塔（立在水中的石柱上）
export const TOWER_SPOT=(()=>{const p=lanePoint(89.6);return {x:p.x+p.nx*2.55,z:p.z+p.nz*2.55,y:3.4};})();

export function surfacesAt(u,lilyOpen,ghostOn){
  const out=[];
  for(const d of DECKS)if(u>=d.u0&&u<=d.u1)out.push({y:d.y,id:'deck-'+d.id,solid:true});
  LILIES.forEach((l,i)=>{
    const hw=l.k==='post'?.9:1.05;if(Math.abs(u-l.u)>hw)return;
    if(l.k==='open'&&(lilyOpen?.[i]??0)<.6)return;
    if(l.k==='ghost'&&!ghostOn)return;
    out.push({y:l.y??LILY_Y,id:'lily-'+i,solid:l.k==='post'});
  });
  return out;
}
