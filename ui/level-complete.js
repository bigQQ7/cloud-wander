(() => {
 let opened=false, readyAt=0, destination='', moving=false;
 function proceed(){if(!opened||moving||performance.now()<readyAt)return;moving=true;location.href=destination;}
 window.cloudShowLevelComplete=function(chapter){
  if(opened)return;opened=true;readyAt=performance.now()+700;
  destination=chapter<3?'../chapter'+(chapter+1)+'/index.html':'../../index.html';
  try{localStorage.setItem('cloud-wander-highest-unlocked',String(Math.min(3,chapter+1)))}catch{}
  document.exitPointerLock?.();
  const style=document.createElement('style');style.textContent='#level-complete{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#10213a99;backdrop-filter:blur(7px);color:white;font-family:system-ui;text-align:center}#level-complete article{padding:40px 52px;border-radius:28px;background:#23364bea;border:1px solid #ffffff44;box-shadow:0 20px 80px #0004}#level-complete h2{font-size:30px;margin:8px 0 24px}#level-complete button{font:600 19px system-ui;padding:15px 34px;border:0;border-radius:16px;background:#fff0bf;color:#243c54;cursor:pointer}#level-complete p{font-size:15px;opacity:.8;margin-top:20px}';document.head.append(style);
  const overlay=document.createElement('section');overlay.id='level-complete';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','level-complete-title');
  overlay.innerHTML='<article><h2 id="level-complete-title">'+(chapter<3?'本关任务已完成':'全部关卡已完成')+'</h2><button type="button">'+(chapter<3?'进入下一关 →':'返回关卡选择')+'</button><p>'+(chapter<3?'按任意键进入下一关':'按任意键返回关卡选择')+'</p></article>';
  document.body.append(overlay);overlay.querySelector('button').onclick=proceed;
 };
 window.addEventListener('keydown',e=>{if(!opened)return;e.preventDefault();e.stopImmediatePropagation();if(!e.repeat&&!e.isComposing)proceed();},true);
})();
