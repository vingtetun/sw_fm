(function(exports) {
'use strict';

function ServerFactory(name, version, methods) {
  return createServer(name, version, methods);
}

const kErrors = {
  ContractNotImplemented: 'Contract method not implemented: ',
  ContractNotDeclared: 'Method not defined in the contract: '
};

/*
  This object will be fed lazyly with server contracts.
*/
self.contracts = self.contracts || {};

function createServer(name, version, methods) {
  /*
   * ServerInternal
   */
  function ServerInternal(server, methods) {
    this.server = server;
    this.methods = methods;

    this.enforceContract();

    this.ports = [];

    this.listen();
    // the server register itself when it is ready
    this.register();
  }

  ServerInternal.prototype.onglobalmessage = function(data) {
    if (data.contract !== this.server.name) {
      return;
    }

    if (data.type === 'register') {
      this.registerClient(data.uuid);
    } else if (data.type === 'unregister') {
      this.unregisterClient(data.uuid);
    }
  };

  ServerInternal.prototype.registerClient = function(id) {
    debug('Registering client ' + id);
    var channel = new BroadcastChannel(id);
    this.ports.push(channel);

    channel.postMessage({
      type: 'connected',
      interface: this.getContract()
    });

    // we keep a ref to the listener to be able to remove it.
    channel.onMessageListener = e => {this.onmessage.call(this, channel, e.data);};
    channel.addEventListener(
      'message',
      channel.onMessageListener
    );
  };

  ServerInternal.prototype.unregisterClient = function(id) {
    debug('Unregistering client ' + id);
    // find the old channel and remove it from this.ports
    var index = 0;
    while (index < this.ports.length && this.ports[index].name !== id) {
      index++;
    }

    if (index < this.ports.length) {
      var removedChannel = this.ports.splice(index, 1)[0];
      removedChannel.removeEventListener('message', removedChannel.onMessageListener);
      // tell the client it's getting disconnected
      // Technically, we don't need to do that, but the client could have pending requests
      // when it disconnected. Sending a disconnected event make this client able to still deal
      // with response it might receive between the disconnection request and the disconnected event.
      removedChannel.postMessage({
        type: 'disconnected',
        interface: this.getContract()
      });
      removedChannel.close();
    } else {
      debug('Couldn\'t find any client to remove with id ', id);
    }
  };

  ServerInternal.prototype.onmessage = function(port, data) {
    debug('onmessage: ', data);

    var fn = this.methods[data.method];
    if (!fn) {
      throw new Error(kErrors.ContractNotDeclared + data.method);
    }

    var args = data.args || [];

    data.port = port;
    Promise.resolve(fn.apply(null, args)).then((result) => {
      this.respond(data, result);
    });
  };

  ServerInternal.prototype.respond = function(request, result) {
    debug('respond', result);

    var response = request;
    response.result = result;
    this.send(response);
  };

  ServerInternal.prototype.send = function(data) {
    var port = data.port;
    delete data.port;
    port.postMessage(data);
  };

  ServerInternal.prototype.broadcast = function(packet) {
    this.ports.forEach(port => port.postMessage(packet));
  };

  ServerInternal.prototype.listen = function() {
    addEventListener('message', e => this.onglobalmessage(e.data));
  };

  ServerInternal.prototype.register = function() {
    debug(this.server.name + ' [connect]');
    var smuggler = new BroadcastChannel('smuggler');
    smuggler.postMessage({
      name: 'register',
      type: 'server',
      contract: this.server.name,
      version: this.server.version,
    });
    smuggler.close();

  }

  ServerInternal.prototype.enforceContract = function() {
    var contract = this.getContract();

    // Ensure that all contracts methods are implemented.
    for (var method in contract.methods) {
      if (!(method in this.methods)) {
        throw new Error(kErrors.ContractNotImplemented + method);
      }
    };

    // Ensure that only contracts methods are implemented.
    for (var method in this.methods) {
      if (!(method in contract.methods)) {
        throw new Error(kErrors.ContractNotDeclared + method);
      }
    }
  };

  ServerInternal.prototype.getContract = function() {
    if (!(this.server.name in self.contracts)) {
      importScripts('contracts/' + this.server.name + '.js');
    }

    return self.contracts[this.server.name];
  };


  /*
   * Server
   */
  function Server(name, version) {
    this.name = name;
    this.version = version;
  }

  Server.prototype.broadcast = function(name, data) {
    internal.broadcast({
      type: 'broadcast',
      name: name,
      data: data
    });
  };

  var server = new Server(name, version);
  var internal = new ServerInternal(server, methods);

  return server;
}


/*
 * Utils
 */
function debug() {
  //console.log.bind(console, '[server]').apply(console, arguments);
}


exports.Server = ServerFactory;
})(this);
