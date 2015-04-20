
contracts['rendercache'] = {
  methods: {
    save: {
      args: ['string', 'string']
    },
    evict: {
      args: ['string']
    }
  },

  events: {
    saved: 'undefined'
  }
};
