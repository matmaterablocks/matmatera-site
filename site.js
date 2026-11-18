// matmatera.com. Everything here is an enhancement: pages read fully without it.
(function () {
  'use strict';
  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  // Large view: step through the works on this page.
  var zooms = all('a.zoom');
  if (zooms.length && window.HTMLDialogElement && typeof document.createElement('dialog').showModal === 'function') {
    var dialog = el('dialog', 'view');
    dialog.setAttribute('aria-label', 'Large view');
    var inner = el('div', 'view-inner');
    // Previous and Next sit at the left and right edges of the stage, not of the picture,
    // so they stay in the same place from work to work.
    var main = el('div', 'view-main');
    var prev = el('button', 'view-step prev');
    var next = el('button', 'view-step next');
    var count = el('p', 'view-count grey');
    prev.setAttribute('aria-label', 'Previous');
    next.setAttribute('aria-label', 'Next');
    prev.innerHTML = '<svg viewBox="0 0 24 40" aria-hidden="true"><path d="M20 3L4 20l16 17"/></svg>';
    next.innerHTML = '<svg viewBox="0 0 24 40" aria-hidden="true"><path d="M4 3l16 17L4 37"/></svg>';
    var close = el('button', 'view-close');
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = '<svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="20"/><path d="M15 15l14 14M29 15L15 29"/></svg>';
    prev.type = next.type = close.type = 'button';
    var stage = el('div', 'view-stage');
    var image = el('img');
    var cap = el('div', 'view-cap');
    var text = el('p');
    var links = el('p', 'view-links');
    var inquire = el('a', '', 'Inquire about original');
    var buy = el('a', '', 'Buy a print');
    buy.rel = 'noopener';
    stage.appendChild(image);
    main.appendChild(stage); main.appendChild(prev); main.appendChild(next);
    links.appendChild(inquire);
    links.appendChild(buy);
    cap.appendChild(text); cap.appendChild(links); cap.appendChild(count);
    inner.appendChild(close); inner.appendChild(main); inner.appendChild(cap);
    dialog.appendChild(inner);
    document.body.appendChild(dialog);
    if (zooms.length < 2) { prev.hidden = true; next.hidden = true; count.hidden = true; }

    var at = 0;
    var opener = null;

    function captionText(a, cls, attr) {
      var fig = a.closest ? a.closest('figure') : null;
      var n = fig && fig.querySelector('.' + cls);
      var v = n ? n.textContent.replace(/\s+/g, ' ').trim() : '';
      return v || a.getAttribute(attr) || '';
    }

    function show(i) {
      at = (i + zooms.length) % zooms.length;
      var a = zooms[at];
      count.textContent = (at + 1) + ' of ' + zooms.length;
      var thumb = a.querySelector('img');
      // Title and medium come from the caption under the picture, so retyping a caption by hand
      // changes the large view too. data-title / data-medium are only the fallback.
      var title = captionText(a, 't', 'data-title');
      var medium = captionText(a, 'm', 'data-medium');
      zoomReset();
      image.removeAttribute('src');
      image.alt = thumb ? thumb.alt : title;
      image.src = a.href;
      text.textContent = '';
      text.appendChild(document.createTextNode(title));
      if (medium) text.appendChild(el('span', 'grey', ', ' + medium));
      var isDigital = (medium && medium.toLowerCase().indexOf('digital') !== -1) || (a.closest && !!a.closest('#digital'));
      inquire.hidden = isDigital;
      if (!isDigital) {
        inquire.href = 'info.html?about=' + encodeURIComponent(title) + '#contact';
      } else {
        inquire.removeAttribute('href');
      }
      var print = a.getAttribute('data-print');
      buy.hidden = !print;
      if (print) buy.href = print; else buy.removeAttribute('href');
    }

    zooms.forEach(function (a, i) {
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
        e.preventDefault();
        opener = a;
        show(i);
        dialog.showModal();
        close.focus();
      });
    });
    prev.addEventListener('click', function () { show(at - 1); });
    next.addEventListener('click', function () { show(at + 1); });
    close.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('keydown', function (e) {
      if (zooms.length < 2) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(at - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(at + 1); }
    });
    // Zoom: pinch with two fingers, or double-tap / double-click. Once zoomed in, drag to move around.
    // Keys: + and - zoom, 0 returns to the whole picture.
    var z = { s: 1, x: 0, y: 0 };
    var pts = {};
    var pinch = null;
    var tapDown = null;
    var lastTap = null;
    image.draggable = false;
    function fitted() {
      var sw = stage.clientWidth || 1, sh = stage.clientHeight || 1;
      var nw = image.naturalWidth || sw, nh = image.naturalHeight || sh;
      var r = Math.min(1, sw / nw, sh / nh);
      return { sw: sw, sh: sh, w: nw * r, h: nh * r, r: r };
    }
    // Up to the file's own pixels, and at least 3x so small files still open up.
    function zoomMax() { return Math.max(3, Math.min(8, 1 / fitted().r)); }
    function zoomApply(ease) {
      var f = fitted();
      var mx = Math.max(0, (f.w * z.s - f.sw) / 2);
      var my = Math.max(0, (f.h * z.s - f.sh) / 2);
      z.x = Math.max(-mx, Math.min(mx, z.x));
      z.y = Math.max(-my, Math.min(my, z.y));
      stage.classList.toggle('ease', !!ease);
      stage.classList.toggle('zoomed', z.s > 1);
      image.style.transform = z.s === 1 ? '' : 'translate(' + z.x + 'px,' + z.y + 'px) scale(' + z.s + ')';
    }
    function zoomReset() {
      z.s = 1; z.x = 0; z.y = 0;
      pts = {}; pinch = null; tapDown = null; lastTap = null;
      zoomApply(false);
    }
    // cx, cy: the point that stays put, measured from the middle of the stage.
    function zoomTo(s, cx, cy, ease) {
      s = Math.max(1, Math.min(zoomMax(), s));
      var k = s / z.s;
      z.x = cx - (cx - z.x) * k;
      z.y = cy - (cy - z.y) * k;
      z.s = s;
      if (s === 1) { z.x = 0; z.y = 0; }
      zoomApply(ease);
    }
    function fromMiddle(x, y) {
      var b = stage.getBoundingClientRect();
      return { x: x - b.left - b.width / 2, y: y - b.top - b.height / 2 };
    }
    function held() { return Object.keys(pts).length; }
    function two() {
      var k = Object.keys(pts), a = pts[k[0]], b = pts[k[1]];
      var dx = a.x - b.x, dy = a.y - b.y;
      return { d: Math.sqrt(dx * dx + dy * dy) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    function near(ax, ay, bx, by, within) {
      var dx = ax - bx, dy = ay - by;
      return dx * dx + dy * dy < within * within;
    }
    if (window.PointerEvent) {
      stage.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        pts[e.pointerId] = { x: e.clientX, y: e.clientY };
        try { stage.setPointerCapture(e.pointerId); } catch (err) {}
        stage.classList.remove('ease');
        if (held() === 2) { pinch = two(); tapDown = null; }
        else if (held() === 1) tapDown = { x: e.clientX, y: e.clientY, t: Date.now() };
      });
      stage.addEventListener('pointermove', function (e) {
        var p = pts[e.pointerId];
        if (!p) return;
        var dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        if (held() === 2 && pinch) {
          var now = two();
          z.x += now.x - pinch.x;
          z.y += now.y - pinch.y;
          var c = fromMiddle(now.x, now.y);
          var s = z.s * now.d / pinch.d;
          pinch = now;
          zoomTo(s, c.x, c.y, false);
        } else if (held() === 1 && z.s > 1) {
          z.x += dx; z.y += dy;
          zoomApply(false);
        }
      });
      var lift = function (e) {
        if (!pts[e.pointerId]) return;
        delete pts[e.pointerId];
        pinch = null;
        if (z.s !== 1 && z.s < 1.05) zoomTo(1, 0, 0, true);
        var down = tapDown;
        if (!held()) tapDown = null;
        if (e.type !== 'pointerup' || !down || held()) return;
        var t = Date.now();
        if (t - down.t > 300 || !near(e.clientX, e.clientY, down.x, down.y, 10)) { lastTap = null; return; }
        if (lastTap && t - lastTap.t < 350 && near(e.clientX, e.clientY, lastTap.x, lastTap.y, 40)) {
          lastTap = null;
          var c = fromMiddle(e.clientX, e.clientY);
          if (z.s > 1) zoomTo(1, 0, 0, true);
          else zoomTo(Math.min(zoomMax(), 2.5), c.x, c.y, true);
        } else {
          lastTap = { x: e.clientX, y: e.clientY, t: t };
        }
      };
      stage.addEventListener('pointerup', lift);
      stage.addEventListener('pointercancel', lift);
      // Trackpad pinch arrives as a wheel with ctrl held; a plain scroll moves the picture once zoomed in.
      stage.addEventListener('wheel', function (e) {
        if (e.ctrlKey) {
          e.preventDefault();
          var c = fromMiddle(e.clientX, e.clientY);
          var d = Math.max(-30, Math.min(30, e.deltaY));
          zoomTo(z.s * Math.exp(-d * 0.01), c.x, c.y, false);
        } else if (z.s > 1) {
          e.preventDefault();
          z.x -= e.deltaX; z.y -= e.deltaY;
          zoomApply(false);
        }
      }, { passive: false });
      dialog.addEventListener('keydown', function (e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === '+' || e.key === '=') zoomTo(z.s * 1.5, 0, 0, true);
        else if (e.key === '-') zoomTo(z.s / 1.5, 0, 0, true);
        else if (e.key === '0') zoomTo(1, 0, 0, true);
      });
      window.addEventListener('resize', function () { if (dialog.open) zoomApply(false); });
    }

    // Touch: swipe left for the next work, right for the previous one.
    var swipe = null;
    dialog.addEventListener('touchstart', function (e) {
      swipe = (zooms.length > 1 && e.touches.length === 1 && z.s === 1) // zoomed in, a drag moves the picture
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : null;
    }, { passive: true });
    dialog.addEventListener('touchmove', function (e) {
      if (e.touches.length > 1) swipe = null; // pinch to zoom, not a swipe
    }, { passive: true });
    dialog.addEventListener('touchcancel', function () { swipe = null; });
    dialog.addEventListener('touchend', function (e) {
      if (!swipe || !e.changedTouches.length) return;
      var dx = e.changedTouches[0].clientX - swipe.x;
      var dy = e.changedTouches[0].clientY - swipe.y;
      swipe = null;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      show(dx < 0 ? at + 1 : at - 1);
    });
    dialog.addEventListener('close', function () {
      zoomReset();
      image.removeAttribute('src');
      // Stepping may have moved on: return to the work last shown if the opener is not it.
      var back = zooms[at] || opener;
      if (back && back.focus) back.focus();
      opener = null;
    });
  }

  // Contact: a link may carry a painting title in ?about=.
  var about = document.getElementById('about');
  if (about && !about.value && window.URLSearchParams) {
    var asked = new URLSearchParams(location.search).get('about');
    if (asked) about.value = asked.slice(0, 200);
  }

  // Light or dark wall. Starts from the device setting; the choice is remembered on this device.
  var foot = document.querySelector('.site-foot nav');
  if (foot && window.matchMedia) {
    var root = document.documentElement;
    var sw = el('button', 'theme-switch');
    sw.type = 'button';
    var isDark = function () {
      var t = root.getAttribute('data-theme');
      return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    };
    var label = function () { sw.textContent = isDark() ? 'Light' : 'Dark'; sw.setAttribute('aria-label', isDark() ? 'Switch to light' : 'Switch to dark'); };
    sw.addEventListener('click', function () {
      var to = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', to);
      try { localStorage.setItem('theme', to); } catch (e) {}
      label();
    });
    label();
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', label);
    foot.appendChild(sw);
  }

  // Load a YouTube player only when asked; until then it is a plain link.
  all('.video').forEach(function (fig) {
    var link = fig.querySelector('.video-link');
    var id = fig.getAttribute('data-video');
    if (!link || !id) return;
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var frame = document.createElement('iframe');
      frame.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0';
      frame.title = (fig.querySelector('figcaption') || {}).textContent || 'Video';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture';
      frame.allowFullscreen = true;
      link.replaceWith(frame);
    });
  });
})();
