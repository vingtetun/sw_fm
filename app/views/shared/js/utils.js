'use strict'

var Utils = {
  importScript: function(src) {
    var script = document.createElement('script');
    script.src = src;
    document.head.appendChild(script);

    return new Promise(function(resolve, reject) {
      script.addEventListener('load', resolve);
      script.addEventListener('error', reject);
    });
  }
}
