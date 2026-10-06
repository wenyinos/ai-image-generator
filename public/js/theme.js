(function () {
  'use strict';

  var KEY = 'aig-theme';
  var root = document.documentElement;
  var btn = document.getElementById('themeToggle');
  var icon = document.getElementById('themeToggleIcon');
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function stored() {
    try {
      var v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' ? v : null;
    } catch (e) {
      return null;
    }
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    if (icon) {
      icon.className = theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
    }
    if (btn) {
      var label = theme === 'dark' ? '切换到日间模式' : '切换到夜间模式';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    }
  }

  apply(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  if (btn) {
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch (e) {
        /* 隐私模式下持久化不可用时仅本次会话生效 */
      }
      apply(next);
    });
  }

  if (media && media.addEventListener) {
    media.addEventListener('change', function (e) {
      if (!stored()) {
        apply(e.matches ? 'dark' : 'light');
      }
    });
  }
})();
