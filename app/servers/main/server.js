'use strict';

importScripts('../../bridge/server.js');

var s1 = new Server('main', '1.0', {
  ping: function() {
    return 'pong';
  }
});


importScripts('js/history.js');
var s2 = new Server('history', '1.0', {
  save: function(frequency) {
    return history.ready().then(function() {
      history.add(frequency);
      return true;
    });
  },

  restore: function() {
    return history.ready().then(function() {
      return history.last() ? history.last().frequency : null;
    });
  }
});


importScripts('js/favorites.js');
var s3 = new Server('favorites', '1.0', {
  getAll: function() {
    return favorites.ready().then(function() {
      return favorites.items;
    });
  },

  contains: function(frequency) {
    return favorites.contains(frequency);
  },

  remove: function(frequency) {
    return favorites.remove(frequency);
  },

  add: function(frequency) {
    return favorites.add(frequency);
  }
});
