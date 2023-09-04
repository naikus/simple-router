(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define("SimpleRouter", ["path-to-regexp"], factory);
  } else if (typeof exports !== "undefined") {
    factory(require("path-to-regexp"));
  } else {
    var mod = {
      exports: {}
    };
    factory(global.pathToRegexp);
    global.SimpleRouter = mod.exports;
  }
})(this, function (_pathToRegexp) {
  "use strict";

  _pathToRegexp = _interopRequireDefault(_pathToRegexp);
  function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
  function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
  function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? Object(arguments[i]) : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys.push.apply(ownKeys, Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }
  function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
  function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return _typeof(key) === "symbol" ? key : String(key); }
  function _toPrimitive(input, hint) { if (_typeof(input) !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (_typeof(res) !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
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
    createHistory = function createHistory(options) {
      var noop = function noop() {};
      var linkClicked = null,
        listener = noop,
        // running = true,
        stack = [],
        ignoreHashChange = false;
      var hashListener = function hashListener(event) {
          if (ignoreHashChange) {
            ignoreHashChange = false;
            return;
          }
          var hash = window.location.hash;
          if (!hash) {
            return;
          }
          var route = hash.substring(1);
          if (linkClicked) {
            // console.log("Link was clicked", linkClicked);
            linkClicked = null;
            stack.push(hash);
            listener({
              route: route
            }, "PUSH");
          } else {
            // Back forward buttons were used
            var index = stack.lastIndexOf(hash);
            if (index !== -1) {
              stack.splice(index + 1, stack.length - index);
              listener({
                route: route
              }, "POP");
            } else {
              stack.push(hash);
              listener({
                route: route
              }, "PUSH");
            }
          }
          // console.log(stack);
        },
        clickListener = function clickListener(event) {
          // console.log(event);
          var href = event.target.href,
            current = stack[stack.length - 1];
          if (href !== current) {
            linkClicked = href;
          }
        };
      return {
        getSize: function getSize() {
          return stack.length;
        },
        listen: function listen(listnr) {
          listener = listnr;
          document.addEventListener("click", clickListener, true);
          window.addEventListener("hashchange", hashListener);
          return function () {
            listener = noop;
            window.removeEventListener("click", clickListener, true);
            window.removeEventListener("hashchange", hashListener);
          };
        },
        push: function push(path) {
          var currentPath = window.location.hash.substring(1);
          linkClicked = "__PUSH";
          if (currentPath === path) {
            hashListener({});
          } else {
            window.location.hash = path;
          }
        },
        /* Set the path without calling the hash listener */set: function set(path) {
          ignoreHashChange = true;
          window.location.hash = path;
        },
        pop: function pop(toPath) {
          linkClicked = null;
          if (!stack.length) {
            return;
          }
          var path = toPath || stack[stack.length - 2];
          // Correctly maintain backstack. This is not possible if toPath is provided.
          if (toPath) {
            window.location.hash = path;
          } else {
            window.history.go(-1);
          }
        }
      };
    },
    routerDefaults = {
      defaultRoute: "/",
      errorRoute: "/~error"
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
          return _objectSpread({}, matchedRoute, {
            params: params
          });
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
          // console.log("Found routeInfo", path, routeInfo);
          var route = _objectSpread({
              action: action,
              from: origRoute,
              path: routeInfo.path,
              params: routeInfo.params
            }, routeInfo),
            ctx = _objectSpread({}, context, {
              route: route
            }),
            controller = routeInfo.controller;
          // console.log("Route", route);
          this.emitter.emit("before-route", path);
          var ret = controller ? controller(ctx) : identity(ctx);
          if (!isPromise(ret)) {
            ret = Promise.resolve(ret);
          }
          return ret.then(function () {
            var retVal = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
            if (retVal.forward) {
              console.debug("Forwarding from ".concat(routeInfo.path, " to ").concat(retVal.forward));
              return _this.resolve(retVal.forward, action, {
                route: {
                  // forward: true,
                  from: routeInfo.path
                }
              }).then(function (fRoute) {
                // set the browser hash to correct value for forwarded route
                // without invoking the hashchange listener
                _this.history.set(retVal.forward);
                return fRoute;
              });
            } else {
              _this.current = routeInfo;
              // console.log("Returning", retVal);
              _this.emitter.emit("route", _objectSpread({
                route: route,
                state: _this.state
              }, retVal));
              _this.clearState();
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
      setState: function setState(state) {
        this.state = state;
      },
      clearState: function clearState() {
        this.state = {};
      },
      route: function route(path) {
        var state = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        // console.log(this.history.getSize());
        this.setState(state);
        this.history.push(path, state);
      },
      back: function back(toRoute) {
        var state = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        this.setState(state);
        this.history.pop(toRoute);
      },
      getBrowserRoute: function getBrowserRoute() {
        var hash = window.location.hash;
        if (hash) {
          return hash.substring(1);
        }
        return null;
      },
      getCurrentRoute: function getCurrentRoute() {
        return this.current;
      },
      start: function start() {
        var _this2 = this;
        if (!this.history) {
          var options = this.options,
            history = this.history = createHistory(options.history),
            _options$defaultRoute = options.defaultRoute,
            defaultRoute = _options$defaultRoute === void 0 ? "/" : _options$defaultRoute,
            _options$errorRoute = options.errorRoute,
            errorRoute = _options$errorRoute === void 0 ? "/~error" : _options$errorRoute;

          // history.block(options.block);
          this.stopHistoryListener = history.listen(function (location, action) {
            // const unblock = history.block(options.block);
            var path = location.route || errorRoute,
              ret = _this2.resolve(path, action);
            ret["catch"](function (rErr) {
              // console.log(rErr);
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
        console.log(this.routes);
      }
    },
    makeRoute = function makeRoute(route) {
      var keys = [],
        pattern = (0, _pathToRegexp["default"])(route.path, keys);
      return _objectSpread({}, route, {
        path: route.path,
        controller: route.controller,
        pattern: pattern,
        keys: keys
      });
    };
  module.exports = function () {
    var routes = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    return Object.create(RouterProto, {
      state: {
        value: {},
        writable: true,
        readable: true
      },
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
  };
});