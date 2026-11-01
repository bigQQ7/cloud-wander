export const zones=[{name:'苏醒草坡',x:-37,z:-15,h:1.18,rx:12.6,rz:9.6,spawn:{x:-37,y:1.18,z:-21}},{name:'风车高台',x:-10,z:17,h:5.18,rx:16.82,rz:13.92,spawn:{x:-10,y:5.18,z:12}},{name:'回声树屋',x:24,z:4,h:3.18,rx:13.6,rz:10.6,spawn:{x:23,y:3.18,z:-3}},{name:'风之塔',x:49,z:29,h:12.18,rx:10.1,rz:8.6,spawn:{x:49,y:12.18,z:23}}];
export const obstacles=[{x:-39.6,z:-12,rx:.7,rz:.8,h:7},{x:-34.4,z:-12,rx:.7,rz:.8,h:7},{x:-12.9,z:19.9,rx:1.65,rz:1.65,h:16},{x:-1.3,z:22.8,rx:2.75,rz:2.39,h:9},{x:24,z:8,rx:.85,rz:.85,h:11},{x:28,z:5,rx:2.5,rz:1.5,h:9},{x:49,z:30,rx:2.8,rz:2.9,h:30}];
export function inside(s,x,z,pad=0){const c=Math.cos(s.yaw||0),n=Math.sin(s.yaw||0),dx=x-s.x,dz=z-s.z;return ((c*dx-n*dz)/(s.rx+pad))**2+((n*dx+c*dz)/(s.rz+pad))**2<=1;}
// MVP：按真实地面落脚。provider(x,z,maxY) 返回该点不高于 maxY 的地面高度或 null。
let groundProvider=null;export function setGroundProvider(f){groundProvider=f;}
export function surfaceAt(surfaces,x,z,maxY=Infinity){const g=groundProvider?groundProvider(x,z,maxY):null;let best=g==null?null:{x,z,h:g,rx:.2,rz:.2,terrain:true};for(const s of surfaces){if(g!=null&&s.island)continue;if(s.h<=maxY&&inside(s,x,z)&&(!best||s.h>best.h))best=s;}return best;}
export function createPlayer(){return {pos:{...zones[0].spawn},vy:0,grounded:true,yaw:Math.PI,pitch:-.05,checkpoint:0,visited:new Set([0]),steps:0,jumps:0,falls:0};}
export function respawn(p){p.pos={...zones[p.checkpoint].spawn};if(groundProvider){const g=groundProvider(p.pos.x,p.pos.z,Infinity);if(g!=null)p.pos.y=g;}p.vy=0;p.vx=0;p.vz=0;p.grounded=true;p.yaw=Math.PI;p.pitch=-.05;}
export function stepPlayer(p,input,dt,surfaces){
 const old={...p.pos};let dx=input.x||0,dz=input.z||0;const length=Math.hypot(dx,dz);if(length>1){dx/=length;dz/=length;}
 const speed=input.sprint?6.2:3.5;const sy=Math.sin(p.yaw),cy=Math.cos(p.yaw);
 /* 起步、停下有一点加减速，不再瞬间到全速（走路不那么僵） */const tvx=(cy*dx-sy*dz)*speed,tvz=(-sy*dx-cy*dz)*speed,acc=1-Math.exp(-dt*(length>.01?9:12));p.vx=(p.vx||0)+(tvx-(p.vx||0))*acc;p.vz=(p.vz||0)+(tvz-(p.vz||0))*acc;if(Math.hypot(p.vx,p.vz)<.03&&length<.01){p.vx=0;p.vz=0;}
 let nx=p.pos.x+p.vx*dt,nz=p.pos.z+p.vz*dt;
 for(const o of obstacles)if(p.pos.y<o.h&&inside(o,nx,nz,.28)&&!inside(o,old.x,old.z,.28)){/* MVP：已在障碍内时允许走出 */
  // MVP：沿障碍边缘切向滑动，避免斜着贴墙卡死
  const mx=nx-old.x,mz=nz-old.z;let ux=(old.x-o.x)/((o.rx+.28)**2),uz=(old.z-o.z)/((o.rz+.28)**2);const ul=Math.hypot(ux,uz)||1;ux/=ul;uz/=ul;const dot=mx*ux+mz*uz;const tx=old.x+mx-ux*Math.min(0,dot),tz=old.z+mz-uz*Math.min(0,dot);
  if(!inside(o,tx,tz,.28)){nx=tx;nz=tz;}else if(!inside(o,old.x,nz,.28))nx=old.x;else if(!inside(o,nx,old.z,.28))nz=old.z;else {nx=old.x;nz=old.z;}
 }
 p.pos.x=nx;p.pos.z=nz;
 if(p.grounded){const s=surfaceAt(surfaces,nx,nz,p.pos.y+.42);if(s&&Math.abs(s.h-p.pos.y)<.65)p.pos.y=s.h;else p.grounded=false;}
 if(input.jump&&p.grounded){p.vy=10.0;p.grounded=false;p.jumps++;}
 if(!p.grounded){p.vy-=19.5*dt;const previousY=p.pos.y;p.pos.y+=p.vy*dt;
  if(p.vy<=0){const s=surfaceAt(surfaces,nx,nz,previousY+.12);if(s&&p.pos.y<=s.h){p.pos.y=s.h;p.vy=0;p.grounded=true;}}
 }
 if(Math.hypot(nx-old.x,nz-old.z)>.001)p.steps++;
 let entered=-1,pick=-1;for(let i=0;i<zones.length;i++)if(p.grounded&&Math.abs(p.pos.y-zones[i].h)<3&&inside(zones[i],nx,nz)&&(pick<0||zones[i].rx*zones[i].rz<zones[pick].rx*zones[pick].rz))pick=i;/* 范围重叠时以最小的检查点为准 */if(pick>=0){if(!p.visited.has(pick))entered=pick;p.visited.add(pick);p.checkpoint=pick;}
 return {fell:p.pos.y<-32,entered};
}
