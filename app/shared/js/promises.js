'use strict'

var Promises = {

  /**
   * Returns object that contains promise and related resolve\reject methods
   * to avoid wrapping long or complex code into single Promise constructor.
   * @returns {{promise: Promise, resolve: function, reject: function}}
   */
  defer: function() {
    var deferred = {};

    deferred.promise = new Promise(function(resolve, reject) {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });

    return deferred;
  }
}
