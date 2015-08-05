'use strict';

var readyDeferred = Promises.defer();
var s1 = new Server('logic', '1.0', {
  setFrequency: function(frequency) {
    return frequencyDialer.setFrequency(frequency);
  },

  getFrequency: function() {
    var freqDeferred = Promises.defer();
    // we resolve with the frequency once we're ready
    readyDeferred.promise.then(() => {
      freqDeferred.resolve(frequencyDialer.getFrequency());
    }).catch((e) => freqDeferred.reject(e));

    return freqDeferred.promise;
  },

  addBookmark: function(frequency) {
    favoritesUI.add(frequency).then(() => {
      favoritesUI.select(frequency);
    });
  },

  removeBookmark: function(frequency) {
    favoritesUI.remove(frequency);
  },

  toggleBookmark: function() {
    var frequency = frequencyDialer.getFrequency();
    favoritesAPI.contains(frequency).then(function(value) {
      if (value) {
        favoritesUI.remove(frequency).then(() => updateFavorites(frequency));
      } else {
        favoritesUI.add(frequency).then((elem) => {
          elem.scrollIntoView();
          updateFavorites(frequency);
        });
      }
    });
  },

  toggleSpeaker: function() {
    speakerManager.forcespeaker = !speakerManager.speakerforced;
  },

  seekDown: RadioManager.seekDown,
  seekUp: RadioManager.seekUp,
  togglePower: RadioManager.togglePower,
  isEnabling: RadioManager.isEnabling,
  disableRadio: RadioManager.disable,
  enableRadio: enableFMRadio,

  savePage: savePage,
  evictPage: function() {
  }
});

function enableFMRadio(frequency) {
  eventsAPI.getAirplaneMode().then(function(value) {
    if (value)
      return;

    frequency = frequency || mozFMRadio.frequencyLowerBound;
    RadioManager.enable(frequency);
  });
}


var favoritesAPI = new Client('favorites');
var historyAPI = new Client('history');
var eventsAPI = new Client('events');

window.addEventListener('load', function() {
  frequencyDialer.init(/* XXX pass some stuff */);
  favoritesUI.init(/* XXX pass some stuff */);

  historyAPI.restore().then(
      (frequency) => {
        frequencyDialer.setFrequency(frequency)
        readyDeferred.resolve();
      }
  ).catch((e) => readyDeferred.reject(new Error('Failed to init history')));
});

function selectFrequency(frequency) {
  frequencyDialer.setFrequency(frequency);
  frequency = frequencyDialer.getFrequency();

  historyAPI.save(frequency);
  updateFavorites(frequency);

  enableFMRadio(frequency);
}

function updateFavorites(frequency) {
  favoritesAPI.contains(frequency).then(function(rv) {
    favoritesUI.select(frequency);

    var bookmarkButton = $('bookmark-button');
    bookmarkButton.dataset.bookmarked = rv;
    bookmarkButton.setAttribute('aria-pressed', rv);
  });
}


// XXX SpeakerManager is here.
// So Speaker forced is only allowed when the app is in the foreground, but an other app can change the speaker forced value, so when this
// code is relaunched / goes in the foreground it needs to check the
// value and update the UI if needed.

var speakerManager = new SpeakerManager();
speakerManager.onspeakerforcedchange = function() {
  var element = $('speaker-switch');
  element.dataset.speakerOn = speakerManager.speakerforced;
  element.setAttribute('aria-pressed', speakerManager.speakerforced);
}

mozFMRadio.onfrequencychange = function() {
  selectFrequency(mozFMRadio.frequency);
}

function savePage() {
  var script = document.createElement('script');
  script.src = '../../../shared/rendercache/api.js';
  document.head.appendChild(script);

  function replace(content) {
    var rv = content.
              replace('<body>', '<body data-cached="true">').
              replace(/iframe/g, 'i').
              replace('<script src="../../shared/rendercache/api.js"></script>', '').
              replace('<script src="../../bridge/smuggler.js"></script>', '').
              replace('<script src="../../bridge/client.js"></script>', '');

    console.log(rv);
    return rv;
  }

  script.addEventListener('load', function onload(e) {
    script.removeEventListener('load', onload);
    var url = window.top.document.location.toString();
    renderCache.save(url, replace(window.top.document.documentElement.outerHTML));
  });
}

function evictPage() {
}

window.onunload =  function() {
  frequencyDialer.cleanup();
  favoritesUI.cleanup();
  eventsAPI.disconnect();
  historyAPI.disconnect();
  favoritesAPI.disconnect();
};
