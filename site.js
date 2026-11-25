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
    prev.innerHTML = '<svg viewBox="0 0 10 18" aria-hidden="true"><path d="M8.5 1.5 1.5 9l7 7.5"/></svg>';
    next.innerHTML = '<svg viewBox="0 0 10 18" aria-hidden="true"><path d="M1.5 1.5 8.5 9l-7 7.5"/></svg>';
    var close = el('button', 'view-close');
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1.5 1.5l11 11M12.5 1.5l-11 11"/></svg>';
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
    // A work outside the sections (the featured painting) names its section in data-group and leads it.
    function secOf(z) {
      var g = z.getAttribute('data-group');
      return g ? document.getElementById(g) : (z.closest ? z.closest('section[id]') : null);
    }
    function groupFor(a) {
      var sec = secOf(a);
      return zooms.filter(function (z) {
        return secOf(z) === sec && !(z.closest && z.closest('[hidden]'));
      });
    }

    var at = 0, startAt = 0;
    var opener = null;

    function captionText(a, cls, attr) {
      var fig = a.closest ? a.closest('figure') : null;
      var n = fig && fig.querySelector('.' + cls);
      var v = n ? n.textContent.replace(/\s+/g, ' ').trim() : '';
      return v || a.getAttribute(attr) || '';
    }

    // Size the picture's box to the picture itself (never cropped), so the caption sits right under it
    // instead of at the bottom of the screen. The ratio comes from the grid image's width/height
    // attributes, so it is known before the large file loads.
    var ratio = 0;
    function fit() {
      if (!ratio) { inner.classList.remove('fit'); return; }
      var cs = getComputedStyle(inner);
      var avail = inner.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - cap.offsetHeight;
      var h = Math.max(120, Math.floor(Math.min(avail, dialog.clientWidth * ratio)));
      inner.style.setProperty('--fit-h', h + 'px');
      inner.style.setProperty('--fit-w', Math.floor(h / ratio) + 'px');
      // Previous / Next: just outside the picture if a whole circle (40px) fits beside it with a margin,
      // otherwise 12px inside the picture's edge, so a circle never straddles the edge or the screen edge.
      var side = (dialog.clientWidth - h / ratio) / 2;
      inner.style.setProperty('--step-x', Math.round(side >= 40 + 24 ? side - 40 - 12 : Math.max(0, side) + 12) + 'px');
      inner.classList.add('fit');
    }
    function show(i) {
      at = (i + group.length) % group.length;
      var a = group[at];
      var tw = a.querySelector('img');
      ratio = tw ? (+tw.getAttribute('height') || 0) / (+tw.getAttribute('width') || 1) : 0;
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
      var sold = a.hasAttribute('data-sold');
      if (sold) text.appendChild(el('span', 'grey', ' · Original sold'));
      inquire.hidden = isDigital || sold;
      if (!isDigital && !sold) {
        inquire.href = 'mailto:matmatera@gmail.com?subject=' + encodeURIComponent('Inquiry: ' + title);
      } else {
        inquire.removeAttribute('href');
      }
      var print = a.getAttribute('data-print');
      buy.hidden = !print;
      if (print) buy.href = print; else buy.removeAttribute('href');
      links.hidden = inquire.hidden && buy.hidden;
      fit(); fit();  // second pass: the caption may rewrap at the picture's width
    }

    zooms.forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
        e.preventDefault();
        opener = a;
        var target = a;
        group = groupFor(target);
        if (group.indexOf(target) < 0) group = [target];
        var one = group.length < 2;
        prev.hidden = one; next.hidden = one; count.hidden = one;
        dialog.showModal();
        show(group.indexOf(target));
        startAt = at;
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
      // Panning limits. Once the zoomed picture is larger than the whole screen in a direction, it can be
      // moved until its edge meets the screen edge (past the breathing room around the fitted picture);
      // otherwise it stays within its own box, as before.
      var sb = stage.getBoundingClientRect();
      function clampAxis(v, size, box, start, screen) {
        var c = start + box / 2;  // the box's middle on screen
        if (size > screen) return Math.max(screen - c - size / 2, Math.min(size / 2 - c, v));
        var m = Math.max(0, (size - box) / 2);
        return Math.max(-m, Math.min(m, v));
      }
      z.x = clampAxis(z.x, f.w * z.s, f.sw, sb.left, window.innerWidth);
      z.y = clampAxis(z.y, f.h * z.s, f.sh, sb.top, window.innerHeight);
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
      window.addEventListener('resize', function () { if (dialog.open) { fit(); zoomApply(false); } });
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
      var back = (at === startAt && opener) ? opener : (group[at] || opener);
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
  // The exhibition bar is sticky too (Nov 2026), so the section links stop just under it.
  // Its height is the CSS --strip-h, which can change while scrolling (phones), so the header's sticky top
  // is written against it rather than as a fixed number. Hidden after the show: no strip, no offset.
  var strip = document.querySelector('.show-line');
  var hasStrip = function () { return strip && !strip.hidden; };
  function place() {
    head.style.top = '0px';
    // Phones: the section links have a hairline along their top; pull the header up past it so the stuck bar
    // starts right under the exhibition bar with no stray line. Wider screens keep a 6px margin.
    var ncs = getComputedStyle(nav), bt = parseFloat(ncs.borderTopWidth) || 0;
    var off = nav.getBoundingClientRect().top - head.getBoundingClientRect().top + (bt ? bt + (parseFloat(ncs.paddingTop) || 0) : -6);
    lift = Math.max(0, Math.round(off));
    var sh = hasStrip() ? 'var(--strip-h, 0px)' : '0px';
    head.style.top = 'calc(' + sh + ' - ' + lift + 'px)';
    root.style.setProperty('--bar-h', 'calc(' + sh + ' + ' + (head.offsetHeight - lift) + 'px)');
    stuck();
  }
  // Phones: the exhibition bar slims to EXHIBITION alone once the visitor scrolls, and opens up again at the top.
  var phone = window.matchMedia ? window.matchMedia('(max-width: 559px)') : null;
  function compact() {
    var on = !!(hasStrip() && phone && phone.matches && window.scrollY > 24);
    if (root.classList.contains('show-compact') !== on) root.classList.toggle('show-compact', on);
  }
  window.addEventListener('scroll', compact, { passive: true });
  window.addEventListener('resize', compact);
  compact();
  function stuck() { head.classList.toggle('is-stuck', window.scrollY > lift + 1); }
  // Phones only (artwork.css hides it on wider screens): an up arrow at the end of the bar, shown once the
  // bar is stuck, that goes back to the top of the page.
  var up = document.createElement('button');
  up.type = 'button';
  up.className = 'bar-top';
  up.setAttribute('aria-label', 'Back to top');
  up.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 16V4M4.5 9.5 10 4l5.5 5.5"/></svg>';
  up.addEventListener('click', function () {
    var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
  });
  nav.appendChild(up);
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
  var card = pop.querySelector('.show-card');
  var closing = false;
  // While the card is up, the top line's words wait; they appear once the card has folded into the line.
  function landed() { if (line) line.classList.remove('is-waiting'); }
  function open() {
    if (pop.open) return;
    if (line) line.classList.add('is-waiting');
    pop.showModal();
  }
  // Closing folds the card up into the slim line at the top, so visitors see where the show went.
  function shut() {
    if (!pop.open || closing) return;
    var r = line && !line.hidden ? line.getBoundingClientRect() : null;
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still || !card.animate || !r || r.height === 0 || r.bottom <= 0) { pop.close(); landed(); return; }
    closing = true;
    var c = card.getBoundingClientRect();
    var dx = (r.left + r.width / 2) - (c.left + c.width / 2);
    var dy = (r.top + r.height / 2) - (c.top + c.height / 2);
    pop.classList.add('is-closing');
    var fold = card.animate([
      { transform: 'none' },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + (r.width / c.width) + ',' + (r.height / c.height) + ')' }
    ], { duration: 560, delay: 90, easing: 'cubic-bezier(.65, 0, .3, 1)', fill: 'forwards' });
    fold.onfinish = function () {
      pop.close();
      pop.classList.remove('is-closing');
      fold.cancel();
      closing = false;
      landed();
    };
  }
  pop.addEventListener('close', landed);
  // Escape folds it up the same way.
  pop.addEventListener('cancel', function (e) { e.preventDefault(); shut(); });
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
  // The card opens only when the exhibition bar is clicked (Nov 2026: no automatic pop-up), or from a
  // link to #show. The bar's one-time arrival animation is marked as seen for this browser session.
  if (location.hash === '#show') open();
  try { sessionStorage.setItem('show-intro', '1'); } catch (e) {}
})();

/* "Print available" under grid captions was removed (Nov 2026): Mat wants print and sold info
   only in the large view, which shows "Buy a print on Etsy" and "Original sold". */

/* Prints in the top menu: a small card first says the shop is on Etsy and opens in a new tab, so visitors
   know they are leaving (Nov 2026). Without JavaScript the link simply opens Etsy in a new tab. */
(function () {
  var links = document.querySelectorAll('a.to-etsy');
  if (!links.length || !window.HTMLDialogElement) return;
  var d = document.createElement('dialog');
  if (typeof d.showModal !== 'function') return;
  d.className = 'leave-pop';
  d.setAttribute('aria-labelledby', 'leave-h');
  d.innerHTML = '<div class="leave-card"><h2 id="leave-h">Prints</h2>' +
    '<p>My prints are sold through my Etsy shop, which opens in a new tab. This site stays open here.</p>' +
    '<p class="leave-acts"><button class="leave-stay" type="button">Stay here</button>' +
    '<a class="leave-go" href="' + links[0].href + '" target="_blank" rel="noopener">Go to Etsy</a></p></div>';
  document.body.appendChild(d);
  var go = d.querySelector('.leave-go');
  function shut() { d.close(); }
  d.querySelector('.leave-stay').addEventListener('click', shut);
  go.addEventListener('click', function () { setTimeout(shut, 0); });
  d.addEventListener('click', function (e) { if (e.target === d) shut(); });
  Array.prototype.forEach.call(links, function (a) {
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
      e.preventDefault();
      go.href = a.href;
      d.showModal();
      go.focus();
    });
  });
})();

/* Artwork grid: masonry (Nov 2026 experiment). The markup stays the plain list of <figure class="work">
   (the Drive sync adds to it); this only positions it. Column count and gaps come from the CSS grid rules
   (3 / 2 / 2 columns), read before each layout. Each work, in page order, goes to the column whose bottom is
   highest (leftmost on a tie), so every work starts at or below the one before it: reading top to bottom
   follows the page order, which is also the keyboard order. Nothing is cropped or reordered.
   To turn it off, delete this block. */
(function () {
  if (!document.querySelector('.nav-art') || !window.getComputedStyle) return;
  var lists = Array.prototype.slice.call(document.querySelectorAll('#main section .works'));
  if (!lists.length) return;
  function px(v) { return parseFloat(v) || 0; }
  function layout(list) {
    list.classList.remove('masonry');
    list.style.height = '';
    var items = Array.prototype.filter.call(list.children, function (n) { return n.classList.contains('work') && !n.hidden; });
    items.forEach(function (n) { n.style.width = n.style.transform = ''; });
    var cs = getComputedStyle(list);
    // The grid has two tracks per column (see artwork.css), so half the track count is the column count.
    var cols = Math.round(cs.gridTemplateColumns.split(' ').filter(Boolean).length / 2);
    if (cols < 2 || !items.length) return;
    var colGap = px(cs.columnGap), rowGap = px(cs.rowGap);
    var w = list.clientWidth;
    var colW = (w - colGap * (cols - 1)) / cols;
    list.classList.add('masonry');
    items.forEach(function (n) { n.style.width = colW + 'px'; });
    var hs = items.map(function (n) { return n.getBoundingClientRect().height; });
    var bottoms = [];
    for (var c = 0; c < cols; c++) bottoms.push(0);
    items.forEach(function (n, i) {
      var best = 0;
      for (var c = 1; c < cols; c++) if (bottoms[c] < bottoms[best] - 1) best = c;
      n.style.transform = 'translate(' + Math.round(best * (colW + colGap)) + 'px,' + Math.round(bottoms[best]) + 'px)';
      bottoms[best] += hs[i] + rowGap;
    });
    list.style.height = Math.max(0, Math.max.apply(null, bottoms) - rowGap) + 'px';
  }
  function all() { lists.forEach(layout); }
  all();
  var lastW = window.innerWidth, t = 0;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;  // phones fire resize when the address bar slides
    lastW = window.innerWidth;
    clearTimeout(t); t = setTimeout(all, 60);
  });
  window.addEventListener('load', all);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(all);
})();
