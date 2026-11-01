export const CHAPTER_KEY='cloud-awakening-chapter-v1';
// MVP: 铃片收集与修风铃已删除，树屋只需摇响风铃一次。
export function normalizeChapter(raw){const r=raw&&typeof raw==='object'?raw:{};const tree=r.tree===true;return{version:1,gate:r.gate===true,pieces:[true,true,true],repaired:tree,tree,complete:r.complete===true&&r.gate===true&&tree,checkpoint:Number.isInteger(r.checkpoint)&&r.checkpoint>=0&&r.checkpoint<4?r.checkpoint:0,visited:[...new Set([0,...(Array.isArray(r.visited)?r.visited.filter(i=>Number.isInteger(i)&&i>=0&&i<4):[])])]};}
export function advanceChapter(state,event,wind=false){const s=normalizeChapter(state);if(event==='gate')s.gate=true;if(event==='tree'&&wind){s.tree=true;s.repaired=true;}if(event==='finish'&&s.gate&&s.tree&&wind)s.complete=true;return s;}
export function chapterObjective(s,wind){if(s.complete)return'约定已找回 · 可以继续漫游，或在记忆册中重温';if(!s.gate)return'苏醒草坡 · 靠近石门，触碰第一束记忆';if(!wind)return'风车高台 · 轻抚风纹，唤醒风车';if(!s.tree)return'回声树屋 · 走到树屋前的风铃旁，摇响它';return'风之塔 · 乘风登顶，找回最后的约定';}
