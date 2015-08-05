(function(exports) {
'use strict';

function ClientFactory(name, version) {
  return createNewClient(name, version);
}

const kErrors = {
  NotImplemented: 'Not Implemented.',
  NoPromise: 'No Promise Found.',
  Disconnected: 'Client has been disconnected',
  Connecting: 'Client currently connecting'
}

const kSuccesses = {
  Connected: 'Connected',
  Disconnected: 'Disconnected'
}

const kStates = {
  Disconnected: 0,
  Connecting: 1,
  Connected: 2,
  Disconnecting: 3
}

function createNewClient(name, version) {
  /*
   * Global variables
   */
  // request that needs to be sent when receiving the connected event
  var pendings = {};
  // waiting for an answer
  var runnings = {};

  function sendToSmuggler(clientInternal, command) {
    var kRegistrationChannelName = 'smuggler';
    var smuggler = new BroadcastChannel(kRegistrationChannelName);
    smuggler.postMessage({
      name: command,
      type: 'client',
      contract: clientInternal.client.name,
      version: clientInternal.client.version,
      uuid: clientInternal.uuid
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

    this.server = null;

    this.state = kStates.Disconnected;
    // deferred for connection and disconnection
    this.connectionDeferred = null;

    this.connect();
  }

  ClientInternal.prototype.register = function() {
    sendToSmuggler(this, 'register');
  };

  ClientInternal.prototype.unregister = function() {
    sendToSmuggler(this, 'unregister');
  };

  ClientInternal.prototype.connect = function() {
    debug(this.client.name, this.uuid + ' [connect]');

    switch (this.state) {
      case kStates.Connected:
        return Promise.resolve(kSuccesses.Connected);
      case kStates.Connecting:
        return this.connectionDeferred.promise;
      case kStates.Disconnecting:
        return this.connectionDeferred.promise.then(() => this.connect());
      case kStates.Disconnected:
        this.state = kStates.Connecting;
        this.connectionDeferred = new Deferred();
        this.register();
        // It might not be the first time we connect
        this.server = new BroadcastChannel(this.uuid);
        this.listen();
        return this.connectionDeferred.promise;
      default:
        throw new Error('Unsupported state: ' + this.state);
        break;
    }
  };

  ClientInternal.prototype.onconnected = function(contract) {
    debug(this.client.name, this.uuid, ' [connected]');
    this.connectionDeferred.resolve(kSuccesses.Connected);
    this.connectionDeferred = null;

    if (this.state !== kStates.Connected) {
      this.state = kStates.Connected;

      for (var id in pendings) {
        this.send(pendings[id].packet);
        runnings[id] = pendings[id].deferred;
      }

      mutatePrototype(this.client, this.createPrototype(contract));
    }
  };

  ClientInternal.prototype.disconnect = function() {
    debug(this.client.name + ' [disconnect]');
    switch (this.state) {
      case kStates.Disconnected:
        return Promise.resolve(kSuccesses.Disconnected);
      case kStates.Connecting:
        // we reject disconnection request if we are connecting
        // to avoid losing any calls
        return Promise.reject(kErrors.Connecting);
      case kStates.Disconnecting:
        return this.connectionDeferred.promise;
      case kStates.Connected:
        this.state = kStates.Disconnecting;
        this.connectionDeferred = new Deferred();
        this.unregister();
        return this.connectionDeferred.promise;
      default:
        throw new Error('Unsupported state: ' + this.state);
        break;
    }
  }

  ClientInternal.prototype.ondisconnected = function() {
    debug(this.client.name + ' [disconnected]');

    switch (this.state) {
      case kStates.Disconnected:
        // nothing to do :-)
        break;
      case kStates.Connecting:
        this.connectionDeferred.reject(kErrors.Disconnected);
        break;
      // we should not receive disconnected without requesting it, but...
      case kStates.Connected:
      case kStates.Disconnecting:
        // unlisten
        for (var [fn, eventName] of this.listeners) {
          this.server.removeEventListener(eventName, fn);
        }
        this.listeners = new Map();
        // trash runnings jobs
        for (var id in runnings) {
          runnings[id].reject(kErrors.Disconnected);
          delete runnings[id];
        }
        // remove prototype
        mutatePrototype(this.client, null);
        this.server.close();
        this.server = null;
        this.state = kStates.Disconnected;
        if (this.connectionDeferred) {
          this.connectionDeferred.resolve(kSuccesses.Disconnected);
        }
        break;
      default:
        throw new Error('Unsupported state: ' + this.state);
        break;
    }
  };

  ClientInternal.prototype.listen = function() {
    // we maintain a map of listener <-> event to be able to remove them
    this.listeners = new Map();
    var listener = e => this.onmessage(e);
    this.listeners.set(listener, 'message');
    this.server.addEventListener('message', listener);
  };

  ClientInternal.prototype.addEventListener = function(name, fn) {
    this.listeners.set(fn, 'broadcast:' + name);
    this.server.addEventListener('broadcast:' + name, fn);
  };

  ClientInternal.prototype.removeEventListener = function(name, fn) {
    this.server.removeEventListener('broadcast:' + name, fn);
  };

  ClientInternal.prototype.dispatchEvent = function(e) {
    this.server.dispatchEvent(e);
  };

  ClientInternal.prototype.send = function(packet) {
    debug(this.client.name, this.uuid, 'send', packet);
    this.server.postMessage(packet);
  };

  ClientInternal.prototype.request = function(method, args) {
    debug(this.uuid, 'request', method, args);

    var id = uuid();
    var packet = new Packet(id, method, args);
    this.send(packet);

    var deferred = new Deferred();
    runnings[id] = deferred;
    return deferred.promise;
  };

  ClientInternal.prototype.onresponse = function(packet) {
    debug(this.uuid, 'on response', packet);

    var id = packet.uuid;
    var promise = runnings[id];
    if (!promise) {
      throw new Error(kErrors.NoPromise);
    }
    delete runnings[id];

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
