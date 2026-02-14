// PAI Companion Portal - Shared nav, footer, and favicon
// Include in every page: <script src="/shared/common.js"></script>
// Nav:    <nav id="pai-nav" data-page="PageName"></nav>
// Footer: <footer id="pai-footer"></footer>
(function () {
  // Favicon (inline SVG - Nightfall gradient rings)
  if (!document.querySelector('link[rel="icon"]')) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
      '<defs><linearGradient id="g" x1="0%25" y1="0%25" x2="100%25" y2="100%25">' +
      '<stop offset="0%25" stop-color="%2312c2e9"/>' +
      '<stop offset="50%25" stop-color="%23c471ed"/>' +
      '<stop offset="100%25" stop-color="%23ff6b9d"/>' +
      '</linearGradient><clipPath id="clip"><rect width="512" height="512" rx="96"/></clipPath></defs>' +
      '<g clip-path="url(%23clip)"><rect width="512" height="512" fill="%230d1220"/>' +
      '<circle cx="256" cy="256" r="170" fill="none" stroke="url(%23g)" stroke-width="8" opacity="0.3"/>' +
      '<circle cx="256" cy="256" r="130" fill="none" stroke="url(%23g)" stroke-width="10" opacity="0.5"/>' +
      '<circle cx="256" cy="256" r="90" fill="none" stroke="url(%23g)" stroke-width="14" opacity="0.7"/>' +
      '<circle cx="256" cy="256" r="45" fill="url(%23g)"/></g></svg>';
    var link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = 'data:image/svg+xml,' + svg;
    document.head.appendChild(link);
  }

  // Nav breadcrumb
  var nav = document.getElementById('pai-nav');
  if (nav) {
    var page = nav.getAttribute('data-page');
    if (page) {
      nav.innerHTML =
        '<a href="/">Portal</a>' +
        '<span class="sep">/</span>' +
        '<span>' + page + '</span>';
    }
  }

  // Footer
  var footer = document.getElementById('pai-footer');
  if (footer) {
    footer.innerHTML = '<a href="https://github.com/chriscantey/pai-companion" style="color:inherit">PAI Companion</a> &middot; Built on <a href="https://github.com/danielmiessler/PAI" style="color:inherit">PAI</a>';
  }
})();
