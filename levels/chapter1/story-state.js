export const STORY_KEY='cloud-awakening-story-v1';
export function normalizeStory(value){
 const valid=Boolean(value&&value.version===1);
 const activated=valid&&value.windmillActivated===true,collected=activated&&value.windMemoryCollected===true;
 return{version:1,windmillActivated:activated,windMemoryCollected:collected,windMemoryViewed:collected&&value.windMemoryViewed===true};
}
export function advanceStory(state,event){
 const next=normalizeStory(state);
 if(event==='activate')next.windmillActivated=true;
 if(event==='collect'&&next.windmillActivated)next.windMemoryCollected=true;
 if(event==='viewed'&&next.windMemoryCollected)next.windMemoryViewed=true;
 return next;
}
export function canUseWind(p,at,mode,visible=true){return visible&&mode==='walk'&&p.grounded&&Math.abs(p.pos.y-at.y)<1.5&&Math.hypot(p.pos.x-at.x,p.pos.z-at.z)<=2.5;}
