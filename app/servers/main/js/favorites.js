'use strict';

importScripts('js/async_storage.js');
importScripts('../../shared/js/promises.js');

const kErrors = {
  SaveError: 'Cannot save the favorites'
};

const kSuccess = {
  AlreadyAdded: 'Already added',
  AlreadyDeleted: 'Already deleted'
};

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
    var deferred = Promises.defer();
    asyncStorage.setItem(
      this.KEYNAME,
      this.items,
      () => deferred.resolve(),
      (e) => {
        console.log(e);
        deferred.reject(kErrors.SaveError);
      }
    );
    return deferred.promise;
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

      return this._save();
    } else {
      return Promise.resolve(kSuccess.AlreadyAdded);
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
    if (exists) {
      delete this.items[freq];
      return this._save();
    } else {
      return Promise.resolve(kSuccess.AlreadyDeleted);
    }
  }
};

