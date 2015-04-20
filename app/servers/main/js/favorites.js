'use strict';

importScripts('js/async_storage.js');

var favorites = {
  items: null,

  KEYNAME: 'favlist',

  ready: function() {
    var self = this;
    return new Promise(function(resolve, reject) {
      self.init(resolve);
    });
  },

  _started: false,
  init: function(callback) {
    if (this._started) {
      callback(true);
    }

    var self = this;
    asyncStorage.getItem(this.KEYNAME, function storage_getItem(value) {
      self.items = value || {};
      self._started = true;
      callback(true);
    });
  },

  _save: function() {
    asyncStorage.setItem(this.KEYNAME, this.items);
  },

  /**
   * Check if frequency is in fav list.
   *
   * @param {number} frequence to check.
   *
   * @return {boolean} True if freq is in fav list.
   */
  contains: function(frequency) {
    return frequency in this.items;
  },

  /**
   * Add frequency to fav list.
   */
  add: function(freq) {
    if (!this.contains(freq)) {
      this.items[freq] = {
        name: freq + '',
        frequency: freq
      };

      this._save();
    }
  },

  /**
   * Remove frequency from fav list.
   *
   * @param {number} freq to remove.
   *
   * @return {boolean} True if freq to remove is in fav list.
   */
  remove: function(freq) {
    var exists = this.contains(freq);
    delete this.items[freq];
    this._save();
    return exists;
  }
};

