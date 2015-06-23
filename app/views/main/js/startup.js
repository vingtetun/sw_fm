setTimeout(function() {
  'use strict';

  var kRootPath = '../../';
  var kPaths = {
    configuration: getPath('configuration.json'),
    registrations: getPath('bridge/smuggler.js'),
    client: getPath('bridge/client.js')
  };

  Utils.importScript(kPaths.registrations)
    .then(getConfiguration.bind(null, kPaths.configuration))
    .then(registerServers)
    .then(registerServiceWorker)
    .then(Utils.importScript.bind(null, kPaths.client))
    .then(registerClients)
    .then(attachListeners);


  function debug(str) {
    console.log.call(console, '[startup] ', str);
  }

  function getPath(url) {
    return kRootPath + url;
  }

  function getConfiguration(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'json';
    xhr.send();

    return new Promise(function(resolve, reject) {
      xhr.addEventListener('load', function() {
        resolve(xhr.response);
      });

      xhr.addEventListener('error', function() {
        reject(xhr.statusText);
      });
    });
  }


  function registerServers(configuration) {
    var channel = new BroadcastChannel('smuggler');
    channel.postMessage({
      name: 'config',
      config: configuration
    });
    channel.close();
  }


  function registerClients() {
    window.logicAPI = new Client('logic');
    // we keep a ref to the events server to prevent it from being unloaded
    window.eventAPI = new Client('events');
  }


  function onclick(id, client, method) {
    var element = document.getElementById(id);
    if (!element) {
      return;
    }

    element.addEventListener('click', () => client[method]());
  }


  function attachListeners() {
    onclick('frequency-op-seekdown', logicAPI, 'seekDown');
    onclick('power-switch', logicAPI, 'togglePower');
    onclick('frequency-op-seekup', logicAPI, 'seekUp');
    onclick('bookmark-button', logicAPI, 'toggleBookmark');
    onclick('speaker-switch', logicAPI, 'toggleSpeaker');
    onclick('fav-list-container', logicAPI, 'selectFavorite');
  }


  function registerServiceWorker() {
    return new Promise(function(resolve, reject) {
      // XXX Bug 1153280 && Bug 1153281 makes it hard to hack on this
      // atm.
      if (!navigator.serviceWorker) {
        resolve();
        return;
      }

      var url = '../../../app/sw.js';
      navigator.serviceWorker.register(url).then(
        function onsuccess(worker) {
          var w = worker.installing || worker.waiting || worker.active;
          debug('ServiceWorker registered: ' + w);
          resolve();
        },

        function onerror(e) {
          debug('ServiceWorker not registered: ' + e);
          reject();
        }
      );
    });
  }
});

// Disconnect logic client if we loose visibility
document.addEventListener("visibilitychange", function () {
  var client = window.logicAPI;
  if (client) {
    if (document.hidden) {
      console.log("App is hidden");
      client.disconnect();
    } else {
      console.log("App has focus");
      client.connect();
    }
  }
});
