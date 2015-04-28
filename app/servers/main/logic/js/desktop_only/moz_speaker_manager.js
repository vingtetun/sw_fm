'use strict';

// XXX fake SpeakerManager object for UI testing on PC
(function(aGlobal) {
  // XXX Does not work without permissions

  aGlobal.SpeakerManager = aGlobal.SpeakerManager || aGlobal.MozSpeakerManager;

  if (aGlobal.SpeakerManager)
    return;


  function SpeakerManager() {
    this.speakerforced = false;
  }

  SpeakerManager.prototype = {
    set forcespeaker(enable) {
      if (this.speakerforced != enable) {
        this.speakerforced = enable;
        if (this.onspeakerforcedchange) {
          this.onspeakerforcedchange();
        }
      }
    }
  };

  aGlobal.SpeakerManager = SpeakerManager;
})(window);

