(() => {
  'use strict';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.documentElement.classList.add('js');
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    reveals.forEach(element => observer.observe(element));
  } else reveals.forEach(element => element.classList.add('is-visible'));

  const progress = document.querySelector('.reading-progress');
  const navLinks = [...document.querySelectorAll('.nav-links a')];
  const sections = [...document.querySelectorAll('main > section[id]')];
  let scrollPending = false;
  function updateScroll() {
    const height = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${height > 0 ? scrollY / height : 0})`;
    let current = '';
    sections.forEach(section => { if (section.getBoundingClientRect().top < innerHeight * .4) current = section.id; });
    navLinks.forEach(link => {
      if (link.hash === `#${current}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    scrollPending = false;
  }
  addEventListener('scroll', () => { if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateScroll); } }, { passive: true });
  addEventListener('resize', updateScroll);
  updateScroll();

  // Native details retain keyboard support and work without JavaScript.
  // Animate their measured height without interrupting rapid toggles.
  document.querySelectorAll('details').forEach(details => {
    const summary = details.querySelector('summary');
    let animation;
    let expanded = details.open;
    summary.addEventListener('click', event => {
      if (reducedMotion.matches || !details.animate) return;
      event.preventDefault();
      const start = details.getBoundingClientRect().height;
      expanded = !expanded;
      if (animation) animation.cancel();
      details.style.height = '';
      details.style.overflow = 'hidden';
      details.open = true;
      const end = expanded ? details.getBoundingClientRect().height : summary.getBoundingClientRect().height;
      animation = details.animate([{ height: `${start}px` }, { height: `${end}px` }], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
      animation.onfinish = () => {
        details.open = expanded;
        details.style.overflow = '';
        animation = null;
        updateScroll();
      };
    });
    details.addEventListener('toggle', () => { if (!animation) expanded = details.open; });
  });

  const canvas = document.querySelector('#field');
  const ctx = canvas.getContext('2d');
  const toggle = document.querySelector('#motion-toggle');
  let paused = reducedMotion.matches;
  let visible = true;
  let frame = 0;
  let previous = 0;
  let time = 0;
  let width = 0, height = 0;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const points = [];
  // Synthetic surface samples, not sensor recordings or project telemetry.
  function point(x, y, z, kind = 'arm') {
    const jitter = Math.sin(points.length * 127.1 + 31.7) * .004;
    points.push({x:x+jitter, y:y+jitter*.6, z:z-jitter, kind});
  }
  function cylinder(a, b, radius, kind = 'arm', rings = 18, samples = 30) {
    const direction = b.map((v,i)=>v-a[i]);
    const length = Math.hypot(...direction);
    const n = direction.map(v=>v/length);
    const ref = Math.abs(n[1])<.9 ? [0,1,0] : [1,0,0];
    const cross = (u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    let u = cross(n,ref);
    const magnitude = Math.hypot(...u);
    u=u.map(v=>v/magnitude);
    const v=cross(n,u);
    for(let row=0;row<=rings;row++) for(let col=0;col<samples;col++) {
      const angle=col/samples*Math.PI*2;
      point(...a.map((value,axis)=>value+direction[axis]*row/rings+radius*(u[axis]*Math.cos(angle)+v[axis]*Math.sin(angle))),kind);
    }
    for(const end of [a,b]) for(let r=0;r<4;r++) for(let col=0;col<samples;col++) {
      const angle=col/samples*Math.PI*2;
      point(...end.map((value,axis)=>value+radius*r/4*(u[axis]*Math.cos(angle)+v[axis]*Math.sin(angle))),kind);
    }
  }
  function box(center,size,kind) {
    for(let axis=0;axis<3;axis++) for(const side of [-1,1]) {
      const u=(axis+1)%3,v=(axis+2)%3;
      const rows=Math.ceil(size[u]/.055),cols=Math.ceil(size[v]/.055);
      for(let row=0;row<=rows;row++) for(let col=0;col<=cols;col++) {
        const p=[...center];
        p[axis]+=side*size[axis]/2;p[u]+=(row/rows-.5)*size[u];p[v]+=(col/cols-.5)*size[v];
        point(...p,kind);
      }
    }
  }
  const shoulder=[-.85,.52,0],elbow=[-1.03,1.63,0],wrist=[.38,1.95,0],tool=[.87,1.38,0];
  cylinder([-.85,0,0],[-.85,.18,0],.36,'joint',5,38);
  cylinder([-.85,.18,0],shoulder,.20,'arm',9);
  cylinder(shoulder,elbow,.145,'arm',26);
  cylinder(elbow,wrist,.125,'arm',31);
  cylinder(wrist,tool,.095,'arm',17);
  for(const [joint,radius] of [[shoulder,.23],[elbow,.22],[wrist,.17]]) {
    cylinder([joint[0],joint[1],-.17],[joint[0],joint[1],.17],radius,'joint',8,34);
  }
  box([.87,1.30,0],[.32,.15,.22],'joint');
  box([.72,1.13,0],[.065,.25,.10],'arm');
  box([1.02,1.13,0],[.065,.25,.10],'arm');
  box([.77,1.015,0],[.12,.055,.10],'arm');
  box([.97,1.015,0],[.12,.055,.10],'arm');
  box([.87,.20,0],[.38,.40,.38],'target');
  for(let x=-1.8;x<=1.8;x+=.105) for(let z=-1;z<=1;z+=.105) point(x,-.025,z,'table');
  const colors={arm:[130,163,255],joint:[172,207,255],target:[115,224,203],table:[80,110,158]};
  function render() {
    if(!ctx) return;
    ctx.clearRect(0,0,width,height);
    const scale=Math.min(width/5.2,(height-145)/3.6);
    const yaw=-.36+Math.sin(time*.00014)*.055+pointer.x*.65;
    const pitch=.31+pointer.y*.22;
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    function project(x,y,z) {
      const rx=x*cy+z*sy,rz=-x*sy+z*cy;
      const depth=rz*cp-(y-.85)*sp,perspective=7/(7+depth);
      return {x:width*.5+rx*scale*perspective,y:height*.43-((y-.85)*cp+rz*sp)*scale*perspective,depth};
    }
    function line(a,b,color,dashed=false) {
      const start=project(...a),end=project(...b);
      ctx.strokeStyle=color;ctx.lineWidth=.7;ctx.setLineDash(dashed?[3,5]:[]);
      ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.setLineDash([]);
    }
    // Coordinate grid and workbench edge ground the arm in a shared frame.
    for(let x=-1.8;x<=1.81;x+=.45) line([x,-.035,-1],[x,-.035,1],'#637ba72c');
    for(let z=-1;z<=1.01;z+=.4) line([-1.8,-.035,z],[1.8,-.035,z],'#637ba72c');
    for(const z of [-1,1]) line([-1.8,-.035,z],[1.8,-.035,z],'#789ac459');
    for(const x of [-1.8,1.8]) line([x,-.035,-1],[x,-.035,1],'#789ac459');
    // The seven-second scan brightens returns without hiding the scene.
    const sweep=-1.8+((time/7000+.32)%1)*3.6;
    const plane=[[sweep,0,-1],[sweep,2.35,-1],[sweep,2.35,1],[sweep,0,1]].map(p=>project(...p));
    ctx.fillStyle='#86bdff06';ctx.strokeStyle='#92bdff22';ctx.lineWidth=.7;
    ctx.beginPath();plane.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.stroke();
    line([sweep,0,-1],[sweep,0,1],'#b5d9ffa0');
    const projected=points.map(p=>({...project(p.x,p.y,p.z),p})).sort((a,b)=>b.depth-a.depth);
    projected.forEach(({x,y,depth,p})=>{
      const scan=Math.max(0,1-Math.abs(p.x-sweep)/.24);
      const front=Math.max(.2,Math.min(1,.65-depth*.22));
      const alpha=p.kind==='table'?.18+scan*.5:.30+front*.42+scan*.28;
      const [r,g,b]=colors[p.kind];
      ctx.fillStyle=`rgba(${Math.round(r+(255-r)*scan*.7)},${Math.round(g+(255-g)*scan*.7)},${b},${alpha})`;
      const size=p.kind==='table'?.85:(width<400?.8:1)+scan*.45;
      ctx.fillRect(x-size/2,y-size/2,size,size);
    });
    // Target bounds and dashed tool axis illustrate the perception task.
    const lo=[.59,.015,-.28],hi=[1.15,.50,.28];
    for(let axis=0;axis<3;axis++) {
      const u=(axis+1)%3,v=(axis+2)%3;
      for(const su of [0,1]) for(const sv of [0,1]) {
        const a=[...lo],b=[...lo];
        a[u]=b[u]=su?hi[u]:lo[u];a[v]=b[v]=sv?hi[v]:lo[v];b[axis]=hi[axis];
        line(a,b,'#80dbc36b');
      }
    }
    line([.87,.52,0],[.87,.97,0],'#80dbc377',true);
    function callout(anchor,text,dx,dy,color) {
      const p=project(...anchor);
      ctx.font=`${width<400?9:10}px "IBM Plex Mono",monospace`;
      ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=.6;
      const endX=p.x+dx,endY=p.y+dy;
      ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(endX,endY);ctx.lineTo(endX+(dx<0?-12:12),endY);ctx.stroke();
      ctx.textAlign=dx<0?'right':'left';ctx.fillText(text,endX+(dx<0?-16:16),endY+3);
    }
    callout(elbow,'ARM / 01',-scale*.14,-scale*.36,'#b8caf0');
    callout([1.15,.25,.28],'TARGET',scale*.15,-scale*.34,'#9de2d1');
    const origin=[width-49,height-98];
    ctx.font='9px "IBM Plex Mono",monospace';ctx.textAlign='center';
    for(const [dx,dy,label,color] of [[21,7,'X','#a1b8f3'],[-15,12,'Z','#8292b5'],[0,-23,'Y','#8bd8c4']]) {
      ctx.strokeStyle=color;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(...origin);ctx.lineTo(origin[0]+dx,origin[1]+dy);ctx.stroke();ctx.fillText(label,origin[0]+dx*1.4,origin[1]+dy*1.4+3);
    }
  }
  function tick(now) {
    if (paused || !visible || document.hidden) { frame = 0; previous = 0; return; }
    if (previous) time += Math.min(now - previous, 50);
    previous = now;
    pointer.x += (pointer.targetX - pointer.x) * .045;
    pointer.y += (pointer.targetY - pointer.y) * .045;
    render();
    frame = requestAnimationFrame(tick);
  }
  function start() { if (!frame && !paused && visible && !document.hidden) frame = requestAnimationFrame(tick); }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    if (ctx) ctx.setTransform(scale, 0, 0, scale, 0, 0);
    render();
  }
  function updateMotion() {
    document.body.classList.toggle('is-paused', paused);
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Play animation' : 'Pause animation');
    toggle.innerHTML = paused ? 'Play <span aria-hidden="true">▷</span>' : 'Pause <span aria-hidden="true">Ⅱ</span>';
    start();
  }
  toggle.addEventListener('click', () => { paused = !paused; updateMotion(); });
  reducedMotion.addEventListener('change', () => { paused = reducedMotion.matches; updateMotion(); render(); });
  canvas.addEventListener('pointermove', event => {
    if (paused || event.pointerType === 'touch') return;
    const rect = canvas.getBoundingClientRect();
    pointer.targetX = (event.clientX - rect.left) / width - .5;
    pointer.targetY = (event.clientY - rect.top) / height - .5;
  });
  canvas.addEventListener('pointerleave', () => { pointer.targetX = 0; pointer.targetY = 0; });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  else addEventListener('resize', resize);
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => { visible = entries[0].isIntersecting; start(); }).observe(canvas);
  document.addEventListener('visibilitychange', start);
  resize(); updateMotion();
})();
