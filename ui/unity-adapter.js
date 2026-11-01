// Load after guide.js. Unity must implement Pause/Resume/RestartCheckpoint on CloudUIBridge.
import {createUISystem} from './system.js';
export function connectUnityUI(instance){
 const bridge=name=>instance.SendMessage('CloudUIBridge',name);
 const ui=createUISystem({chapter:3,position:()=>window.cloudGuidePosition||{x:0,y:0,z:0},project:()=>({x:innerWidth/2,y:innerHeight/2,visible:true}),canPause:()=>!!window.cloudGuidePosition,onPause:()=>bridge('Pause'),onResume:()=>bridge('Resume'),onRestart:()=>bridge('RestartCheckpoint')});
 window.CloudUnityUI={setCollected:n=>ui.syncCollection(Number(n)),registerInteraction:point=>ui.registerInteraction(point)};return ui;
}
