'use strict';

var RadioManager = (function() {
  var powerSwitch = $('power-switch');

  function updateEnablingState(value) {
    powerSwitch.dataset.enabling = value;
    updatePowerUI();
    updateFrequencyBarUI();
  }

  function isEnabling() {
    return powerSwitch.dataset.enabling === 'true';
  }

  function updateSeekingState(value) {
    powerSwitch.dataset.seeking = value;
  }

  function isSeeking() {
    return powerSwitch.dataset.seeking === true;
  }

  function seekDown() {
    updateSeekingState(true);
    var r = mozFMRadio.seekDown();
    r.onsuccess = r.onerror = updateSeekingState.bind(false);
  }

  function seekUp() {
    updateSeekingState(true);
    var r = mozFMRadio.seekUp();
    r.onsuccess = r.onerror = updateSeekingState.bind(false);
  }

  function setFrequency(frequency) {
    if (isSeeking()) {
      var r = mozFMRadio.cancelSeek();
      r.onsuccess = r.onerror = mozFMRadio.setFrequency.bind(frequency);
    } else {
      mozFMRadio.setFrequency(frequency);
    }
  }

  function enable(frequency) {
    if (mozFMRadio.enabled) {
      setFrequency(frequency);
      return;
    }

    updateEnablingState(true);

    var r = mozFMRadio.enable(frequency);
    r.onsuccess = function() {
      updateEnablingState(false);
      //updateEnabledState(true);
    }

    r.onerror = function() {
      updateEnablingState(false);
    }
  }

  function disable() {
    mozFMRadio.disable();
  }

  function togglePower() {
    if (mozFMRadio.enabled) {
      disable();
    } else {
      enable(frequencyDialer.getFrequency());
    }
  }

  mozFMRadio.onenabled = function() {
    updateEnablingState(false);
  };

  mozFMRadio.ondisabled = function() {
    updateEnablingState(false);
  };

  function updatePowerUI() {
    var enabled = mozFMRadio.enabled;
    if (enabled) {
      // ACCESSIBILITY - Must set data-l10n-id to reflect Off switch
      powerSwitch.setAttribute('data-l10n-id', 'power-switch-off');
    } else {
      // ACCESSIBILITY - Must set data-l10n-id to reflect On switch
      powerSwitch.setAttribute('data-l10n-id', 'power-switch-on');
    }

    powerSwitch.dataset.enabled = enabled;
  }

  function updateFrequencyBarUI() {
    var frequencyBar = $('frequency-bar');
    if (isEnabling()) {
      frequencyBar.classList.add('dim');
    } else {
      frequencyBar.classList.remove('dim');
    }
}

  return {
    seekDown: function() {
      if (isSeeking()) {
        var r = mozFMRadio.cancelSeek();
        r.onsuccess = r.onerror = seekDown;
      } else {
        seekDown();
      }
    },

    seekUp: function() {
      if (isSeeking()) {
        var r = mozFMRadio.cancelSeek();
        r.onsuccess = r.onerror = seekUp;
      } else {
        seekUp();
      }
    },

    setFrequency: setFrequency,
    enable: enable,
    isEnabling: isEnabling,
    disable: disable,

    togglePower: togglePower
  }
})();
