'use strict';

var FrequencyRange = {
  unit: 2,
  _minFrequency: 0,
  _maxFrequency: 0,

  build: function(lower, upper) {
    this._prepare(lower, upper);
  },

  _prepare: function(lower, upper) {
    var unit = this.unit;
    this._minFrequency = lower - lower % unit;
    this._maxFrequency = upper + unit - upper % unit;
    var unitCount = (this._maxFrequency - this._minFrequency) / unit;

    for (var i = 0; i < unitCount; ++i) {
      var start = this._minFrequency + i * unit;
      start = start < lower ? lower : start;

      var end = this._maxFrequency + i * unit + unit;
      end = upper < end ? upper : end;

      this._addDialerUnit(start, end);
    }

    // cache the size of dialer
    var _dialerUnits = $$('#frequency-dialer .dialer-unit');
    var _dialerUnitWidth = _dialerUnits[0].clientWidth;
    this._dialerWidth = _dialerUnitWidth * _dialerUnits.length;
    this._space = this._dialerWidth /
                    (this._maxFrequency - this._minFrequency);

    for (var i = 0; i < _dialerUnits.length; i++) {
      _dialerUnits[i].style.left = i * _dialerUnitWidth + 'px';
    }
  },

  _addDialerUnit: function(start, end) {
    var markStart = start - start % this.unit;

    // At the beginning and end of the dial, some of the notches should be
    // hidden. To do this, we use an absolutely positioned div mask.
    // startMaskWidth and endMaskWidth track how wide that mask should be.
    var startMaskWidth = 0;
    var endMaskWidth = 0;

    // unitWidth is how wide each notch is that needs to be covered.
    var unitWidth = 16;

    var total = this.unit * 10;     // 0.1MHz
    for (var i = 0; i < total; i++) {
      var dialValue = markStart + i * 0.1;
      if (dialValue < start) {
        startMaskWidth += unitWidth;
      } else if (dialValue > end) {
        endMaskWidth += unitWidth;
      }
    }

    var container = document.createElement('div');
    container.classList.add('dialer-unit-mark-box');

    if (startMaskWidth > 0) {
      var markStart = document.createElement('div');
      markStart.classList.add('dialer-unit-mark-mask-start');
      markStart.style.width = startMaskWidth + 'px';

      container.appendChild(markStart);
    }

    if (endMaskWidth > 0) {
      var markEnd = document.createElement('div');
      markEnd.classList.add('dialer-unit-mark-mask-end');
      markEnd.style.width = endMaskWidth + 'px';

      container.appendChild(markEnd);
    }

    var width = (100 / this.unit) + '%';
    // Show the frequencies on dialer
    for (var j = 0; j < this.unit; j++) {
      var frequency = Math.floor(markStart) + j;
      var showFloor = frequency >= start && frequency <= end;

      var unit = document.createElement('div');
      unit.classList.add('dialer-unit-floor');
      if (!showFloor) {
        unit.classList.add('hidden-block');
      }
      unit.style.width = width;
      unit.appendChild(document.createTextNode(frequency));
      container.appendChild(unit);
    }

    var unit = document.createElement('div');
    unit.className = 'dialer-unit';
    unit.appendChild(container);
    $('frequency-dialer').appendChild(unit);
  },

  get space() {
    return this._space;
  },

  get minFrequency() {
      return this._minFrequency;
  }

};
