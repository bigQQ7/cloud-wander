import * as T from 'three';
export function createSwing({audio,anchor,player,hero,getMode,lock,unlock,toast}){
 // The treehouse is one merged mesh; attach the interaction anchor to its existing seat.
 const seat=new T.Object3D();seat.name='原树秋千座位交互点';anchor.updateWorldMatrix(true,false);seat.position.copy(anchor.worldToLocal(new T.Vector3(7.5,4.15,-7.0)));anchor.add(seat);
 let seated=false,near=false,returnPos;const point=new T.Vector3(),q=new T.Quaternion();
 const button=document.createElement('button');button.textContent='E 坐上秋千';button.style.cssText='position:fixed;bottom:110px;left:50%;transform:translateX(-50%);z-index:45;padding:12px 22px;border:0;border-radius:24px;background:#fff6df;display:none';document.body.append(button);
 function use(){if(seated){audio?.event('leave');seated=false;player.pos={...returnPos};player.vy=0;player.grounded=true;hero.clearInteraction();unlock();toast('已离开秋千');}else if(near){audio?.event('seat');returnPos={...player.pos};seated=true;lock();anchor.getWorldQuaternion(q);hero.setInteraction('Seated',new T.Euler().setFromQuaternion(q).y);toast('轻轻荡秋千 · E 或空格离开');}}
 button.onclick=use;
 return {handleKey(e){if(e.repeat)return seated;if((seated&&['KeyE','Space','Escape'].includes(e.code))||(!seated&&near&&e.code==='KeyE')){e.preventDefault();use();return true;}return seated;},update(dt,time){seat.getWorldPosition(point);near=getMode()==='walk'&&player.grounded&&Math.hypot(player.pos.x-point.x,player.pos.z-point.z)<2.3&&Math.abs(player.pos.y-point.y)<2;button.style.display=seated||near?'block':'none';button.textContent=seated?'E / 空格 离开秋千':'E 坐上秋千';if(seated){player.pos={x:point.x,y:point.y-.48,z:point.z};player.vy=0;player.grounded=true;}}};
}
