'use strict';

var c = new Server('events', '1.0', {
  getAirplaneMode: getAirplaneMode
});

var logicAPI = new Client('logic');

var airplaneModeEnabled = false;
// when app starts, default is to start the radio
window._previousFMRadioState = true;

getAirplaneMode().then(function(value) {
  airplaneModeEnabled = value;
  updateDialogs();
});

function getAirplaneMode() {
  return new Promise(function(resolve, reject) {
    AirplaneModeHelper.ready(function() {
      resolve(AirplaneModeHelper.getStatus() === 'enabled');
    });
  });
}

AirplaneModeHelper.addEventListener('statechange', function(status) {
  airplaneModeEnabled = AirplaneModeHelper.getStatus() === 'enabled';
  updateDialogs();
});

//
// If the system app is opening an attention screen (because
// of an incoming call or an alarm, e.g.) and if we are
// currently playing the radio then we need to stop the radio
// before the ringer or alarm starts sounding. See bugs 995540
// and 1006200.
//
// XXX We're abusing the settings API here to allow the system app
// to broadcast a message to any certified apps that care. There
// ought to be a better way, but this is a quick and easy way to
// fix a last-minute release blocker.
//
navigator.mozSettings && navigator.mozSettings.addObserver(
  'private.broadcast.attention_screen_opening',
  function(evt) {
  // An attention screen is in the process of opening. Save the
  // current state of the radio and disable.
  if (evt.settingValue) {
    window._previousFMRadioState = mozFMRadio.enabled;
    window._previousEnablingState = enabling;
    window._previousSpeakerForcedState = speakerManager.speakerforced;
    mozFMRadio.disable();
    return;
  }

  // An attention screen is closing.
  // If the radio was previously enabled or was in the process
  // of becoming enabled, re-enable the radio.
  if (!!window._previousFMRadioState || !!window._previousEnablingState) {
    // Ensure the antenna is still available before re-starting
    // the radio.
    if (mozFMRadio.antennaAvailable) {
      logicAPI.getFrequency().then(function(frequency) {
        logicAPI.enableRadio(frequency);
      });
    }

    // Re-enable the speaker if it was previously forced.
    speakerManager.forcespeaker = !!window._previousSpeakerForcedState;
  }
    c.broadcast('attentionscreenchange', evt.settingValue);
  }
);


var kAirplaneDialogURL = '../../views/airplane/index.html';
var kAntennaDialogURL = '../../views/antenna/index.html';

function updateDialogs() {
  if (airplaneModeEnabled) {
    Dialog.open(kAirplaneDialogURL);
  } else {
    Dialog.close(kAirplaneDialogURL);
  }

  if (!mozFMRadio.antennaAvailable) {
    Dialog.open(kAntennaDialogURL);
  } else {
    Dialog.close(kAntennaDialogURL);
  }
}

mozFMRadio.onantennaavailablechange = function() {
  updateDialogs();

  // reconnect if in background
  logicAPI.connect().then(() => {
    if (mozFMRadio.antennaAvailable) {
      // If the FM radio is enabled or enabling when the antenna is
      // unplugged, turn the FM radio on again.
      if (!!window._previousFMRadioState || !!window._previousEnablingState) {
        logicAPI.getFrequency().then(function(frequency) {
          logicAPI.enableRadio(frequency);
        });
      }
    } else {
      // Remember the current state of the FM radio
      window._previousFMRadioState = mozFMRadio.enabled;
      logicAPI.isEnabling().then((res) => {
        window._previousEnablingState = res;
      });
      logicAPI.disableRadio();
    }

  });
};

mozFMRadio.onantennaavailablechange();

// Disconnect logic client if we loose visibility
document.addEventListener("visibilitychange", function () {
  var client = window.logicAPI;
  if (document.hidden) {
    console.log("App is hidden");
    client.disconnect();
  } else {
    console.log("App has focus");
    client.connect();
  }
});
