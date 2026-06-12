/* global URL, EventTarget, CustomEvent, AbortController, Map */
import {pathToRegexp} from "path-to-regexp";

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
  let promise, resolve, reject;
  promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // @ts-ignore
  return {promise, resolve, reject};
}

/**
 * @typedef EventEmitter
 * @property {function} on
 * @property {function} once
 * @property {function} emit
 * @property {function} removeAll
 */

/**
 * Creates a simple event emitter
 * @return EventEmitter
 */
function createEventEmitter() {
  let emitter = new EventTarget();

  return {
    /**
     * Register an event listener
     * @param {string} eventName Event name
     * @param {EventListener} handler
     * @return {Function} Un-register function
     */
    on(eventName, handler) {
      emitter.addEventListener(eventName, handler);
      return () => {
        emitter.removeEventListener(eventName, handler);
      };
    },

    /**
     * Register once-only event listener
     * @param {string} eventName Event name
     * @param {EventListener} handler
     * @return {Function} Un-register function
     */
    once(eventName, handler) {
      const listener = event => {
        emitter.removeEventListener(eventName, listener);
        handler(event);
      };

      emitter.addEventListener(eventName, listener);
      const ret = () => {
        emitter.removeEventListener(eventName, listener);
      };
      return ret;
    },

    /**
     * Dispatch/Emit an event
     * @param {string} eventName Event name
     * @param  {any} data any arguments to the event handler
     */
    emit(eventName, data) {
      const event = new CustomEvent(eventName, {detail: data, cancelable: true});
      return emitter.dispatchEvent(event);
    },
    removeAll() {
      emitter = new EventTarget();
    }
  };
}


/**
 * Creates a RouterHistory object based on window.location.hash
 * @return {RouteHistory}
 */
function createHashHistory() {
  const noop = (route, action) => {};
  let linkClicked = null,
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
    if(ignoreHashChange) {
      // console.debug("[hashListener] Ignoring hash change", event);
      ignoreHashChange = false;
      return;
    }
    const hash = event ? new URL(event.newURL).hash : window.location.hash;
    // Only handle hash changes that start with #/
    if(!hash || hash.indexOf("#/") !== 0) {
      return;
    }
    const route = hash.substring(1);
    if(linkClicked) {
      linkClicked = null;
      stack.push(hash);
      listener(route, "PUSH");
    }else {
      // Back forward buttons were used
      const index = stack.lastIndexOf(hash);
      if(index !== -1) {
        stack.splice(index + 1, stack.length - index);
        listener(route, "POP");
      }else {
        stack.push(hash);
        listener(route, "PUSH");
      }
    }
    // console.debug("[Router]", stack);
  }

  /**
   * Invoked when a link was clicked on document
   * @param {Event} event
   */
  function clickListener(event) {
    const {target} = event,
        current = stack[stack.length - 1];

    let depth = 0,
        // @ts-ignore
        {href} = target,
        /** @type {HTMLElement} */
        // @ts-ignore
        elem = target;

    // eslint-disable-next-line keyword-spacing
    while(!href || depth < 3) {
      // @ts-ignore
      elem = elem.parentElement;
      if(!elem) {
        break;
      }
      href = elem.getAttribute("href");
      depth += 1;
    }

    if(href !== current) {
      linkClicked = href;
    }
  }

  /** @type {RouteHistory} */
  return {
    getSize() {
      return stack.length;
    },
    listen(listnr) {
      listener = listnr;
      document.addEventListener("click", clickListener, true);
      window.addEventListener("hashchange", hashListener);
      return () => {
        listener = noop;
        document.removeEventListener("click", clickListener, true);
        window.removeEventListener("hashchange", hashListener);
      };
    },
    push(path) {
      const currentPath = window.location.hash.substring(1);
      linkClicked = "__PUSH";
      if(currentPath === path) {
        hashListener(null);
        return;
      }
      window.location.hash = path;
      // Uncomment this ONLY for running tests (JSDOM does not support hashchange event)
      // hashListener();
    },
    replace(path) {
      linkClicked = "__REPLACE";
      window.location.replace(`#${path}`);
    },
    /* Set the path without calling the hash listener */
    set(path, push = false) {
      // console.debug("[Router] Setting path", path);
      ignoreHashChange = true;
      window.location.hash = path;
      if(push) {
        stack.push(window.location.hash);
      }
    },
    pop(toPath) {
      linkClicked = null;
      if(!stack.length) {
        return;
      }
      const path = toPath || stack[stack.length - 2] || "";
      // Correctly maintain backstack. This is not possible if toPath is provided.
      if(path) {
        window.location.hash = path;
      }else {
        window.history.go(-1);
      }
    }
  };
}



/**
 * @type {createRouter}
 * Creates a new instance of Router
 * @param {Array<RouteDefn>} initialRoutes
 * @return {Router} Newly created router
 */
function createRouter(initialRoutes = []) {
  const emitter = createEventEmitter(),
      /** @type {Map<string, RouteInfo>} */
      routes = new Map(),
      history = createHashHistory();

  /**
   * @typedef {{
   *  context: RouteContext
   *  routeInfo: RouteInfo,
   *  abortController: AbortController,
   *  resolved: boolean
   * } | null} CurrentRouteData
   */

  /** @type {CurrentRouteData} */
  let currentRouteData = null,
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
  function match(path) {
    /** @type {Record<string, string>} */
    let params,
        /** @type {RouteInfo} */
        matchedRouteInfo;
    Array.from(routes.values()).some(routeInfo => {
      // @ts-ignore
      const res = routeInfo.pattern.exec(path);
      if(res) {
        matchedRouteInfo = routeInfo;
        params = {};
        routeInfo.keys.forEach((key, i) => {
          // console.debug("[Router]", key.name, res[i+1]);
          const val = res[i+1];
          val && (params[key.name] = val);
        });
        return true;
      }
      return false;
    });
    // @ts-ignore
    if(matchedRouteInfo) {
      return {
        routeInfo: matchedRouteInfo,
        route: {
          path,
          routePath: matchedRouteInfo.path,
          // @ts-ignore
          params
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
    const {regexp, keys} = pathToRegexp(routeDefn.path);
    // console.debug("Router]", pathToRegexp(routeDefn.path));
    return {
      ...routeDefn,
      pattern: regexp,
      keys
    };
  }

  /**
   * Process the specified route by calling it's controller if present
   * @param {RouteInfo} routeInfo
   * @param {RouteContext} context
   * @param {AbortSignal} signal
   * @return {Promise<any>}
   */
  function processRouteController(routeInfo, context, signal) {
    const {controller} = routeInfo;
    let retVal = typeof controller === "function"
      ? controller(context, {signal})
      : context;
    return Promise.resolve(retVal);
  }

  /**
   * @param {string} path
   * @param {RouteAction} action
   * @param {RouteContext | EmptyRouteContext} context
   * @return {Promise<RouteContext>}
   */
  function resolveRoute(path, action, context) {
    // console.debug("[Router] Resolving...", path, context);
    const routeMatch = match(path),
        {promise, resolve, reject} = promiseWithResolvers(),
        fromRoute = currentRouteData ? currentRouteData.context.route : context.route;

    // Abort this current route if it's still processing
    if(currentRouteData && !currentRouteData.resolved) {
      const {abortController, context: {route}} = currentRouteData,
          reason = {name: "newroute", data: path};
      abortController.abort(reason);
      emitter.emit("route-abort", {
        path: route.path,
        reason
      });
    }

    // No route matches
    if(!routeMatch) {
      emitter.emit("route-error", {
        path,
        error: "not-found"
      });
      // reject(new Error(`Route not found ${path}`));
      resolve();
      return promise;
    }

    // @ts-ignore
    const {route, routeInfo} = routeMatch;
    route.from = fromRoute;
    route.action = action;

    // Emit the before route event
    const retVal = emitter.emit("before-route", path);
    if(!retVal) {
      emitter.emit("route-abort", {
        path,
        reason: {name: "prevented", data: "before-route"}
      });
      resolve();
      return promise;
    }

    // process the route
    const matchedRouteCtx = {...context, route},
        abortController = new AbortController(),
        signal = abortController.signal;

    // Set the current data
    currentRouteData = {
      context: matchedRouteCtx,
      routeInfo,
      abortController,
      resolved: false
    };

    processRouteController(routeInfo, matchedRouteCtx, signal)
        .then(val => {
          // Set the current data
          currentRouteData && (currentRouteData.resolved = true);
          const forwardPath = val && val.forward;

          if(signal.aborted) {
            const {name, data} = signal.reason;
            // console.debug("[Router] Signal aborted", signal.reason);
            resolve();
            return;
          }

          // This result wants us to forward
          if(forwardPath) {
            const ctx = {
              ...matchedRouteCtx,
              ...val
            };
            // Emit a route event (event if this was a forward)
            emitter.emit("route-forward", ctx);
            // resolve();

            // console.debug(`[Router] Forwarding from ${route.path} to ${forwardPath}`);
            // Resolve the forward route
            resolveRoute(forwardPath, action, {
              ...ctx,
              forward: null, // We don't want to recursively keep forwarding
              route: {
                ...route,
                forwarded: true
              }
            }).then(() => {
              // set the browser hash to correct value for forwarded route while pushing
              // onto the stack (second param) without invoking the hashchange listener
              history.set(forwardPath, true);
              resolve();
            }).catch(err => {
              emitter.emit("route-error", {path: forwardPath, error: err});
              reject(err);
            });
          }else {
            // This is some data returned by the controller
            // console.debug("[Router] Emitting final route event!!");
            resolve();
            emitter.emit("route", {
              ...matchedRouteCtx,
              ...val, // The order is important here!
              route
            });
          }
        })
        .catch(err => {
          emitter.emit("route-error", {path, error: err});
          reject(err);
        }).finally(() => {
          currentRouteData && (currentRouteData.resolved = true);
          // console.log(currentRouteData);
        });

    // Return the promise
    return promise;
  }

  // Set up initial routes and event handlers
  initialRoutes.forEach(r => {
    routes.set(r.path, createRouteInfo(r));
  });

  return {
    on(eventName, handler) {
      return emitter.on(eventName, handler);
    },
    once(eventName, handler) {
      return emitter.once(eventName, handler);
    },
    matches(path) {
      // return routes.some(route => route.pattern.test(path));
      return Array.from(routes.values())
          .some(route => route.pattern.test(path));
    },
    match(path) {
      const ret = match(path);
      return ret ? ret.routeInfo : null;
    },
    getRoute(path) {
      const ret = match(path);
      return ret ? ret.route : null;
    },
    route(path, replace = false) {
      // setState(state);
      if(replace) {
        history.replace(path);
      }else {
        history.push(path);
      }
    },
    back(toRoute) {
      // setState(state);
      history.pop(toRoute);
    },
    set(path) {
      /*
      if(state) {
        setState(state);
      }
      */
      history.set(path);
    },
    getBrowserRoute() {
      const hash = window.location.hash;
      if(hash) {
        return hash.substring(1);
      }
      return null;
    },
    getCurrentRoute() {
      if(!currentRouteData) {
        return null;
      }
      const {context} = currentRouteData;
      return context.route;
    },
    start() {
      // Already started
      if(stopHistoryListener) {
        this.stop();
      }
      stopHistoryListener = history.listen((route, action) => {
        resolveRoute(route, action, {})
            /*
            .then(() => {
              console.debug("[Router^^^^^]", route);
            })
            */
            .catch(err => {
              console.error(err);
            });
      });
    },
    stop() {
      emitter.removeAll();
      if(currentRouteData) {
        currentRouteData.resolved = true;
        currentRouteData.abortController.abort({name: "routerstopped", data: ""})
      }
      if(stopHistoryListener) {
        stopHistoryListener();
        stopHistoryListener = null;
      }
    },
    addRoutes(routeDefns = []) {
      routeDefns.forEach(r => {
        // @ts-ignore
        this.addRoute(r);
      });
    },
    addRoute(r) {
      routes.set(r.path, createRouteInfo(r));
    }
  };
}

export default createRouter;
