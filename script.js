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
  // Fibonacci distribution forms a deterministic, evenly spaced perception field.
  for (let i = 0; i < 1400; i++) {
    const y = 1 - (i / 1399) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = Math.PI * (3 - Math.sqrt(5)) * i;
    points.push({ x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius, i });
  }
  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const radius = Math.min(width * .34, height * .34);
    const cx = width * .5, cy = height * .46;
    const rotation = time * .00009 + pointer.x * .3;
    const tilt = -.27 + pointer.y * .22;
    const cr = Math.cos(rotation), sr = Math.sin(rotation), ct = Math.cos(tilt), st = Math.sin(tilt);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-.35);
    ctx.strokeStyle = '#718abd24';
    ctx.lineWidth = .7;
    ctx.beginPath();ctx.ellipse(0, 0, radius * 1.36, radius * .36, 0, 0, Math.PI * 2);ctx.stroke();
    ctx.beginPath();ctx.ellipse(0, 0, radius * 1.48, radius * .4, 0, .3, 2.9);ctx.stroke();
    ctx.restore();
    const projected = points.map(point => {
      const ripple = 1 + .042 * Math.sin(point.y * 8 + time * .0007);
      const x = point.x * cr - point.z * sr;
      const rz = point.x * sr + point.z * cr;
      const y = point.y * ct - rz * st;
      const z = point.y * st + rz * ct;
      const perspective = 3.6 / (3.6 - z);
      return { x: cx + x * radius * perspective * ripple, y: cy + y * radius * perspective * ripple, z, i: point.i };
    }).sort((a, b) => a.z - b.z);
    projected.forEach(point => {
      const depth = (point.z + 1) / 2;
      ctx.fillStyle = `rgba(${Math.round(93 + depth * 82)},${Math.round(129 + depth * 66)},255,${.12 + depth * .8})`;
      ctx.beginPath();ctx.arc(point.x, point.y, .6 + depth * .75, 0, Math.PI * 2);ctx.fill();
    });
    ctx.strokeStyle = '#698cd129';
    ctx.lineWidth = .6;
    for (let i = 0; i < projected.length; i += 17) {
      const a = projected[i];
      if (a.z < .15) continue;
      const b = projected[(i + 19) % projected.length];
      if (Math.hypot(a.x - b.x, a.y - b.y) < radius * .28) {
        ctx.beginPath();ctx.moveTo(a.x, a.y);ctx.lineTo(b.x, b.y);ctx.stroke();
      }
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
