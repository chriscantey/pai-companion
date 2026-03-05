// PAI Companion Portal — Theme initialization
// Runs synchronously in <head> BEFORE body renders — prevents FOUC.
// Requires /shared/config.js to be loaded first (sets window.PAI_CONFIG).
(function () {
  var cfg = window.PAI_CONFIG || {};
  var theme = cfg.theme || 'nightfall';
  document.documentElement.setAttribute('data-theme', theme);
}());
