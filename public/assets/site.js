// Mobile "Pages" button, a "Copy link" button, and the press-depth tilt on buttons.
(function () {
  var body = document.body;
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Mobile: the "Pages" button opens and closes the sidebar.
  var t = document.querySelector('.menu-toggle');
  if (t) {
    t.addEventListener('click', function () {
      var open = body.classList.toggle('side-open');
      t.setAttribute('aria-expanded', open ? 'true' : 'false');
      t.textContent = open ? 'Close' : 'Pages';
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && body.classList.contains('side-open')) t.click(); });
  }

  // Copy link, placed next to the breadcrumbs.
  var crumbs = document.querySelector('.sheet nav.eyebrow');
  if (crumbs && navigator.clipboard) {
    var c = document.createElement('button');
    c.type = 'button'; c.className = 'copy-btn'; c.textContent = 'Copy link';
    c.addEventListener('click', function () {
      navigator.clipboard.writeText(location.href).then(function () {
        c.textContent = '✓ Copied'; c.classList.add('done');
        setTimeout(function () { c.textContent = 'Copy link'; c.classList.remove('done'); }, 1600);
      }, function () {});
    });
    crumbs.appendChild(c);
  }

  if (still) return;

  // Buttons tilt toward the pointer (press-depth look).
  var TILT = 7, SEL = '.btn, .menu > a, .menu > details > summary, .nav button, .copy-btn';
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var b = e.target.closest && e.target.closest(SEL);
    if (!b || b.disabled) return;
    var r = b.getBoundingClientRect();
    b.style.setProperty('--ry', ((e.clientX - r.left) / r.width - 0.5) * TILT + 'deg');
    b.style.setProperty('--rx', (0.5 - (e.clientY - r.top) / r.height) * TILT + 'deg');
  }, { passive: true });
  document.addEventListener('pointerout', function (e) {
    var b = e.target.closest && e.target.closest(SEL);
    if (b && !b.contains(e.relatedTarget)) { b.style.removeProperty('--rx'); b.style.removeProperty('--ry'); }
  });
})();
