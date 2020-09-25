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
})(this, function (_exports, _pathToRegexp, _history) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports["default"] = void 0;
  _pathToRegexp = _interopRequireDefault(_pathToRegexp);

  function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

  function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? Object(arguments[i]) : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

  function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

  var isPromise = function isPromise(type) {
    return type && typeof type.then === "function";
  },
      identity = function identity(arg) {
    return arg;
  },
      EventEmitterProto = {
    on: function on(event, handler) {
      var handlers = this.handlers[event] || (this.handlers[event] = []),
          h = {
        event: event,
        handler: handler
      };
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
      var subs;
      subs = this.on(event, function () {
        subs.dispose();

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        handler.apply(void 0, [event].concat(args));
      });
    },
    emit: function emit(event) {
      for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        args[_key2 - 1] = arguments[_key2];
      }

      var handlers = this.handlers[event] || [];
      handlers.forEach(function (h) {
        return h.handler.apply(h, [event].concat(args));
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
    var history;

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
      console.log(message); // callback(true);
      // /*

      setTimeout(function () {
        var val = !!Math.round(Math.random());
        console.log(message, val);
        callback(val);
      }, 1000); // */
    },
    block: function block(location, action) {
      return "Are you sure you want to leave this page?";
    }
  },
      RouterProto = {
    on: function on(evt, handler) {
      return this.emitter.on(evt, handler);
    },
    matches: function matches(path) {
      return this.routes.some(function (route) {
        return route.pattern.test(path);
      });
    },
    match: function match(path) {
      var params, matchedRoute;
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
    resolve: function resolve(path, action) {
      var _this = this;

      var context = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      // console.log("Resolving ", path);
      var routeInfo = this.match(path),
          origRoute = context.route || {};

      if (routeInfo) {
        // console.log("Found routeInfo", path);
        var route = {
          action: action,
          // redirect: origRoute.redirect,
          from: origRoute.from,
          path: routeInfo.path,
          params: routeInfo.params
        },
            ctx = _objectSpread({}, context, {
          route: route
        }),
            controller = routeInfo.controller; // console.log("Route", route);


        this.emitter.emit("before-route", path);
        var ret = controller ? controller(ctx) : identity(ctx);

        if (!isPromise(ret)) {
          ret = Promise.resolve(ret);
        }

        return ret.then(function (retVal) {
          if (retVal.redirect) {
            console.log("Redirecting from ".concat(routeInfo.path, " to ").concat(retVal.redirect));
            return _this.resolve(retVal.redirect, "REDIRECT", {
              route: {
                // redirect: true,
                from: routeInfo.path
              }
            });
          } else {
            _this.current = routeInfo; // console.log("Returning", retVal);

            _this.emitter.emit("route", _objectSpread({
              route: route
            }, retVal));

            return retVal;
          }
        });
        /*
        .then(
          retVal => this.emitter.emit("route", {
            route,
            ...retVal
          }),
          rErr => this.emitter.emit("route-error", {
            route,
            ...rErr
          })
        );
        // return ret;
        */
      }

      return Promise.reject({
        message: "Route not found ".concat(path),
        path: path
      });
    },
    route: function route(path, state) {
      this.history.push(path, state);
    },
    start: function start() {
      var _this2 = this;

      if (!this.history) {
        var options = this.options,
            history = this.history = createHistory(options.type, options); // history.block(options.block);

        this.stopHistoryListener = history.listen(function (location, action) {
          // const unblock = history.block(options.block);
          var path = location.pathname || "/~error",
              ret = _this2.resolve(path, action);

          ret["catch"](function (rErr) {
            console.log(rErr);

            _this2.emitter.emit("route-error", rErr);
          });
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
        _this3.addRoute(r);
      });
    },
    addRoute: function addRoute(r) {
      this.routes.push(makeRoute(r));
    }
  },
      makeRoute = function makeRoute(route) {
    var keys = [],
        pattern = (0, _pathToRegexp["default"])(route.path, keys);
    return {
      path: route.path,
      controller: route.controller,
      pattern: pattern,
      keys: keys
    };
  };

  var _default = {
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
  _exports["default"] = _default;
});