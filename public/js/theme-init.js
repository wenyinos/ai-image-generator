/* 主题防闪烁：在样式渲染前确定日/夜间模式（需在 <head> 中同步加载） */
(function () {
  'use strict';
  var t = null;
  try {
    t = localStorage.getItem('aig-theme');
  } catch (e) {
    /* 隐私模式下忽略 */
  }
  if (t !== 'light' && t !== 'dark') {
    t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', t);
})();
