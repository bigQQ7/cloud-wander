// 模型摆放修正（2026-10-29 检查后）：穿插、比例、伸出平台，以及中央花园东侧补花。
export function applyFixes({T,world,put}){
  const find=(id,x,z,r=.8)=>world.children.find(o=>o.userData.assetId===id&&Math.hypot(o.position.x-x,o.position.z-z)<r);
  const log=[];
  // 1 喷泉里的南瓜灯 → 移到横版栈桥入口旁，标记入口
  const lampF=find(33,8,0);if(lampF){lampF.position.set(8.05,lampF.position.y,-2.35);log.push('喷泉里的灯移到栈桥入口');}
  // 2 南门叠在一起的两盏灯：去掉多出来的那盏
  const lampDup=find(33,-3.32,7.28,.2);if(lampDup){world.remove(lampDup);log.push('删除南门重复的灯');}
  // 3 木箱移出凉亭 → 庭院西北角，和木货箱放一起
  const chest=find(28,-20,-14.2);if(chest){chest.position.set(-23.4,chest.position.y,-9.1);chest.rotation.y=Math.PI*.75;log.push('木箱移出凉亭');}
  // 4 后墙：拱门缩小内收，挂画缩小贴墙
  const arch=find(12,-24,-14);if(arch){arch.scale.multiplyScalar(.85);arch.position.x=-22.62;log.push('帘幕拱门缩小内收');}
  const painting=find(18,-24,-16);if(painting){painting.scale.multiplyScalar(.6);painting.position.set(-23,painting.position.y,-15.37);log.push('挂画缩小贴墙');}
  // 5 出口两座小塔：缩小并收进平台
  for(const sx of [-1,1]){const t=find(0,3*sx,-24);if(t){t.scale.multiplyScalar(.65);t.position.set(3.2*sx,t.position.y,-21.5);log.push('出口小塔收进平台');}}
  // 6 金骨头缩到玩具大小（约 0.7 米）
  const bone=find(9,-22,-11);if(bone){bone.scale.multiplyScalar(.3);log.push('金骨头缩小');}

  // 9 中央花园东侧补花：东侧边缘大部分被两座栈桥入口、喷泉和灯占着，只在灯和喷泉之间、栈桥入口两侧补小花丛
  for(const [id,x,z,sz] of [[32,7.75,-1.5,1.3],[35,8.45,-.95,1.0]]){put(id,x,.02,z,sz,Math.atan2(z,x));}
  log.push('东侧补了 2 处小花丛');
  // ---- 骨头庭院整理（伙伴的小房间）：后方正中拱门 + 挂画，中间地毯和金骨头，左侧木箱，右侧书架
  {
    const C={x:-22,z:-12};const dist=o=>Math.hypot(o.position.x-C.x,o.position.z-C.z);const ang=o=>Math.atan2(o.position.z-C.z,o.position.x-C.x);
    {const o=find(22,-18.5,-14.2);if(o)world.remove(o);}
    const crate=find(37,-25,-10);if(crate){crate.position.set(-24.6,crate.position.y,-11.15);crate.rotation.y=.35;crate.scale.multiplyScalar(.72);}// 棕色木箱放回地毯西侧，作为剧情木箱
    const arch2=find(12,-22.62,-14,1);if(arch2)arch2.position.set(-22,arch2.position.y,-14.6);
    const paint2=find(18,-23,-15.37,1);if(paint2){paint2.scale.multiplyScalar(7/6);paint2.position.set(-22,paint2.position.y,-15.25);paint2.rotation.y=-Math.PI/2;}// 正面朝向房间（之前背板朝外）
    const shelf=find(10,-20,-16);if(shelf){shelf.rotation.y=Math.PI;shelf.position.set(-17.4,shelf.position.y,-13.9);}
    const lampW=find(33,-27.3,-12,1);if(lampW)lampW.position.set(-24.7,lampW.position.y,-8.0);
    let removed=0;
    const flora=()=>world.children.filter(o=>[30,32,34,35].includes(o.userData.assetId)&&o.position.y>1.2&&o.position.y<3&&dist(o)<6.6);
    for(const o of flora())if(dist(o)<4.6){world.remove(o);removed++;}
    flora().sort((a,b)=>ang(a)-ang(b)).forEach((o,i)=>{if(i%2){world.remove(o);removed++;}});
    for(const o of world.children.filter(o=>o.userData.assetId===36&&o.position.y>0&&dist(o)<7.5)){const a=ang(o)*180/Math.PI;if(!(Math.abs(a+135)<28||Math.abs(a+45)<28)){world.remove(o);removed++;}}
    log.push('庭院整理：移走花架和木货箱，拱门与挂画居中，书架靠右侧，花草减少 '+removed+' 株');
  }
  return log;
}
