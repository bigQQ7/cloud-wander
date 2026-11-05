import {configureGLTFLoader} from '../shared/web-assets.js?v=3';
// 第二章真实角色模型 + 动作系统（适配自第一章 hero.js）
// 依赖 assets/hero.glb（hero-v31-round 圆润版，含 Idle/Walk/Run/Jump/Fall 动作）
import {createLocomotionLayer} from './hero-locomotion.js?v=1793364298';

export async function createHero(T, scene){
  const {GLTFLoader} = await import('./vendor/GLTFLoader.js?v=1793364298');
  const loader = configureGLTFLoader(new GLTFLoader());
  const gltf = await loader.loadAsync('./assets/hero.glb?v=1793364298');

  const resonance=await loader.loadAsync('../shared/resonance.glb?v=1');gltf.animations.push(...resonance.animations.map(c=>{c.name='Resonance';return c;}));
 const spaceClips=await Promise.all(['Jump','Glide'].map(name=>loader.loadAsync('../shared/space-'+name+'.glb?v=45').then(g=>{g.animations[0].name=name;g.animations[0].tracks=g.animations[0].tracks.filter(t=>!t.name.startsWith('rig.'));return g.animations[0];})));gltf.animations=gltf.animations.filter(c=>!['Jump','Glide','Parachute','Parasail','Umbrella'].some(n=>c.name===n||c.name.endsWith('|'+n)||c.name.endsWith('_'+n)));gltf.animations.push(...spaceClips);const landingAsset=await loader.loadAsync('../shared/landing35.glb?v=35');const landingClip=landingAsset.animations[0];landingClip.name='Landing';landingClip.tracks=landingClip.tracks.filter(t=>!t.name.startsWith('rig.'));gltf.animations=gltf.animations.filter(c=>c.name!=='Landing');gltf.animations.push(landingClip);
  // 材质优化
  gltf.scene.traverse(o => {
    if(!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    o.frustumCulled = false;
    for(const m of Array.isArray(o.material) ? o.material : [o.material]){
      m.roughness = Math.max(.65, m.roughness);
      m.metalness = 0;
    }
  });

  // Fall 动画去掉根骨骼位移（物理自己管世界位移）
  const rootBones = [];
  gltf.scene.traverse(o => { if(o.isBone && !o.parent?.isBone) rootBones.push(o); });
  const pelvis = rootBones.find(o => o.name.replace(/[._]/g,'') === 'rootx');
  const fall = gltf.animations.find(c => c.name === 'Fall');
  if(fall && pelvis){
    const source = fall.tracks.find(t => t.name === pelvis.name+'.position');
    if(source){ const deltas = source.values.slice();
      for(const bone of rootBones){ const track = fall.tracks.find(t => t.name === bone.name+'.position');
        if(track && track.values.length === deltas.length)
          for(let i=0;i<track.values.length;i++) track.values[i] -= deltas[i]-deltas[i%3]; } }
  }

  // Run = Walk 压缩到 0.67 倍时长（脚不滑）
  const walkClip = gltf.animations.find(c => c.name === 'Walk');
  if(walkClip){
    const runClip = walkClip.clone(); runClip.name = 'Run';
    for(const track of runClip.tracks) track.scale(.67);
    runClip.resetDuration();
    gltf.animations = gltf.animations.filter(c => c.name !== 'Run');
    gltf.animations.push(runClip);
  }

  const root = new T.Group(); root.name = '主角';
  root.add(gltf.scene); scene.add(root);

  // 脚底偏移：加载后量 bbox，每帧加到 root.position.y
  // （不能直接改 gltf.scene.position.y，骨骼 mixer 每帧会覆盖它）
  scene.updateMatrixWorld(true);
  const _bbox = new T.Box3().setFromObject(gltf.scene);
  const _h = _bbox.max.y - _bbox.min.y;
  const yFoot = _h > 0.1 ? -_bbox.min.y : 0.35;

const parachute=(await loader.loadAsync('../shared/parachute.glb?v=43')).scene;parachute.visible=false;root.add(parachute);
  const mixer = new T.AnimationMixer(gltf.scene);
  // Parachute / Glide / Parasail / Umbrella 都当降落伞动作处理
  const CLIP_NAMES = ['Landing','Resonance','Idle','Walk','Run','Jump','Fall','Parachute','Glide','Parasail','Umbrella'];
  const actions = {};
  for(const clip of gltf.animations){
    const name = CLIP_NAMES.find(n => clip.name===n || clip.name.endsWith('|'+n) || clip.name.endsWith('_'+n));
    if(name) actions[name] = mixer.clipAction(clip);
  }
  // 第二章 clip 名扩展（加 SitDown/Seated）
  const CLIP_NAMES_EXT = ['SitDown','Seated'];
  for(const clip of gltf.animations){
    const name = CLIP_NAMES_EXT.find(n => clip.name===n || clip.name.endsWith('|'+n) || clip.name.endsWith('_'+n));
    if(name && !actions[name]) actions[name] = mixer.clipAction(clip);
  }
  // 统一别名：任何降落伞类 clip 都映射到 'Glide' key
  for(const alias of ['Parachute','Parasail','Umbrella']){
    if(actions[alias] && !actions['Glide']) actions['Glide'] = actions[alias];
  }
  // Seated 别名
  if(actions['SitDown'] && !actions['Seated']) actions['Seated'] = actions['SitDown'];

  const locomotion = createLocomotionLayer(gltf.scene, root);

  let current = null, heading = 0, previous = null, inJump = false, lastJump = 0, airTime = 0, snap = true;

  function play(name){
    if(name === current || !actions[name]) return;
    const next = actions[name], old = actions[current];
    const gaitSwitch = ['Walk','Run'].includes(current) && ['Walk','Run'].includes(name);
    const gaitPhase = gaitSwitch ? old.time/old.getClip().duration : 0;
    next.reset(); next.paused = false;
    next.setEffectiveTimeScale(1).setEffectiveWeight(1);
    if(name==='Jump')next.setEffectiveTimeScale(next.getClip().duration/(2*9.8/18));
    if(['Landing','Resonance','Jump','Fall'].includes(name)){ next.setLoop(T.LoopOnce,1); next.clampWhenFinished = true; }
    else next.setLoop(T.LoopRepeat, Infinity);  // Glide 也循环
    if(gaitSwitch) next.time = gaitPhase * next.getClip().duration;
    next.play();
    if(name==='Fall'||name==='Jump'){ for(const [k,a] of Object.entries(actions)) if(k!==name) a.stop(); }
    else if(current) actions[current].crossFadeTo(next, .22, false);
    current = name;
  }
  let lastLandingGrounded=true,landingPrepared=false,landingLeft=0;let resonanceLeft=0;addEventListener('keydown',e=>{if(e.code==='KeyQ'&&!e.repeat&&resonanceLeft<=0&&root.visible)resonanceLeft=actions.Resonance?.getClip().duration||0;});play('Idle');

  return {
    root,
    // 每帧调用：pos={x,y,z}, grounded, jumps, vy, gliding, speed（水平速度 m/s）
    update(pos, dt, {grounded, jumps, vy, gliding, speed, mode, inLane, facing, landingETA=Infinity}){
      root.visible = true;
      root.position.set(pos.x, pos.y + yFoot, pos.z);

      // 朝向
      if(facing !== undefined) heading = facing;
      else if(previous && speed > .12 && speed < 20){
        const dx = pos.x-previous.x, dz = pos.z-previous.z;
        if(Math.hypot(dx,dz) > .001) heading = Math.atan2(dx, dz);
      }
      previous = {x:pos.x, z:pos.z};
      root.rotation.y += (T.MathUtils.euclideanModulo(heading - root.rotation.y + Math.PI, Math.PI*2) - Math.PI) * (1-Math.exp(-dt*16));

      // 跳跃
      if(jumps !== lastJump){ lastJump = jumps; inJump = true; }
      if(grounded) inJump = false;

      if(lastLandingGrounded&&!grounded){landingPrepared=false;landingLeft=0;}
      if(!grounded&&vy<-.2&&landingETA<=.42&&!landingPrepared){landingPrepared=true;landingLeft=actions.Landing.getClip().duration;}
      if(!lastLandingGrounded&&grounded&&!landingPrepared)landingLeft=actions.Landing.getClip().duration;lastLandingGrounded=grounded;if(vy>0)landingLeft=0;landingLeft=Math.max(0,landingLeft-dt);
      // 动作选择
      let state;
      if(gliding && (actions['Glide'] || actions['Seated'])){ state = actions['Glide'] ? 'Glide' : 'Seated'; }
      else if(mode === 'slide' && actions['Seated']){ state = 'Seated'; }
      else if(!grounded){ state = inJump ? 'Jump' : 'Fall'; }
      else if(speed > 5) state = 'Run';
      else if(speed > .15) state = 'Walk';
      else state = 'Idle';

      if(landingLeft>0)state='Landing';
      resonanceLeft=Math.max(0,resonanceLeft-dt);if(resonanceLeft>0)state='Resonance';
      parachute.visible=state==='Glide';play(state);
      if(state==='Walk') actions.Walk?.setEffectiveTimeScale(T.MathUtils.clamp(speed/3.1,.65,1.65));
      if(state==='Run')  actions.Run?.setEffectiveTimeScale(T.MathUtils.clamp(speed/5.4,.85,1.5));

      locomotion.restore();
      mixer.update(dt);

      // Glide：手抓绳姿势保持，不叠加步伐 locomotion（已在 allowed 里排除）

      // Fall：悬浮循环帧，避免被 clamp 停在第一帧
      if(state==='Fall'){
        const a = actions.Fall;
        airTime += dt;
        const dur = a.getClip().duration, center = Math.min(.4, dur*.38), amp = Math.min(.15, dur*.14);
        a.time = center + amp * Math.sin(airTime * 3.4);
        a.paused = true; mixer.update(0);
      } else airTime = 0;

      locomotion.update(dt, state, actions[state], speed, grounded && (state==='Walk'||state==='Run'));
    },
    hide(){ root.visible = false; },
    show(){ root.visible = true; },
  };
}
