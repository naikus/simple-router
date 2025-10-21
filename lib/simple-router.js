(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define("SimpleRouter", ["exports", "path-to-regexp"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require("path-to-regexp"));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.pathToRegexp);
    global.SimpleRouter = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_exports, _pathToRegexp2) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports["default"] = void 0;
  function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
  function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
  function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
  function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
  function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
  function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); } /* global URL, EventTarget, CustomEvent, AbortController, Map */
  /**
   * @typedef {import("./types").RouteDefn} RouteDefn
   * @typedef {import("./types").Router} Router
   * @typedef {import("./types").RouteInfo} RouteInfo
   * @typedef {import("./types").RouteAction} RouteAction
   * @typedef {import("./types").create} createRouter
   * @typedef {import("./types").RouteHistory} RouteHistory
   * @typedef {import("./types").RouteHistoryListener} RouteHistoryListener
   * @typedef {import("./types").RouteContext} RouteContext
   * @typedef {import("./types").EmptyRouteContext} EmptyRouteContext
   * @typedef {import("./types").Route} Route
   */

  /**
   * Gets an object that has promise and its resolve, reject functions
   * @return {{promise: Promise, resolve: function, reject: function}}
   */
  function promiseWithResolvers() {
    var promise, resolve, reject;
    promise = new Promise(function (res, rej) {
      resolve = res;
      reject = rej;
    });
    // @ts-ignore
    return {
      promise: promise,
      resolve: resolve,
      reject: reject
    };
  }

  /**
   * Creates a simple event emitter
   * @return {{
   *  on: function,
   *  once: function,
   *  emit: function
   * }}
   */
  function createEventEmitter() {
    var emitter = new EventTarget();
    return {
      /**
       * Register an event listener
       * @param {string} eventName Event name
       * @param {EventListener} handler
       * @return {Function} Un-register function
       */
      on: function on(eventName, handler) {
        emitter.addEventListener(eventName, handler);
        return function () {
          emitter.removeEventListener(eventName, handler);
        };
      },
      /**
       * Register once-only event listener
       * @param {string} eventName Event name
       * @param {EventListener} handler
       * @return {Function} Un-register function
       */
      once: function once(eventName, handler) {
        var _listener = function listener(event) {
          emitter.removeEventListener(eventName, _listener);
          handler(event);
        };
        emitter.addEventListener(eventName, _listener);
        var ret = function ret() {
          emitter.removeEventListener(eventName, _listener);
        };
        return ret;
      },
      /**
       * Dispatch/Emit an event
       * @param {string} eventName Event name
       * @param  {any} data any arguments to the event handler
       */
      emit: function emit(eventName, data) {
        var event = new CustomEvent(eventName, {
          detail: data
        });
        emitter.dispatchEvent(event);
      }
    };
  }

  /**
   * Creates a RouterHistory object based on window.location.hash
   * @return {RouteHistory}
   */
  function createHashHistory() {
    var noop = function noop(route, action) {};
    var linkClicked = null,
      /** @type {RouteHistoryListener} */
      listener = noop,
      /** @type {[string?]} */
      stack = [],
      ignoreHashChange = false;
    /**
     * @param {HashChangeEvent | null} event
     * @return {void}
     */
    function hashListener(event) {
      if (ignoreHashChange) {
        console.debug("ignoring hash change", event);
        ignoreHashChange = false;
        return;
      }
      var hash = event ? new URL(event.newURL).hash : window.location.hash;
      // Only handle hash changes that start with #/
      if (!hash || hash.indexOf("#/") !== 0) {
        return;
      }
      var route = hash.substring(1);
      if (linkClicked) {
        linkClicked = null;
        stack.push(hash);
        listener(route, "PUSH");
      } else {
        // Back forward buttons were used
        var index = stack.lastIndexOf(hash);
        if (index !== -1) {
          stack.splice(index + 1, stack.length - index);
          listener(route, "POP");
        } else {
          stack.push(hash);
          listener(route, "PUSH");
        }
      }
      // console.log(stack);
    }

    /**
     * Invoked when a link was clicked on document
     * @param {Event} event
     */
    function clickListener(event) {
      // console.log(event);
      // @ts-ignore
      var href = event.target.href,
        current = stack[stack.length - 1];
      if (href !== current) {
        linkClicked = href;
      }
    }

    /** @type {RouteHistory} */
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
          document.removeEventListener("click", clickListener, true);
          window.removeEventListener("hashchange", hashListener);
        };
      },
      push: function push(path) {
        var currentPath = window.location.hash.substring(1);
        linkClicked = "__PUSH";
        if (currentPath === path) {
          hashListener(null);
          return;
        }
        window.location.hash = path;
        // Uncomment this ONLY for running tests (JSDOM does not support hashchange event)
        // hashListener();
      },
      replace: function replace(path) {
        linkClicked = "__REPLACE";
        window.location.replace("#".concat(path));
      },
      /* Set the path without calling the hash listener */set: function set(path) {
        var push = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
        // console.log("Setting path", path);
        ignoreHashChange = true;
        window.location.hash = path;
        if (push) {
          stack.push(window.location.hash);
        }
      },
      pop: function pop(toPath) {
        linkClicked = null;
        if (!stack.length) {
          return;
        }
        var path = toPath || stack[stack.length - 2] || "";
        // Correctly maintain backstack. This is not possible if toPath is provided.
        if (toPath) {
          window.location.hash = path;
        } else {
          window.history.go(-1);
        }
      }
    };
  }

  /**
   * Creates a new instance of Router
   * @param {Array<RouteDefn>} initialRoutes
   * @return {Router} Newly created router
   */
  function createRouter() {
    var initialRoutes = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    var emitter = createEventEmitter(),
      /** @type {Map<string, RouteInfo>} */
      routes = new Map(),
      history = createHashHistory();

    /**
     * @type {{
     *  context: RouteContext
     *  routeInfo: RouteInfo
     * } | null}
     */
    var currentRouteData = null,
      /** @type {AbortController | null} */
      abortController = null,
      isRouting = false,
      /** @type {Function | null} */
      stopHistoryListener = null;

    /**
     * Matches a route for a given path
     * @param {string} path
     * @return {{
     *  routeInfo: RouteInfo,
     *  route: Route
     * } | null} or null if not found
     */
    function _match(path) {
      /** @type {Record<string, string>} */
      var params, matchedRouteInfo;
      Array.from(routes.values()).some(function (routeInfo) {
        // @ts-ignore
        var res = routeInfo.pattern.exec(path);
        if (res) {
          matchedRouteInfo = routeInfo;
          params = {};
          routeInfo.keys.forEach(function (key, i) {
            // console.log(key.name, res[i+1]);
            var val = res[i + 1];
            val && (params[key.name] = val);
          });
          // console.log(params, routeInfo.keys, res);
          return true;
        }
        return false;
      });
      if (matchedRouteInfo) {
        return {
          routeInfo: matchedRouteInfo,
          route: {
            path: path,
            // @ts-ignore
            params: params
          }
        };
      }
      return null;
    }

    /**
     * @param {RouteDefn} routeDefn
     * @return {RouteInfo}
     */
    function createRouteInfo(routeDefn) {
      var _pathToRegexp = (0, _pathToRegexp2.pathToRegexp)(routeDefn.path),
        regexp = _pathToRegexp.regexp,
        keys = _pathToRegexp.keys;
      // console.debug(pathToRegexp(routeDefn.path));
      return _objectSpread(_objectSpread({}, routeDefn), {}, {
        pattern: regexp,
        keys: keys
      });
    }

    /**
     * Abort any current route that is possibly ongoing
     */
    function abortCurrentRoute() {
      if (isRouting && abortController) {
        var routePath = currentRouteData ? currentRouteData.context.route.path : "unknown";
        console.debug("Aborting ongoing route");
        abortController.abort({
          type: "abort",
          path: routePath
        });
      }
    }

    /**
     * Process the specified route
     * @param {RouteInfo} routeInfo
     * @param {RouteContext} context
     * @param {AbortSignal} signal
     * @return {Promise<any>}
     */
    function processRoute(routeInfo, context, signal) {
      var controller = routeInfo.controller;
      var retVal = typeof controller === "function" ? controller(context, {
        signal: signal
      }) : context;
      return Promise.resolve(retVal);
    }

    /**
     * @param {string} path
     * @param {RouteAction} action
     * @param {RouteContext | EmptyRouteContext} context
     * @return {Promise<RouteContext>}
     */
    function resolveRoute(path, action, context) {
      // console.debug("Resolving...", path, context);
      var routeMatch = _match(path),
        _promiseWithResolvers = promiseWithResolvers(),
        promise = _promiseWithResolvers.promise,
        resolve = _promiseWithResolvers.resolve,
        reject = _promiseWithResolvers.reject;

      // No route matches
      if (!routeMatch) {
        emitter.emit("route-error", {
          path: path,
          error: "not-found"
        });
        // reject(new Error(`Route not found ${path}`));
        resolve();
        return promise;
      }

      // If we have a current route
      var fromRoute;
      if (currentRouteData) {
        var _currentRouteData = currentRouteData,
          currContext = _currentRouteData.context,
          currRoute = currContext.route;
        fromRoute = currRoute;
      } else {
        fromRoute = context.route;
      }

      // @ts-ignore
      var route = routeMatch.route,
        routeInfo = routeMatch.routeInfo;
      route.from = fromRoute;
      route.action = action;

      // Abort this current route if it's still processing
      abortCurrentRoute();

      // Set up the abort mechanism
      abortController = new AbortController();
      var signal = abortController.signal;

      // /*
      // eslint-disable-next-line one-var
      var abortListener = function abortListener(event) {
        // reject(signal.reason);
        emitter.emit("route-error", {
          path: path,
          error: signal.reason
        });
      };
      signal.addEventListener("abort", abortListener);
      // */

      // Emit the before route event
      emitter.emit("before-route", path);

      // process the route
      var matchedRouteCtx = _objectSpread(_objectSpread({}, context), {}, {
        route: route
      });
      // Set the current data
      currentRouteData = {
        context: matchedRouteCtx,
        routeInfo: routeInfo
      };
      processRoute(routeInfo, matchedRouteCtx, abortController.signal).then(function (val) {
        var forwardPath = val.forward;
        /*
        // Set the current data
        currentRouteData = {
          context: matchedRouteCtx,
          routeInfo
        };
        */
        // This result wants us to forward
        if (forwardPath) {
          var ctx = _objectSpread(_objectSpread({}, val), matchedRouteCtx);
          // Emit a route event (event if this was a forward)
          emitter.emit("route", ctx);
          // resolve();

          console.debug("Forwarding from ".concat(route.path, " to ").concat(forwardPath));
          // Resolve the forward route
          resolveRoute(forwardPath, action, _objectSpread(_objectSpread({}, ctx), {}, {
            forward: null,
            // We don't want to recursively keep forwarding
            route: _objectSpread(_objectSpread({}, route), {}, {
              forwarded: true
            })
          })).then(function () {
            // set the browser hash to correct value for forwarded route while pushing
            // onto the stack (second param) without invoking the hashchange listener
            history.set(val.forward, true);
            resolve();
          })["catch"](function (err) {
            emitter.emit("route-error", {
              path: forwardPath,
              error: err
            });
            reject(err);
          });
        } else {
          // This is some data returned by the controller
          // console.debug("Emitting final route event!!");
          resolve();
          emitter.emit("route", _objectSpread(_objectSpread(_objectSpread({}, val), matchedRouteCtx), {}, {
            route: route
          }));
        }
      })["catch"](function (err) {
        emitter.emit("route-error", {
          path: path,
          error: err
        });
        reject(err);
      })["finally"](function () {
        signal.removeEventListener("abort", abortListener);
      });

      // Return the promise
      return promise;
    }

    // Set up initial routes and event handlers
    initialRoutes.forEach(function (r) {
      routes.set(r.path, createRouteInfo(r));
    });
    emitter.on("before-route", function (e) {
      isRouting = true;
      // console.debug("Routing...", e.detail);
    });
    emitter.on("route", function (e) {
      isRouting = false;
      // console.debug("Routing...Done!", e.detail.route.path);
    });
    emitter.on("route-error", function (e) {
      isRouting = false;
      // console.debug("Routing...Error!", e.detail);
    });
    return {
      on: function on(eventName, handler) {
        return emitter.on(eventName, handler);
      },
      once: function once(eventName, handler) {
        return emitter.once(eventName, handler);
      },
      matches: function matches(path) {
        // return routes.some(route => route.pattern.test(path));

        return Array.from(routes.values()).some(function (route) {
          return route.pattern.test(path);
        });
      },
      match: function match(path) {
        var ret = _match(path);
        return ret ? ret.routeInfo : null;
      },
      getRoute: function getRoute(path) {
        var ret = _match(path);
        return ret ? ret.route : null;
      },
      route: function route(path) {
        var replace = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
        // setState(state);
        if (replace) {
          history.replace(path);
        } else {
          history.push(path);
        }
      },
      back: function back(toRoute) {
        // setState(state);
        history.pop(toRoute);
      },
      set: function set(path) {
        /*
        if(state) {
          setState(state);
        }
        */
        history.set(path);
      },
      getBrowserRoute: function getBrowserRoute() {
        var hash = window.location.hash;
        if (hash) {
          return hash.substring(1);
        }
        return null;
      },
      getCurrentRoute: function getCurrentRoute() {
        if (!currentRouteData) {
          return null;
        }
        var _currentRouteData2 = currentRouteData,
          context = _currentRouteData2.context;
        return context.route;
      },
      start: function start() {
        // Already started
        if (stopHistoryListener) {
          this.stop();
        }
        stopHistoryListener = history.listen(function (route, action) {
          resolveRoute(route, action, {}).then(function (val) {
            console.debug(route, val);
          })["catch"](function (err) {
            console.error(err);
          });
        });
      },
      stop: function stop() {
        if (stopHistoryListener) {
          stopHistoryListener();
          stopHistoryListener = null;
        }
      },
      addRoutes: function addRoutes() {
        var _this = this;
        var routeDefns = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
        routeDefns.forEach(function (r) {
          // @ts-ignore
          _this.addRoute(r);
        });
        // console.debug(routes);
      },
      addRoute: function addRoute(r) {
        routes.set(r.path, createRouteInfo(r));
        // console.log(routes);
      }
    };
  }
  var _default = _exports["default"] = createRouter;
});