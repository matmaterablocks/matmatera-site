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
    var buy = el('a', '', 'Buy a print on Etsy');
    buy.rel = 'noopener';
    stage.appendChild(image);
    main.appendChild(stage); main.appendChild(prev); main.appendChild(next);
    links.appendChild(inquire);
    links.appendChild(buy);
    cap.appendChild(text); cap.appendChild(links); cap.appendChild(count);
    inner.appendChild(close); inner.appendChild(main); inner.appendChild(cap);
    dialog.appendChild(inner);
    document.body.appendChild(dialog);
    // Previous / Next and swipe stay inside the section the work belongs to (Paintings, Pastels...),
    // and skip works that are folded away under "See all". Home has no section ids, so it steps through all.
    var group = zooms;
    function groupFor(a) {
      var sec = a.closest ? a.closest('section[id]') : null;
      return zooms.filter(function (z) {
        var s2 = z.closest ? z.closest('section[id]') : null;
        return s2 === sec && !(z.closest && z.closest('[hidden]'));
      });
    }

    var at = 0;
    var opener = null;

    function captionText(a, cls, attr) {
      var fig = a.closest ? a.closest('figure') : null;
      var n = fig && fig.querySelector('.' + cls);
      var v = n ? n.textContent.replace(/\s+/g, ' ').trim() : '';
      return v || a.getAttribute(attr) || '';
    }

    function show(i) {
      at = (i + group.length) % group.length;
      var a = group[at];
      count.textContent = (at + 1) + ' of ' + group.length;
      var thumb = a.querySelector('img');
      // Title and medium come from the caption under the picture, so retyping a caption by hand
      // changes the large view too. data-title / data-medium are only the fallback.
      var title = captionText(a, 't', 'data-title');
      var medium = captionText(a, 'm', 'data-medium');
      tonePx = null;
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
        inquire.href = 'mailto:matmatera@gmail.com?subject=' + encodeURIComponent('Inquiry: ' + title);
      } else {
        inquire.removeAttribute('href');
      }
      var print = a.getAttribute('data-print');
      buy.hidden = !print;
      if (print) buy.href = print; else buy.removeAttribute('href');
    }

    zooms.forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
        e.preventDefault();
        opener = a;
        group = groupFor(a);
        if (group.indexOf(a) < 0) group = [a];
        var one = group.length < 2;
        prev.hidden = one; next.hidden = one; count.hidden = one;
        show(group.indexOf(a));
        dialog.showModal();
        close.focus();
        if (image.complete && image.naturalWidth) { toneRead(); tone(); }
      });
    });
    prev.addEventListener('click', function () { show(at - 1); });
    next.addEventListener('click', function () { show(at + 1); });
    close.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('keydown', function (e) {
      if (group.length < 2) return;
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

    // Previous, Next and Close sit on top of the picture, so each one turns light or dark to stand out from
    // the part of the painting behind it. Off the picture they keep the page colors.
    var tonePx = null, toneW = 0, toneH = 0, toneT = 0;
    var toned = [prev, next, close];
    function toneRead() {
      tonePx = null;
      try {
        var nw = image.naturalWidth, nh = image.naturalHeight;
        if (!nw || !nh) return;
        var k = Math.min(1, 240 / Math.max(nw, nh));
        toneW = Math.max(1, Math.round(nw * k)); toneH = Math.max(1, Math.round(nh * k));
        var c = document.createElement('canvas');
        c.width = toneW; c.height = toneH;
        var g = c.getContext('2d');
        g.drawImage(image, 0, 0, toneW, toneH);
        tonePx = g.getImageData(0, 0, toneW, toneH).data;
      } catch (err) { tonePx = null; }
    }
    function lin(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    function tone() {
      toned.forEach(function (b) { b.classList.remove('tone-light', 'tone-dark'); });
      if (!tonePx || !dialog.open) return;
      var f = fitted();
      var sb = stage.getBoundingClientRect();
      var w = f.w * z.s, h = f.h * z.s;
      var left = sb.left + (sb.width - w) / 2 + z.x, top = sb.top + (sb.height - h) / 2 + z.y;
      toned.forEach(function (b) {
        if (b.hidden) return;
        var r = b.getBoundingClientRect();
        var x0 = Math.max(r.left, left), x1 = Math.min(r.right, left + w);
        var y0 = Math.max(r.top, top), y1 = Math.min(r.bottom, top + h);
        if (x1 <= x0 || y1 <= y0) return;
        if ((x1 - x0) * (y1 - y0) < r.width * r.height * 0.3) return;  // mostly over the plain wall
        var px0 = Math.floor((x0 - left) / w * toneW), px1 = Math.ceil((x1 - left) / w * toneW);
        var py0 = Math.floor((y0 - top) / h * toneH), py1 = Math.ceil((y1 - top) / h * toneH);
        var sum = 0, n = 0;
        for (var y = Math.max(0, py0); y < Math.min(toneH, py1); y++) {
          for (var x = Math.max(0, px0); x < Math.min(toneW, px1); x++) {
            var i = (y * toneW + x) * 4;
            sum += 0.2126 * lin(tonePx[i]) + 0.7152 * lin(tonePx[i + 1]) + 0.0722 * lin(tonePx[i + 2]);
            n++;
          }
        }
        if (!n) return;
        var L = sum / n;
        // Pick whichever of the light (#f4eee3) or dark (#1d3341) icon has more contrast with what's behind.
        var cLight = (0.85 + 0.05) / (L + 0.05), cDark = (L + 0.05) / (0.03 + 0.05);
        b.classList.add(cLight >= cDark ? 'tone-light' : 'tone-dark');
      });
    }
    function toneSoon(ease) {
      if (window.requestAnimationFrame) requestAnimationFrame(tone); else tone();
      clearTimeout(toneT);
      if (ease) toneT = setTimeout(tone, 220);  // after the zoom animation settles
    }
    image.addEventListener('load', function () { toneRead(); tone(); });
    function fitted() {
      var sw = stage.clientWidth || 1, sh = stage.clientHeight || 1;
      var nw = image.naturalWidth || sw, nh = image.naturalHeight || sh;
      var r = Math.min(sw / nw, sh / nh);  // small pictures are stretched to fill the view
      return { sw: sw, sh: sh, w: nw * r, h: nh * r, r: r };
    }
    // Up to the file's own pixels, and at least 3x so small files still open up.
    function zoomMax() { return Math.max(3, Math.min(8, 1 / fitted().r)); }  // 1/r < 1 for stretched pictures, so 3x
    function zoomApply(ease) {
      var f = fitted();
      var mx = Math.max(0, (f.w * z.s - f.sw) / 2);
      var my = Math.max(0, (f.h * z.s - f.sh) / 2);
      z.x = Math.max(-mx, Math.min(mx, z.x));
      z.y = Math.max(-my, Math.min(my, z.y));
      stage.classList.toggle('ease', !!ease);
      stage.classList.toggle('zoomed', z.s > 1);
      image.style.transform = z.s === 1 ? '' : 'translate(' + z.x + 'px,' + z.y + 'px) scale(' + z.s + ')';
      toneSoon(ease);
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
      swipe = (group.length > 1 && e.touches.length === 1 && z.s === 1) // zoomed in, a drag moves the picture
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
      var back = group[at] || opener;
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

/* Artwork page: section pages and "See all".
   A section with more than data-see-all works (20) shows its first data-show (6) and a "See all" link to
   /?section=<id>, which shows that one section in full. Without JavaScript everything shows. */
(function () {
  var main = document.getElementById('main');
  var nav = document.querySelector('.nav-art');
  if (!main || !nav || !main.hasAttribute('data-see-all')) return;
  var limit = parseInt(main.getAttribute('data-see-all'), 10) || 0;
  var first = parseInt(main.getAttribute('data-show'), 10) || 6;
  var sections = Array.prototype.slice.call(main.querySelectorAll(':scope > section.section[id]'));
  var only = window.URLSearchParams ? new URLSearchParams(location.search).get('section') : null;
  var page = null;
  sections.forEach(function (s) { if (s.id === only) page = s; });

  function headLink(sec, href, label, cls) {
    var head = sec.querySelector('.section-head');
    if (!head) return;
    var a = document.createElement('a');
    a.className = 'act ' + cls;
    a.href = href;
    a.textContent = label;
    head.appendChild(a);
  }

  if (page) {
    // One section on its own page.
    sections.forEach(function (s) { if (s !== page) s.hidden = true; });
    document.documentElement.classList.add('section-page');
    var h2 = page.querySelector('h2');
    if (h2) document.title = h2.textContent + ' | Mat Matera';
    headLink(page, '/', 'All artwork', 'act-back');
    Array.prototype.forEach.call(nav.querySelectorAll('a[href^="#"]'), function (a) {
      var id = a.getAttribute('href').slice(1);
      if (id !== page.id) a.href = '/#' + id;
    });
    return;
  }
  if (!limit) return;
  sections.forEach(function (s) {
    var works = s.querySelectorAll('.works > .work');
    if (works.length <= limit) return;
    for (var i = first; i < works.length; i++) works[i].hidden = true;
    headLink(s, '/?section=' + encodeURIComponent(s.id), 'See all ' + works.length, 'act-all');
  });
})();

/* Artwork page: the section links stay at the top of the screen while scrolling. The whole header is
   sticky, pulled up so that only the row of section links stays in view (on phones the name and Info
   scroll away). Links jump to a section without the bar covering its heading, and the section in view
   is underlined. */
(function () {
  var head = document.querySelector('.site-head');
  var nav = head && head.querySelector('.nav-art');
  if (!nav) return;
  var root = document.documentElement;
  var lift = 0;
  function place() {
    head.style.top = '0px';
    var off = nav.getBoundingClientRect().top - head.getBoundingClientRect().top - 6;
    lift = Math.max(0, Math.round(off));
    head.style.top = (-lift) + 'px';
    root.style.setProperty('--bar-h', (head.offsetHeight - lift) + 'px');
    stuck();
  }
  // How far down the page the header starts (the exhibition line sits above it).
  function natural() {
    var y = 0;
    for (var n = head.previousElementSibling; n; n = n.previousElementSibling) {
      var pos = getComputedStyle(n).position;
      if (pos !== 'absolute' && pos !== 'fixed' && !n.hidden) y += n.offsetHeight;
    }
    return y;
  }
  function stuck() { head.classList.toggle('is-stuck', window.scrollY > lift + natural()); }
  place();
  window.addEventListener('resize', place);
  window.addEventListener('load', place);
  window.addEventListener('scroll', stuck, { passive: true });

  var links = {};
  Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) {
    var id = (a.getAttribute('href') || '').split('#')[1];
    if (id) links[id] = a;
  });
  if (!('IntersectionObserver' in window)) return;
  var here = null;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      if (here) here.classList.remove('is-here');
      here = links[e.target.id] || null;
      if (here) here.classList.add('is-here');
    });
  }, { rootMargin: '-30% 0px -65% 0px' });
  Object.keys(links).forEach(function (id) {
    var s = document.getElementById(id);
    if (s) io.observe(s);
  });
})();

/* Artwork page: block Safari's page pinch-zoom on the grid (the large view has its own zoom). */
(function () {
  if (!document.querySelector('.nav-art')) return;
  ['gesturestart', 'gesturechange'].forEach(function (t) {
    document.addEventListener(t, function (e) {
      if (!(e.target.closest && e.target.closest('dialog.view'))) e.preventDefault();
    }, { passive: false });
  });
})();

/* The current show: a card that opens over the artwork on a visitor's first arrival, and a slim line at the
   very top that opens it again. Closing it is remembered on this device. After the show's last day
   (data-until), neither appears. Without JavaScript the line links to the gallery. */
(function () {
  var pop = document.getElementById('show');
  var line = document.querySelector('.show-line');
  if (!pop) return;
  var until = Date.parse(pop.getAttribute('data-until') || '');
  if (until && Date.now() >= until) {
    if (line) line.hidden = true;
    return;
  }
  if (typeof pop.showModal !== 'function') return;
  var key = 'show-closed:' + (pop.getAttribute('data-until') || '');
  function open() { if (!pop.open) pop.showModal(); }
  function shut() { pop.close(); }
  pop.addEventListener('close', function () { try { localStorage.setItem(key, '1'); } catch (e) {} });
  pop.querySelector('.show-close').addEventListener('click', shut);
  pop.querySelector('.show-go').addEventListener('click', shut);
  // A click on the dimmed backdrop (outside the card) closes it too.
  pop.addEventListener('click', function (e) { if (e.target === pop) shut(); });
  if (line) {
    var a = line.querySelector('a');
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
      e.preventDefault();
      open();
    });
  }
  var seen = false;
  try { seen = localStorage.getItem(key) === '1'; } catch (e) {}
  // Not on a section's own page or when arriving at a section link; those visitors came for the artwork.
  if (!seen && !location.search && !location.hash) open();
})();

/* Works with an Etsy print (data-print on their link) get a "Print available" link under the caption. */
(function () {
  Array.prototype.forEach.call(document.querySelectorAll('.work a.zoom[data-print]'), function (a) {
    var cap = a.closest('figure') && a.closest('figure').querySelector('figcaption');
    if (!cap) return;
    var tag = document.createElement('a');
    tag.className = 'print-tag';
    tag.href = a.getAttribute('data-print');
    tag.rel = 'noopener';
    tag.textContent = 'Print available';
    cap.appendChild(tag);
  });
})();
