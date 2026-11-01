export const SCENE_ID='cloud-awakening-level-one-reference-layout';
export function validateSceneLayout(data,keys){
 if(!data||![1,2].includes(data.version)||data.scene!==SCENE_ID||!data.changes||typeof data.changes!=='object'||Array.isArray(data.changes))throw Error('这不是本场景的布局文件');
 for(const [key,s] of Object.entries(data.changes)){
  if(!s||typeof s!=='object')throw Error('布局元素格式无效');
  if(s.asset){if(data.version!==2||!/^added:[a-z0-9]+:[0-9]+$/.test(key)||!keys.has(s.asset)||!keys.has(s.parent)||!s.parent.startsWith('island:'))throw Error('新增素材来源或岛屿无效');}else if(!keys.has(key))throw Error('布局包含当前版本不存在的元素');
  for(const [k,n] of [['p',3],['q',4],['s',3]])if(!Array.isArray(s[k])||s[k].length!==n||s[k].some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>5000))throw Error('布局数值无效');
  if(s.s.some(v=>v<=0)||Math.abs(Math.hypot(...s.q)-1)>.01)throw Error('布局缩放或旋转无效');
  if(typeof s.v!=='boolean')throw Error('布局可见性无效');
 }
 return data.changes;
}
