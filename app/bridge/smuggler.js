(function() {
  'use strict';

  function debug(str, args) {
    console.log.bind(console, '[smuggler]').apply(console, arguments);
  };

  // Config is an object populate by the application itself.
  var config = {};

  var kConfigTypes = {
    'Worker': Worker,
    'SharedWorker': SharedWorker,
    'ServiceWorker': function() {
      return navigator.serviceWorker.controller || new Boolean(false);
    },
    'Window': function(url) {
      var w = document.createElement('iframe');
      w.hidden = true;
      w.src = url;

      var ready = false;
      var events = [];
      w.addEventListener('load', function() {
        ready = true;

        for (var i = 0; i < events.length; i++) {
          w.contentWindow.postMessage(events[i], '*');
        }
        events = [];
      });

      setTimeout(function() {
        document.body.appendChild(w);
      });

      return {
        postMessage: function(msg) {
          if (ready) {
            w.contentWindow.postMessage(msg, '*');
          } else {
            events.push(msg);
          }
        },
        terminate: function() {
          w.src = "about:blank"; // trick to get an unload event in iframe
          document.body.removeChild(w);
          w = null;
        }
      }
    }
  };

  function getConfigForContract(name) {
    for (var url in config) {
      if (config[url].contracts.indexOf(name) != -1) {
        return {
          url: url,
          type: config[url].type
        }
      }
    }

    return null;
  }

  var channel = new BroadcastChannel('smuggler');
  channel.onmessage = function(msg) {
    switch (msg.data.name) {
      case 'register':
        register(msg.data);
        break;

      case 'unregister':
        unregister(msg.data);
        break;

      case 'config':
        config = msg.data.config;
        break;

      default:
        throw new Error('Not Implemented: ' + msg.data.name);
        break;
    }
  };

  // Registrations is a map of contracts, that has a list of clients
  // and who is the server.
  // It also contains the unique UUID used for the side-to-side
  // communications between one client and the server.
  //
  // This is more or less something like:
  //  {
  //    contract: {
  //      server: server_instance,
  //      clients: [uuid1, uuid2, ...]
  //    }
  //  }
  //
  // When the server is running the |server| state is set to the
  // server instance.
  // If |server| then the smuggler does not see datas that are
  // transferred.
  // If |!server| then the smuggler receive the data, start the
  // server using the defined configuration, and forward the request
  // before setting |server| to true and forget about the channel.
  //
  // In some special cases we would like to intercept messages even
  // if |server| is set to true.
  // For example we may want to be able to inspect the data
  // that are exchange between the client and the server and rewrite
  // them on the fly for debugging purpose.
  // Or if one of the client is not prioritary anymore (it may
  // happens if the client is a view, and this is not the view
  // that is currently visible to the user. Then we may want to
  // intercept those messages in order to delay them a little bit
  // to favor the server that is actively running.
  //
  var registrations = new Map();

  // Based on the configuration there could be multiple contracts
  // served by one end point. So if a server instance has already
  // started for a contract that is part of a group, let's return
  // this instance.
  function getInstanceForContract(name) {
    for (var url in config) {
      var contracts = config[url].contracts;
      if (contracts.indexOf(name) === -1) {
        continue;
      }

      for (var i = 0; i < contracts.length; i++) {
        if (!registrations.has(contracts[i])) {
          continue;
        }

        return registrations.get(contracts[i]).server;
      };
    }

    return null;
  }

  function registerContract(name) {
    if (registrations.has(name)) {
      return;
    }

    var registration = {
      server: getInstanceForContract(name),
      clients: []
    };

    registrations.set(name, registration);
  }

  function registerClientForContract(uuid, name) {
    registerContract(name);

    var registration = registrations.get(name);
    if (!clientAlreadyRegistered(uuid, name)) {
      registration.clients.push(uuid);
    }
  }

  function clientAlreadyRegistered(clientId, name) {
    for (var client of getClientsForContract(name)) {
      if (clientId === client) {
        return true;
      }
    }
    return false;
  }

  function unregisterClientForContract(uuid, name) {
    var registration = registrations.get(name);
    if (registration) {
      var index = registration.clients.indexOf(uuid);
      if (index > -1) {
        registration.clients.splice(index, 1);
      } else {
        debug('Cannot remove non-existing client ' + uuid + ' from ' + name);
      }
    } else {
      debug('Cannot remove client from non existing contract ' + name);
    }
  }

  function hasClientsForContract(name) {
    var registration = registrations.get(name);
    return !!registration.clients.length;
  }

  function getClientsForContract(name) {
    var registration = registrations.get(name);
    return registration.clients;
  }

  function registerServerForContract(server, name) {
    registerContract(name);

    var registration = registrations.get(name);
    registration.server = server;
  }

  function killServerForContract(server, name) {
    debug('Attempt to kill server ', name);
    // before terminating, we need to check if this server implements another contract
    var inUsed = false
    for (var [contract, otherReg] of registrations) {
      if (contract !== name && server === otherReg.server) {
        debug('Not killing because it is used elsewhere');
        inUsed = true;
        break;
      }
    }

    if (!inUsed && server.terminate) {
      debug('really kill', server);
      server.terminate();
    }
    // normally, we shouldn't have any client any more
    registrations.delete(name);
  }

  function hasServerForContract(name) {
    var registration = registrations.get(name);
    return registration && !!registration.server;
  }

  function hasServerReadyForContract(name) {
    var registration = registrations.get(name);
    return registration && !!registration.server && registration.server.ready;
  }

  function getServerForContract(name) {
    var registration = registrations.get(name);
    return registration.server;
  }

  function startServer(contract) {

    // check if a starting or started server
    // is already fullfilling this contract
    var server = getInstanceForContract(contract);
    if (!server) {
      // otherwise start it
      debug('startServer: Starting server for contract ', contract);
      var config = getConfigForContract(contract)
      if (!config) {
        debug('No config found for ', contract);
        return;
      }
      server = new kConfigTypes[config.type](config.url);
      server.registered = false;
    }

    // TODO: If the server is supposed to be hosted by a serviceWorker
    // that is not running, then we don't support lazy restart here.
    if (server == false) {
      return;
    }

    registerServerForContract(server, contract);
  }

  function registerClientToServer(contract, server, clientUuid) {
    server.postMessage({
      contract: contract,
      uuid: clientUuid,
      type: 'register'
    });
  }

  function unregisterClientToServer(contract, server, clientUuid) {
    server.postMessage({
      contract: contract,
      uuid: clientUuid,
      type: 'unregister'
    });
  }

  // TODO: Add version support
  var kEmptyRegistration = 'Empty registration are not allowed.';
  var kEmptyContract = 'Empty contract are not allowed.';
  var kUnknownRegistrationType = 'Unknown registration type.';
  function register(registration) {
    if (!registration) {
      throw new Error(kEmptyRegistration);
    }

    var contract = registration.contract;
    if (!contract) {
      throw new Error(kEmptyContract);
    }

    switch (registration.type) {
      case 'client':
        registerClientForContract(registration.uuid, contract);

        // TODO: Lazily start the server.
        // The server does not need to run if the client is not trying
        // to exchange any data. So the smuggler should first listen for
        // data coming over the communication channel before and once there
        // is some it can start the server and forward it the data before
        // dropping its own reference to the communication channel.
        // But for now we are lazy and start the server as soon the client
        // is connected.

        if (hasServerReadyForContract(contract)) {
          var server = getServerForContract(contract);
          registerClientToServer(contract, server, registration.uuid);
        } else {
          startServer(contract);
        }

        break;

      case 'server':

        if (hasServerForContract(contract)) {
          var server = getServerForContract(contract);
        } else {
          // it could be a service worker starting itself. register it
          startServer(contract);
        }

        // start can fail
        if (hasServerForContract(contract)) {
          var server = getServerForContract(contract);
          for (var client of getClientsForContract(contract)) {
            registerClientToServer(contract, server, client);
          }
          server.ready = true;
        }

        break;

      default:
        throw new Error(registration.type + ': ' + kUnknowRegistrationType);
        break;
    }
  };

  function unregister(registration) {
    if (!registration) {
      throw new Error(kEmptyRegistration);
    }

    var contract = registration.contract;
    if (!contract) {
      throw new Error(kEmptyContract);
    }

    switch (registration.type) {
      case 'client':
        var uuid = registration.uuid;
        debug('Unregistering client for contract ' + contract + ' with uuid ' + uuid);
        // unregister in the smuggler
        unregisterClientForContract(uuid, contract);
        if (hasServerReadyForContract(contract)) {
          // unregister in the server
          var server = getServerForContract(contract);
          unregisterClientToServer(contract, server, uuid);
        }
        break;
      case 'server':
        debug('Unregistering server for contract ', contract);
        if (hasServerForContract(contract)) {
          var server = getServerForContract(contract);
          server.ready = false;
          killServerForContract(server, contract);
        }
        break;
      default:
        throw new Error(registration.type + ': ' + kUnknowRegistrationType);
        break;
    }
  };

})();

