'use strict';

Utils.importScript('../../../shared/js/promises.js');

var favoritesUI = {
  init: function() {
    var self = this;

    if (window.top.document.body.dataset.cached != 'true') {
      favoritesAPI.getAll().then(function(rv) {
        for (var frequency in rv) {
          self.add(parseFloat(frequency));
        }
      });
    }

    var _container = $('fav-list-container');
    this._onclickListener = function _onclick(event) {
      var frequency = self._getFrequency(event.target);
      if (!frequency) {
        return;
      }

      if (event.target.classList.contains('fav-list-remove-button')) {
        // Remove the item from the favorites list.
        self.remove(frequency);
        updateFreqUI();
      } else {
        selectFrequency(frequency);
      }
    };
    _container.addEventListener('click', this._onclickListener);
  },

  cleanup: function() {
    var _container = $('fav-list-container');
    _container.removeEventListener('click', this._onclickListener);
  },

  _getID: function(frequency) {
    return 'frequency-' + frequency;
  },

  _getFrequency: function(elem) {
    var isParentListItem = elem.parentNode.classList.contains('fav-list-item');
    var listItem = isParentListItem ? elem.parentNode : elem;
    return parseFloat(listItem.id.substring(listItem.id.indexOf('-') + 1));
  },


  select: function(frequency) {
    var items = $$('#fav-list-container div.fav-list-item');
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (this._getFrequency(item) == frequency) {
        item.classList.add('selected');
        item.setAttribute('aria-selected', true);
      } else {
        item.classList.remove('selected');
        item.setAttribute('aria-selected', false);
      }
    }
  },

  remove: function(frequency) {
    var promise = favoritesAPI.remove(frequency);
    promise.then(() => {
      var item = $(this._getID(frequency));
      if (item) {
        item.parentNode.removeChild(item);
      }
    }).catch((e) => {
      console.log('Cannot remove frequency: ' + e);
    });
    return promise;
  },

  add: function(frequency) {
    var deferred = Promises.defer();
    favoritesAPI.add(frequency).then(() => {
      var previous = $('frequency-' + frequency);
      if (previous) {
        deferred.resolve(previous);
      } else {
        deferred.resolve(this._addDomNode(frequency));
      }
    }).catch((e) => {
      console.log('Can\'t add dom node: ' + e);
      deferred.reject(e);
    });
    return deferred.promise;
  },

  _addDomNode: function fv_addDomNode(frequency) {
    var item = document.createElement('div');
    item.id = 'frequency-' + frequency;
    item.className = 'fav-list-item';
    item.setAttribute('role', 'option');
    item.innerHTML =
      '<div class="fav-list-frequency">' +
      frequency.toFixed(1) +
      '</div>' +
      '<div class="fav-list-remove-button"></div>';

    var container = $('fav-list-container');
    if (container.childNodes.length == 0) {
      container.appendChild(item);
      return item;
    }

    // keep list ascending sorted
    var childNodes = container.childNodes;
    for (var i = 0; i < childNodes.length; i++) {
      var child = childNodes[i];
      var elemFreq = this._getFrequency(child);

      if (frequency < elemFreq) {
        container.insertBefore(item, child);
        break;
      } else if (i == childNodes.length - 1) {
        container.appendChild(item);
        break;
      }
    }
    return item;
  }
};
