var Dialog = (function(document) {
  'use strict';

  function getDialog(url) {
    return document.getElementById(url);
  }

  return {
    open: function(url) {
      var dialog = getDialog(url);
      if (dialog) {
        return;
      }

      dialog = document.createElement('iframe');
      dialog.src = url;
      dialog.id = url;
      dialog.className = 'dialog';
      document.body.appendChild(dialog);
    },

    close: function(url) {
      var dialog = getDialog(url);
      if (!dialog) {
        return;
      }

      dialog.parentNode.removeChild(dialog);
    }
  }
})(window.top.document);

