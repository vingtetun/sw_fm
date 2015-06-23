'use strict';

var topDoc = window.top.document;
var $ = topDoc.getElementById.bind(topDoc);
var $$ = topDoc.querySelectorAll.bind(topDoc);

var frequencyDialer = {
  _bandUpperBound: 0,
  _bandLowerBound: 0,
  _currentFrequency: 0,
  _translateX: 0,

  init: function() {
    this._initUI();
    this._addEventListeners();
  },

  cleanup: function() {
    if (this._removeEventListeners) {
      this._removeEventListeners();
    }
  },

  _addEventListeners: function() {
    function _removeEventListeners() {
      topDoc.body.removeEventListener('touchend', fd_body_touchend);
      topDoc.body.removeEventListener('touchmove', fd_body_touchmove);
    }

    function cloneEvent(evt) {
      if ('touches' in evt) {
        evt = evt.touches[0];
      }
      return { x: evt.clientX, y: evt.clientX,
               timestamp: evt.timeStamp };
    }

    var self = this;
    var SPEED_THRESHOLD = 0.1;
    var currentEvent, startEvent, currentSpeed;
    var tunedFrequency = 0;

    function toFixed(frequency) {
      return parseFloat(frequency.toFixed(1));
    }

    function _calcSpeed() {
      var movingSpace = startEvent.x - currentEvent.x;
      var deltaTime = currentEvent.timestamp - startEvent.timestamp;
      var speed = movingSpace / deltaTime;
      currentSpeed = parseFloat(speed.toFixed(2));
    }

    function _calcTargetFrequency() {
      return tunedFrequency - getMovingSpace() / FrequencyRange.space;
    }

    function getMovingSpace() {
      var movingSpace = currentEvent.x - startEvent.x;
      return movingSpace;
    }

    function fd_body_touchmove(event) {
      event.stopPropagation();
      currentEvent = cloneEvent(event);

      _calcSpeed();

      // move dialer
      var dialer = $('frequency-dialer');
      var translateX = self._translateX + getMovingSpace();
      self._translateX = translateX;
      var count = dialer.childNodes.length;
      for (var i = 0; i < count; i++) {
        var child = dialer.childNodes[i];
        child.style.MozTransform = 'translateX(' + translateX + 'px)';
      }

      tunedFrequency = _calcTargetFrequency();
      var roundedFrequency = Math.round(tunedFrequency * 10) / 10;

      if (roundedFrequency != self._currentFrequency) {
        self.setFrequency(toFixed(roundedFrequency), true);
      }

      startEvent = currentEvent;
    }

    function fd_body_touchend(event) {
      event.stopPropagation();
      _removeEventListeners();

      // Add animation back
      $('frequency-dialer').classList.add('animation-on');
      // Add momentum if speed is higher than a given threshold.
      if (Math.abs(currentSpeed) > SPEED_THRESHOLD) {
        var direction = currentSpeed > 0 ? 1 : -1;
        tunedFrequency += Math.min(Math.abs(currentSpeed) * 3, 3) * direction;
      }
      tunedFrequency = self.setFrequency(toFixed(tunedFrequency));
      cancelSeekAndSetFreq(tunedFrequency);

      // Reset vars
      currentEvent = null;
      startEvent = null;
      currentSpeed = 0;
    }

    function fd_touchstart(event) {
      event.stopPropagation();

      // Stop animation
      $('frequency-dialer').classList.remove('animation-on');

      startEvent = currentEvent = cloneEvent(event);
      tunedFrequency = self._currentFrequency;

      _removeEventListeners();
      topDoc.body.addEventListener('touchmove', fd_body_touchmove);
      topDoc.body.addEventListener('touchend', fd_body_touchend);
    }

    function fd_key(event) {
      if (event.keyCode === event.DOM_VK_UP) {
        tunedFrequency = self._currentFrequency + 0.1;
      } else if (event.keyCode === event.DOM_VK_DOWN) {
        tunedFrequency = self._currentFrequency - 0.1;
      } else {
        return;
      }

      tunedFrequency = self.setFrequency(toFixed(tunedFrequency));
      cancelSeekAndSetFreq(tunedFrequency);
    }

    var dialerContainer = $('dialer-container');
    dialerContainer.addEventListener('touchstart', fd_touchstart);
    // ACCESSIBILITY - Add keypress event for screen reader
    dialerContainer.addEventListener('keypress', fd_key);

    // this method will be used to clean up stuff.
    this._removeEventListeners = () => {
      _removeEventListeners();
      dialerContainer.removeEventListener('touchstart', fd_touchstart);
      dialerContainer.removeEventListener('keypress', fd_key);
    };
  },

  _initUI: function() {
    this._bandLowerBound = mozFMRadio.frequencyLowerBound;
    this._bandUpperBound = mozFMRadio.frequencyUpperBound;

    if (topDoc.body.dataset.cached != 'true') {
      $('frequency-dialer').innerHTML = '';
      FrequencyRange.build(this._bandLowerBound, this._bandUpperBound);
    }
  },


  _updateUI: function(frequency, ignoreDialer) {
    $('frequency').textContent = frequency.toFixed(1);

    if (ignoreDialer) {
      return;
    }

    this._translateX = (FrequencyRange.minFrequency - frequency) * FrequencyRange.space;
    var dialer = $('frequency-dialer');
    var count = dialer.childNodes.length;
    for (var i = 0; i < count; i++) {
      dialer.childNodes[i].style.MozTransform =
        'translateX(' + this._translateX + 'px)';
    }
    $('dialer-container').setAttribute('aria-valuenow', frequency);
  },

  setFrequency: function(frequency, ignoreDialer) {
    if (frequency < this._bandLowerBound) {
      frequency = this._bandLowerBound;
    }

    if (frequency > this._bandUpperBound) {
      frequency = this._bandUpperBound;
    }

    this._currentFrequency = frequency;
    this._updateUI(frequency, ignoreDialer);

    return frequency;
  },

  getFrequency: function() {
    return this._currentFrequency;
  }
};

/**
 * If the FM radio is seeking currently, cancel it and then set frequency.
 *
 * @param {freq} frequency set.
 */
function cancelSeekAndSetFreq(frequency) {
  function setFreq() {
    mozFMRadio.setFrequency(frequency);
  }

  var seeking = !!$('power-switch').getAttribute('data-seeking');
  if (!seeking) {
    setFreq();
  } else {
    var request = mozFMRadio.cancelSeek();
    request.onsuccess = setFreq;
    request.onerror = setFreq;
  }
}
