(function () {
  'use strict';

  // ── Find current script tag & read config ──────────────────────────
  var scripts = document.getElementsByTagName('script');
  var currentScript = scripts[scripts.length - 1];
  var companyId = currentScript.getAttribute('data-company');

  if (!companyId) {
    console.error('[Pack24 Widget] data-company attribute is required.');
    return;
  }

  var API_URL = 'https://pack24.uz/api/eco/widget/' + companyId;

  // ── Create container ───────────────────────────────────────────────
  var container = document.createElement('div');
  container.id = 'pack24-eco-widget-' + companyId;
  container.setAttribute('style',
    'max-width:400px;min-width:280px;width:100%;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;'
  );
  currentScript.parentNode.insertBefore(container, currentScript.nextSibling);

  // ── Loading state ──────────────────────────────────────────────────
  container.innerHTML =
    '<div style="background:linear-gradient(135deg,#065f46 0%,#0f766e 50%,#115e59 100%);border-radius:16px;padding:32px 24px;text-align:center;color:rgba(255,255,255,0.7);font-size:14px;box-shadow:0 8px 32px rgba(0,0,0,0.18);">' +
    '<div style="width:24px;height:24px;border:3px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:p24spin 0.8s linear infinite;margin:0 auto 12px;"></div>' +
    'Loading eco data&hellip;' +
    '</div>' +
    '<style>@keyframes p24spin{to{transform:rotate(360deg)}}</style>';

  // ── Fetch data & render ────────────────────────────────────────────
  fetch(API_URL)
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (d) {
      render(d);
    })
    .catch(function () {
      container.innerHTML =
        '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;text-align:center;color:#991b1b;font-size:13px;font-family:Inter,sans-serif;">' +
        '⚠️ Could not load eco data.' +
        '</div>';
    });

  // ── Animated counter ───────────────────────────────────────────────
  function animateCounter(el, target, suffix) {
    suffix = suffix || '';
    var duration = 1200;
    var start = 0;
    var startTime = null;

    function step(ts) {
      if (!startTime) startTime = ts;
      var progress = Math.min((ts - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      var current = Math.round(start + (target - start) * eased);
      el.textContent = current.toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  // ── Level emoji mapping ────────────────────────────────────────────
  function levelEmoji(level) {
    var map = {
      seed: '🌱', sprout: '🌿', sapling: '🌳',
      tree: '🌲', forest: '🏔️', guardian: '🛡️', legend: '👑'
    };
    return map[level] || '🌱';
  }

  // ── Render widget ──────────────────────────────────────────────────
  function render(d) {
    var le = levelEmoji(d.ecoLevel);

    container.innerHTML =
      '<div style="' +
        'background:linear-gradient(135deg,#065f46 0%,#0f766e 50%,#115e59 100%);' +
        'border-radius:16px;overflow:hidden;' +
        'box-shadow:0 8px 32px rgba(0,0,0,0.18),0 2px 8px rgba(0,0,0,0.1);' +
        'color:#fff;position:relative;' +
      '">' +

      /* Decorative leaf circles */
      '<div style="position:absolute;top:-20px;right:-20px;width:100px;height:100px;background:rgba(255,255,255,0.04);border-radius:50%;"></div>' +
      '<div style="position:absolute;bottom:-30px;left:-30px;width:120px;height:120px;background:rgba(255,255,255,0.03);border-radius:50%;"></div>' +

      /* Header */
      '<div style="padding:24px 24px 16px;position:relative;z-index:1;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<span style="font-size:24px;">🌿</span>' +
            '<span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.6);">Eco Impact</span>' +
          '</div>' +
          '<div style="background:rgba(255,255,255,0.12);padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600;display:flex;align-items:center;gap:4px;">' +
            '<span>' + le + '</span>' +
            '<span style="text-transform:capitalize;">' + (d.ecoLevel || 'seed') + '</span>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:18px;font-weight:800;line-height:1.3;margin-bottom:2px;">' +
          escapeHtml(d.company) +
        '</div>' +
        '<div style="font-size:12px;color:rgba(255,255,255,0.5);">' +
          (d.ecoPoints ? d.ecoPoints.toLocaleString() + ' eco points' : '') +
        '</div>' +
      '</div>' +

      /* Stats Grid */
      '<div style="display:flex;gap:1px;background:rgba(255,255,255,0.08);position:relative;z-index:1;">' +
        statBlock('♻️', 'stat-recycled', 'kg', 'Recycled') +
        statBlock('💨', 'stat-co2', 'kg', 'CO₂ Saved') +
        statBlock('🌳', 'stat-trees', '', 'Trees Saved') +
      '</div>' +

      /* Footer */
      '<div style="padding:12px 24px;display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1;">' +
        '<a href="https://pack24.uz" target="_blank" rel="noopener" style="' +
          'text-decoration:none;display:flex;align-items:center;gap:6px;color:rgba(255,255,255,0.45);font-size:11px;font-weight:600;' +
          'transition:color 0.2s;' +
        '" onmouseover="this.style.color=\'rgba(255,255,255,0.8)\'" onmouseout="this.style.color=\'rgba(255,255,255,0.45)\'">' +
          '<span style="font-weight:800;color:rgba(255,255,255,0.6);">Pack<span style="color:#34d399;">24</span></span>' +
          '<span>Powered by Pack24</span>' +
        '</a>' +
        (d.lastActivity ?
          '<span style="font-size:10px;color:rgba(255,255,255,0.3);">Updated ' + d.lastActivity + '</span>'
          : '') +
      '</div>' +

      '</div>';

    // Animate counters after render
    var elRecycled = container.querySelector('#stat-recycled');
    var elCo2 = container.querySelector('#stat-co2');
    var elTrees = container.querySelector('#stat-trees');

    if (elRecycled) animateCounter(elRecycled, d.totalRecycledWeight || 0, '');
    if (elCo2) animateCounter(elCo2, d.co2Saved || 0, '');
    if (elTrees) animateCounter(elTrees, d.treesEquivalent || 0, '');
  }

  function statBlock(icon, id, unit, label) {
    return (
      '<div style="flex:1;background:rgba(0,0,0,0.15);padding:20px 12px;text-align:center;">' +
        '<div style="font-size:20px;margin-bottom:6px;">' + icon + '</div>' +
        '<div style="font-size:22px;font-weight:800;line-height:1;" id="' + id + '">0</div>' +
        (unit ? '<div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px;">' + unit + '</div>' : '<div style="height:15px;"></div>') +
        '<div style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.45);margin-top:6px;text-transform:uppercase;letter-spacing:0.5px;">' + label + '</div>' +
      '</div>'
    );
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }
})();
