(function(exports) {
'use strict';

function ClientFactory(name, version) {
  return createNewClient(name, version);
}

const kErrors = {
  NotImplemented: 'Not Implemented.',
  NoPromise: 'No Promise Found.'
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

      var deferred = Promises.defer();
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

    this.server = null;
    this.connect();
  }

  ClientInternal.prototype.connect = function() {
    debug(this.uuid + ' [connect]');
    register(this.client, this.uuid);
    this.server = new BroadcastChannel(this.uuid);
    this.listen();
  };

  ClientInternal.prototype.onconnected = function(contract) {
    debug(this.uuid, ' [connected]');

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
    unregister(this.client, this.uuid);
  }

  ClientInternal.prototype.ondisconnected = function() {
    debug(this.client.name + ' [disconnected]');
    // unlisten
    for (var [fn, eventName] of this.server.listeners) {
      this.server.removeEventListener(eventName, fn);
    }
    // remove prototype
    mutatePrototype(this.client, null);
    this.server = null;
    this.connected = false;
  };

  ClientInternal.prototype.listen = function() {
    // we maintain a map of listener <-> event to be able to remove them
    this.server.listeners = new Map();
    var listener = e => this.onmessage(e);
    this.server.listeners.set(listener, 'message');
    this.server.addEventListener('message', listener);
  };

  ClientInternal.prototype.addEventListener = function(name, fn) {
    this.server.listeners.set(fn, 'broadcast:' + name);
    this.server.addEventListener('broadcast:' + name, fn);
  };

  ClientInternal.prototype.removeEventListener = function(name, fn) {
    this.server.removeEventListener('broadcast:' + name, fn);
  };

  ClientInternal.prototype.dispatchEvent = function(e) {
    this.server.dispatchEvent(e);
  };

  ClientInternal.prototype.send = function(packet) {
    debug(this.uuid, 'send', packet);
    this.server.postMessage(packet);
  };

  ClientInternal.prototype.request = function(method, args) {
    debug(this.uuid, 'request', method, args);

    var id = uuid();
    var packet = new Packet(id, method, args);
    this.send(packet);

    var deferred = Promises.defer()
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
    debug(this.uuid, 'on message', e, e.data);

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
    this.server.dispatchEvent(e);
  };

  ClientInternal.prototype.createInterface = function() {
    throw new Error(kErrors.NotImplemented);
  };

  ClientInternal.prototype.createPrototype = function(contract) {
    var prototype = {};
    for (var name in contract.methods) {
      var definition = contract.methods[name];
      debug(this.uuid, 'create method', name, definition);
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
    internal.disconnect();
  }

  Client.prototype.connect = function() {
    internal.connect();
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
