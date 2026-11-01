// 关卡载入：用玻璃水瓶动画（ui/loading/）替换各关原来的载入画面，进度来自各关真实的加载进度
(function(){
 const level=Number(document.currentScript.dataset.level)||1;
 const read={
  1:()=>{const ready=document.querySelector('#world')?.dataset.ready==='true';return {p:ready?100:parseFloat(document.querySelector('#percent')?.textContent)||0,ready};},
  2:()=>{const ready=!!window.sceneState?.ready;const m=(document.querySelector('#progress')?.textContent||'').match(/(\d+)\s*\/\s*(\d+)/);return {p:ready?100:m?m[1]/m[2]*95:0,ready};},
  3:()=>({p:window.__levelProgress||0,ready:!!window.__levelReady})
 };
 function start(tries=0){
  if(!window.showLoading||(!window.createGlassRenderer&&tries<30))return setTimeout(()=>start(tries+1),50);
  const loader=window.showLoading(level,()=>{document.documentElement.classList.remove('level-loading');if(level===1)document.querySelector('#start')?.click();if(level===2)document.querySelector('#game-start')?.click();/* 第一关：载入完直接进入场景 */},{manual:true});
  const iv=setInterval(()=>{let r;try{r=read[level]();}catch{r={p:0,ready:false};}loader.setProgress(r.p);if(r.ready){clearInterval(iv);loader.complete();}},120);
 }
 if(document.readyState==='loading')addEventListener('DOMContentLoaded',()=>start());else start();
})();
