'use strict';

window.historyAPI = {
  save: function(frequency) {
    return fmHistory.ready().then(function() {
      fmHistory.add(frequency);
      return Promise.resolve(true);
    });
  },

  restore: function() {
    return fmHistory.ready().then(function() {
      var value = fmHistory.last() ? fmHistory.last().frequency : null;
      return Promise.resolve(value);
    });
  }
};


window.favoritesAPI = {
  getAll: function() {
    return favorites.ready().then(function() {
      return Promise.resolve(favorites.items);
    });
  },

  contains: function(frequency) {
    return Promise.resolve(favorites.contains(frequency));
  },

  remove: function(frequency) {
    return Promise.resolve(favorites.remove(frequency));
  },

  add: function(frequency) {
    return Promise.resolve(favorites.add(frequency));
  }
};
