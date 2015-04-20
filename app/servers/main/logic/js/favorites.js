'use strict';

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
    _container.addEventListener('click', function _onclick(event) {
      var frequency = self._getFrequency(event.target);
      if (!frequency) {
        return;
      }

      if (event.target.classList.contains('fav-list-remove-button')) {
        // Remove the item from the favorites list.
        self.remove(frequency);
        updateFreqUI();
      } else {
        // XXX Bitch! This needs to be done in the parent
        //selectFrequency(frequency);
      }
    });
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
    var item = $(this._getID(frequency));
    if (item) {
      favoritesAPI.remove(frequency);
      item.parentNode.removeChild(item);
    }
  },

  add: function(frequency) {
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

    favoritesAPI.add(frequency);
    return item;
  }
};
