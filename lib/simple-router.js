(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define("SimpleRouter", ["exports", "path-to-regexp", "history"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require("path-to-regexp"), require("history"));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.pathToRegexp, global.history);
    global.SimpleRouter = mod.exports;
  }
})(this, function (exports, _pathToRegexp, _history) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  var _pathToRegexp2 = _interopRequireDefault(_pathToRegexp);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  function _toConsumableArray(arr) {
    if (Array.isArray(arr)) {
      for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
        arr2[i] = arr[i];
      }

      return arr2;
    } else {
      return Array.from(arr);
    }
  }

  var isPromise = function isPromise(type) {
    return typeof type.then === "function";
  },
      EventEmitterProto = {
    on: function on(event, handler) {
      var handlers = this.handlers[event] || (this.handlers[event] = []),
          h = { event: event, handler: handler };
      handlers.push(h);
      return {
        dispose: function dispose() {
          var index = handlers.indexOf(h);
          if (index !== -1) {
            handlers.splice(index, 1);
          }
        }
      };
    },
    once: function once(event, handler) {
      var subs = void 0;
      subs = this.on(event, function () {
        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        subs.dispose();
        handler.apply(undefined, [event].concat(args));
      });
    },
    emit: function emit(event) {
      for (var _len2 = arguments.length, args = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        args[_key2 - 1] = arguments[_key2];
      }

      var handlers = this.handlers[event] || [];
      handlers.forEach(function (h) {
        h.handler.apply(h, [event].concat(_toConsumableArray(args)));
      });
    }
  },
      createEventEmitter = function createEventEmitter() {
    return Object.create(EventEmitterProto, {
      handlers: {
        value: {}
      }
    });
  },
      createHistory = function createHistory(type, options) {
    var history = void 0;
    switch (type) {
      case "browser":
        history = (0, _history.createBrowserHistory)(options);
        break;
      case "hash":
        history = (0, _history.createHashHistory)(options);
        break;
      case "memory":
        history = (0, _history.createMemoryHistory)(options);
        break;
      default:
        history = (0, _history.createHashHistory)(options);
    }
    return history;
  },
      routerDefaults = {
    type: "hash",
    hashType: "slash",
    getUserConfirmation: function getUserConfirmation(message, callback) {
      callback(true);
      /*
      setTimeout(() => {
        const val = !!Math.round(Math.random());
        console.log(message, val);
        callback(val);
      }, 1000);
      */
    },
    block: function block(location, action) {
      return "Are you sure you want to leave this page?";
    }
  },
      RouterProto = {
    on: function on(evt, handler) {
      this.emitter.on(evt, handler);
    },
    matches: function matches(path) {
      return this.routes.some(function (route) {
        return route.pattern.test(path);
      });
    },
    match: function match(path) {
      var params = void 0,
          matchedRoute = void 0;
      this.routes.some(function (route) {
        var res = route.pattern.exec(path);
        if (res) {
          matchedRoute = route;
          params = {};
          route.keys.forEach(function (key, i) {
            params[key.name] = res[i + 1];
          });
          return true;
        }
        return false;
      });
      if (matchedRoute) {
        return {
          path: path,
          params: params,
          controller: matchedRoute.controller
        };
      }
      return null;
    },
    resolve: function resolve(path /*, context = {}*/) {
      var _this = this;

      var routeInfo = this.match(path);
      if (routeInfo) {
        var ctx = {
          route: {
            path: routeInfo.path,
            params: routeInfo.params
          }
        };
        this.emitter.emit("before-route", path);
        var ret = routeInfo.controller(ctx);
        if (!isPromise(ret)) {
          ret = Promise.resolve(ret);
        }
        ret.then(function (retVal) {
          _this.current = routeInfo;
          return retVal;
        }).then(function (retVal) {
          return _this.emitter.emit("route", retVal);
        }, function (rErr) {
          return _this.emitter.emit("route-error", rErr);
        });
        return ret;
      }
      return Promise.reject({
        message: "Route not found " + path,
        path: path
      });
    },
    route: function route(path) {
      this.history.push(path);
    },
    start: function start(listener) {
      var _this2 = this;

      if (!this.history) {
        var options = this.options,
            history = this.history = createHistory(options.type, options);
        history.block(options.block);
        this.stopHistoryListener = history.listen(function (location, action) {
          var path = location.pathname || "/~error";

          _this2.resolve(path);
        });
      }
    },
    stop: function stop() {
      if (this.history) {
        this.stopHistoryListener();
        this.history = null;
        this.stopHistoryListener = null;
      }
    },
    addRoutes: function addRoutes() {
      var _this3 = this;

      var routes = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

      routes.forEach(function (r) {
        _this3.routes.push(makeRoute(r));
      });
    }
  },
      makeRoute = function makeRoute(route) {
    var keys = [],
        pattern = (0, _pathToRegexp2.default)(route.path, keys);
    return {
      path: route.path,
      controller: route.controller,
      pattern: pattern,
      keys: keys
    };
  };

  exports.default = {
    create: function create() {
      var routes = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      return Object.create(RouterProto, {
        routes: {
          value: routes.map(makeRoute)
        },
        options: {
          value: Object.assign({}, routerDefaults, options)
        },
        emitter: {
          value: createEventEmitter()
        }
      });
    }
  };
});