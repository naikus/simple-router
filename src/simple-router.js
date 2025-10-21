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
 * Creates a simple event emitter
 * @return {{
 *  on: function,
 *  once: function,
 *  emit: function
 * }}
 */
function createEventEmitter() {
  const emitter = new EventTarget();

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
      const event = new CustomEvent(eventName, {detail: data});
      emitter.dispatchEvent(event);
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
      console.debug("ignoring hash change", event);
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
    // console.log(stack);
  }

  /**
   * Invoked when a link was clicked on document
   * @param {Event} event
   */
  function clickListener(event) {
    // console.log(event);
    // @ts-ignore
    const {target: {href}} = event, current = stack[stack.length - 1];
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
      // console.log("Setting path", path);
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
      if(toPath) {
        window.location.hash = path;
      }else {
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
function createRouter(initialRoutes = []) {
  const emitter = createEventEmitter(),
      /** @type {Map<string, RouteInfo>} */
      routes = new Map(),
      history = createHashHistory();

  /**
   * @type {{
   *  context: RouteContext
   *  routeInfo: RouteInfo
   * } | null}
   */
  let currentRouteData = null,
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
  function match(path) {
    /** @type {Record<string, string>} */
    let params,
        matchedRouteInfo;
    Array.from(routes.values()).some(routeInfo => {
      // @ts-ignore
      const res = routeInfo.pattern.exec(path);
      if(res) {
        matchedRouteInfo = routeInfo;
        params = {};
        routeInfo.keys.forEach((key, i) => {
          // console.log(key.name, res[i+1]);
          const val = res[i+1];
          val && (params[key.name] = val);
        });
        // console.log(params, routeInfo.keys, res);
        return true;
      }
      return false;
    });
    if(matchedRouteInfo) {
      return {
        routeInfo: matchedRouteInfo,
        route: {
          path,
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
    // console.debug(pathToRegexp(routeDefn.path));
    return {
      ...routeDefn,
      pattern: regexp,
      keys
    };
  }

  /**
   * Abort any current route that is possibly ongoing
   */
  function abortCurrentRoute() {
    if(isRouting && abortController) {
      const routePath = currentRouteData ? currentRouteData.context.route.path : "unknown";
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
    // console.debug("Resolving...", path, context);
    const routeMatch = match(path),
        {promise, resolve, reject} = promiseWithResolvers();
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

    // If we have a current route
    let fromRoute;
    if(currentRouteData) {
      const {context: currContext} = currentRouteData,
          {route: currRoute} = currContext;
      fromRoute = currRoute;
    }else {
      fromRoute = context.route;
    }

    // @ts-ignore
    const {route, routeInfo} = routeMatch;
    route.from = fromRoute;
    route.action = action;

    // Abort this current route if it's still processing
    abortCurrentRoute();

    // Set up the abort mechanism
    abortController = new AbortController();
    const signal = abortController.signal;

    /*
    // eslint-disable-next-line one-var
    const abortListener = event => {
      // reject(signal.reason);
      emitter.emit("route-error", {
        path,
        error: signal.reason
      });
    };
    signal.addEventListener("abort", abortListener);
    */

    // Emit the before route event
    emitter.emit("before-route", path);

    // process the route
    const matchedRouteCtx = {...context, route};
    // Set the current data
    currentRouteData = {
      context: matchedRouteCtx,
      routeInfo
    };

    processRoute(routeInfo, matchedRouteCtx, abortController.signal)
        .then(val => {
          const forwardPath = val.forward;
          /*
          // Set the current data
          currentRouteData = {
            context: matchedRouteCtx,
            routeInfo
          };
          */
          if(signal.aborted) {
            emitter.emit("route-error", {
              path,
              error: signal.reason
            });
            resolve();
            return;
          }

          // This result wants us to forward
          if(forwardPath) {
            const ctx = {
              ...val,
              ...matchedRouteCtx
            };
            // Emit a route event (event if this was a forward)
            emitter.emit("route", ctx);
            // resolve();

            console.debug(`Forwarding from ${route.path} to ${forwardPath}`);
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
              history.set(val.forward, true);
              resolve();
            }).catch(err => {
              emitter.emit("route-error", {path: forwardPath, error: err});
              reject(err);
            });
          }else {
            // This is some data returned by the controller
            // console.debug("Emitting final route event!!");
            resolve();
            emitter.emit("route", {
              ...val,
              ...matchedRouteCtx,
              route
            });
          }
        })
        .catch(err => {
          emitter.emit("route-error", {path, error: err});
          reject(err);
        }).finally(() => {
          // signal.removeEventListener("abort", abortListener);
        });

    // Return the promise
    return promise;
  }

  // Set up initial routes and event handlers
  initialRoutes.forEach(r => {
    routes.set(r.path, createRouteInfo(r));
  });
  emitter.on("before-route", e => {
    isRouting = true;
    // console.debug("Routing...", e.detail);
  });
  emitter.on("route", e => {
    isRouting = false;
    // console.debug("Routing...Done!", e.detail.route.path);
  });
  emitter.on("route-error", e => {
    isRouting = false;
    // console.debug("Routing...Error!", e.detail);
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
            .then(val => {
              console.debug(route, val);
            })
            .catch(err => {
              console.error(err);
            });
      });
    },
    stop() {
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
      // console.debug(routes);
    },
    addRoute(r) {
      routes.set(r.path, createRouteInfo(r));
      // console.log(routes);
    }
  };
}

export default createRouter;
