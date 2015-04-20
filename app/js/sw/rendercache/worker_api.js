'use strict';

/*global Server, renderCacheContract, debug, normalizeUrl, caches, Response*/

importScripts('js/sw/utils.js');
importScripts('bridge/server.js');

var CACHE = 'render-cache-v0';

debug('Starting the rendercache backend');

function RenderCacheWorker() {
  this.protocol = new Server('rendercache', '1.0', {
    save: this.save.bind(this),
    evict: this.evict.bind(this)
  });
}

RenderCacheWorker.prototype.save = function(url, markup) {
  return new Promise((resolve, reject) => {
    if (!url || !markup) {
      debug('Invalid cache');
      reject();
      return;
    }

    var normalizedUrl = normalizeUrl(url);

    debug('Normalized URL ' + normalizedUrl);

    var self = this;

    caches.open(CACHE).then(function(cache) {
      return cache.put(normalizedUrl, new Response(markup, {
        headers: {
          'Content-Type': 'text/html'
        }
      }));
    }).then(function() {
      self.protocol.broadcast('saved');
      resolve();
    }).catch(function(error) {
      debug('Could not save cache for ' + normalizedUrl + ' ' + error);
      reject();
    });
  });
};

RenderCacheWorker.prototype.evict = function(resolve, reject, args) {
  debug('Got evict for ' + args.url);
  resolve();
};

RenderCacheWorker.prototype.match = function(url) {
  //debug('Looking for ' + url + ' in render cache');
  url = normalizeUrl(url);
  return caches.open(CACHE).then(function(cache) {
    return cache.match(url);
  });
};

var renderCache = new RenderCacheWorker();
