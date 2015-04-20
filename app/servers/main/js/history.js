'use strict';

importScripts('js/async_storage.js');

var history = {
  _historyList: [],

  /**
   * Storage key name.
   * @const
   * @type {string}
   */
  KEYNAME: 'historylist',

  /**
   * Maximum size of the history
   * @const
   * @type {integer}
   */
  SIZE: 1,

  ready: function() {
    var self = this;
    return new Promise(function(resolve, reject) {
      self.init(resolve);
    });
  },

  started: false,
  init: function hl_init(callback) {
    if (this.started) {
      callback();
    }

    var self = this;
    asyncStorage.getItem(this.KEYNAME, function history_getItem(value) {
      self._historyList = value || [];
      self.started = true;
      callback();
    });
  },

  _save: function hl_save() {
    asyncStorage.setItem(this.KEYNAME, this._historyList);
  },

  /**
   * Add frequency to history list.
   *
   * @param {freq} frequency to add.
   */
  add: function hl_add(freq) {
    if (freq == null)
      return;

    var self = this;
    self._historyList.push({
      name: freq + '',
      frequency: freq
    });

    if (self._historyList.length > self.SIZE) {
      self._historyList.shift();
    }

    self._save();
  },

  /**
   * Get the last frequency tuned
   *
   * @return {freq} the last frequency tuned.
   */
  last: function hl_last() {
    if (this._historyList.length == 0) {
      return null;
    }

    return this._historyList[this._historyList.length - 1];
  }
};

