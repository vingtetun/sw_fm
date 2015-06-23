(function(exports) {
'use strict';

function ClientFactory(name, version) {
  return createNewClient(name, version);
}

const kErrors = {
  NotImplemented: 'Not Implemented.',
  NoPromise: 'No Promise Found.',
  CurrentlyConnecting: 'Currently connecting.',
  CurrentlyDisconnecting: 'Currently disconnecting',
  Disconnected: 'We have been disconnected!'
}

function createNewClient(name, version) {
  /*
   * Global variables
   */
  // request that needs to be sent when receiving the connected event
  var pendings = {};
  // waiting for an answer
  var waitings = {};


  /*
   * Registration
   */
  function register(client, uuid) {
    var kRegistrationChannelName = 'smuggler';
    var smuggler = new BroadcastChannel(kRegistrationChannelName);
    smuggler.postMessage({
      name: 'register',
      type: 'client',
      contract: client.name,
      version: client.version,
      uuid: uuid
    });
    smuggler.close();
  }

  function unregister(client, uuid) {
    var kRegistrationChannelName = 'smuggler';
    var smuggler = new BroadcastChannel(kRegistrationChannelName);
    smuggler.postMessage({
      name: 'unregister',
      type: 'client',
      contract: client.name,
      version: client.version || '',
      uuid: uuid
    });
    smuggler.close();
  }


  /*
   * Packet
   */
  function Packet(id, method, args) {
    return {
      uuid: id,
      method: method,
      args: args,
    };
  }


   /*
   * Deferred
   */
  function Deferred() {
    var deferred = {};
    deferred.promise = new Promise(function(resolve, reject) {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });
    return deferred;
  }

  /*
   * RemotePrototype
   */
  function RemotePrototype(original) {
    var self = this;

    var prototype = {
      get: function(target, method) {
        return self.invoke(original, method);
      }
    };

    return new Proxy({}, prototype);
  }

  RemotePrototype.prototype.invoke = function(original, method) {
    return function() {

      // If the proxy method is used for event handling, ensure that
      // it will call the new prototype.
      if (method in original) {
        original[method].apply(original, arguments);
        return;
      }

      var id = uuid();
      var packet = new Packet(id, method, [].slice.call(arguments));

      var deferred = new Deferred();
      pendings[id] = {
        packet: packet,
        deferred: deferred
      }
      return deferred.promise;
    }
  };

  /*
   * ClientInternal
   */
  function ClientInternal(client) {
    this.client = client;
    this.uuid = uuid();

    this.serverChannel = null;

    this.connected = false;
    this.connectionDeferred = null;
    this.disconnectionDeferred = null;

    this.connect();
  }

  ClientInternal.prototype.connect = function() {
    debug(this.client.name, this.uuid + ' [connect]');

    if (this.connected) {
      return Promise.resolve();
    } else if (this.disconnectionDeferred) {
      // wait for complete disconnection before trying to connect
      debug(this.client.name, this.uuid, 'trying to reconnect');
      return this.disconnectionDeferred.promise.then(() => this.connect());
    } else if (this.connectionDeferred) {
      return this.connectionDeferred.promise;
    } else {
      this.connectionDeferred = new Deferred();
      register(this.client, this.uuid);
      // It might not be the first time we connect
      if (!this.serverChannel) {
        this.serverChannel = new BroadcastChannel(this.uuid);
        this.listen();
      }
      return this.connectionDeferred.promise;
    }
  };

  ClientInternal.prototype.onconnected = function(contract) {
    debug(this.client.name, this.uuid, ' [connected]');
    // we might not be waiting for connection
    if (this.connectionDeferred) {
      this.connectionDeferred.resolve();
    }
    this.connectionDeferred = null;

    if (!this.connected) {
      this.connected = true;

      for (var id in pendings) {
        this.send(pendings[id].packet);
        waitings[id] = pendings[id].deferred;
      }

      mutatePrototype(this.client, this.createPrototype(contract));
    }
  };

  ClientInternal.prototype.disconnect = function() {
    debug(this.client.name + ' [disconnect]');
    if (!this.connected) {
      return Promise.resolve();
    }
    if (this.connectionDeferred) {
      // we reject disconnection request if we are connecting
      // to avoid losing any calls
      return Promise.reject(kErrors.CurrentlyConnecting);
    } else if (this.disconnectionDeferred) {
      return this.disconnectionDeferred.promise;
    } else {
      this.disconnectionDeferred = new Deferred();
      unregister(this.client, this.uuid);
      return this.disconnectionDeferred.promise;
    }
  }

  ClientInternal.prototype.ondisconnected = function() {
    debug(this.client.name + ' [disconnected]');
    // unlisten
    if (this.connected) {
      this.connected = false;
      // remove prototype
      mutatePrototype(this.client, null);
    }

    if (this.disconnectionDeferred) {
      this.disconnectionDeferred.resolve();
    } else if (this.connectionDeferred) {
      this.connectionDeferred.reject(kErrors.Disconnected);
    }

    this.connectionDeferred = null;
    this.disconnectionDeferred = null;
  };

  ClientInternal.prototype.listen = function() {
    this.serverChannel.addEventListener('message', e => this.onmessage(e));
  };

  ClientInternal.prototype.addEventListener = function(name, fn) {
    this.serverChannel.addEventListener('broadcast:' + name, fn);
  };

  ClientInternal.prototype.removeEventListener = function(name, fn) {
    this.serverChannel.removeEventListener('broadcast:' + name, fn);
  };

  ClientInternal.prototype.dispatchEvent = function(e) {
    this.serverChannel.dispatchEvent(e);
  };

  ClientInternal.prototype.send = function(packet) {
    debug(this.client.name, this.uuid, 'send', packet);
    this.serverChannel.postMessage(packet);
  };

  ClientInternal.prototype.request = function(method, args) {
    debug(this.uuid, 'request', method, args);

    var id = uuid();
    var packet = new Packet(id, method, args);
    this.send(packet);

    var deferred = new Deferred();
    waitings[id] = deferred;
    return deferred.promise;
  };

  ClientInternal.prototype.onresponse = function(packet) {
    debug(this.uuid, 'on response', packet);

    var id = packet.uuid;
    var promise = waitings[id];
    if (!promise) {
      throw new Error(kErrors.NoPromise);
    }
    delete waitings[id];

    promise.resolve(packet.result);
  };

  ClientInternal.prototype.onmessage = function(e) {
    debug(this.client.name, this.uuid, 'on message', e.data);

    switch (e.data.type) {
      case 'connected':
        this.onconnected(e.data.interface);
        break;

      case 'disconnected':
        this.ondisconnected();
        break;

      case 'broadcast':
        this.onbroadcast(e.data);
        break;

      default:
        this.onresponse(e.data);
        break;
    }
  };

  ClientInternal.prototype.onbroadcast = function(packet) {
    debug(this.uuid, 'on broadcast', packet);

    var e = new CustomEvent('broadcast:' + packet.name);
    e.data = packet.data;
    this.serverChannel.dispatchEvent(e);
  };

  ClientInternal.prototype.createInterface = function() {
    throw new Error(kErrors.NotImplemented);
  };

  ClientInternal.prototype.createPrototype = function(contract) {
    var prototype = {};
    for (var name in contract.methods) {
      var definition = contract.methods[name];
      debug(this.client.name, this.uuid, 'create method', name, definition);
      prototype[name] = createMethod(name, definition);
    }

    var self = this;
    function createMethod(name, definition) {
      return function() {
        // XXX Most of those checks should be performed on the server side.
        var args = [].slice.call(arguments);
        var invalidLength = args.length !== definition.args.length;
        var invalidType = !typesMatch(args, definition.args);
        if (invalidLength || invalidType) {
          throw new Error(name + '() called with invalid argument');
        }

        return self.request(name, args);
      };
    }

    return prototype;
  };


  /*
   * Client
   */
  function Client(name, version) {
    this.name = name;
    this.version = version;

    mutatePrototype(this, new RemotePrototype(this));
  };

  Client.prototype.addEventListener = function(name, fn) {
    internal.addEventListener(name, fn);
  };

  Client.prototype.removeEventListener = function(name, fn) {
    internal.removeEventListener(name, callback);
  };

  Client.prototype.disconnect = function() {
    return internal.disconnect();
  }

  Client.prototype.connect = function() {
    return internal.connect();
  }

  var client = new Client(name, version);
  var internal = new ClientInternal(client);

  return client;
}


/*
 * Utils
 */

function debug() {
  //console.log.bind(console, '[client]').apply(console, arguments);
}

function mutatePrototype(object, prototype) {
  Object.setPrototypeOf(Object.getPrototypeOf(object), prototype);
}

function typesMatch(args, types) {
  for (var i = 0, l = args.length; i < l; i++) {
    if (typeof args[i] !== types[i]) {
      return false;
    }
  }

  return true;
}

function uuid(){
  var timestamp = Date.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    function onEachCharacter(c) {
      var r = (timestamp + Math.random() * 16) % 16 | 0;
      timestamp = Math.floor(timestamp / 16);
      return (c == 'x' ? r : (r&0x7|0x8)).toString(16);
    }
  );
}

exports.Client = ClientFactory;
})(this);
