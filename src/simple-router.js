import pathToRegexp from "path-to-regexp";
import {createHashHistory, createBrowserHistory, createMemoryHistory} from "history";

const isPromise = type => type && (typeof type.then) === "function",
    identity = arg => arg,
    EventEmitterProto = {
      on(event, handler) {
        const handlers = this.handlers[event] || (this.handlers[event] = []), h = {event, handler};
        handlers.push(h);
        return {
          dispose() {
            const index = handlers.indexOf(h);
            if(index !== -1) {
              handlers.splice(index, 1);
            }
          }
        };
      },
      once(event, handler) {
        let subs;
        subs = this.on(event, (...args) => {
          subs.dispose();
          handler(event, ...args);
        });
      },
      emit(event, ...args) {
        let handlers = this.handlers[event] || [];
        handlers.forEach(h => h.handler(event, ...args));
      }
    },

    createEventEmitter = () => {
      return Object.create(EventEmitterProto, {
        handlers: {
          value: {}
        }
      });
    },

    createHistory = (type, options) => {
      let history;
      switch (type) {
        case "browser":
          history = createBrowserHistory(options);
          break;
        case "hash":
          history = createHashHistory(options);
          break;
        case "memory":
          history = createMemoryHistory(options);
          break;
        default:
          history = createHashHistory(options);
      }
      return history;
    },

    routerDefaults = {
      type: "hash",
      hashType: "slash",
      getUserConfirmation(message, callback) {
        callback(true);
        /*
        setTimeout(() => {
          const val = !!Math.round(Math.random());
          console.log(message, val);
          callback(val);
        }, 1000);
        */
      },
      block(location, action) {
        return "Are you sure you want to leave this page?";
      }
    },

    RouterProto = {
      on(evt, handler) {
        return this.emitter.on(evt, handler);
      },
      matches(path) {
        return this.routes.some(route => route.pattern.test(path));
      },
      match(path) {
        let params, matchedRoute;
        this.routes.some(route => {
          const res = route.pattern.exec(path);
          if(res) {
            matchedRoute = route;
            params = {};
            route.keys.forEach((key, i) => {
              params[key.name] = res[i + 1];
            });
            return true;
          }
          return false;
        });
        if(matchedRoute) {
          return {
            path: path,
            params: params,
            controller: matchedRoute.controller
          };
        }
        return null;
      },
      resolve(path, action, context = {}) {
        // console.log("Resolving ", path);
        const routeInfo = this.match(path), origRoute = context.route || {};
        if(routeInfo) {
          // console.log("Found routeInfo", path);
          const route = {
                action,
                // redirect: origRoute.redirect,
                from: origRoute.from,
                path: routeInfo.path,
                params: routeInfo.params
              },
              ctx = {
                ...context,
                route
              },
              controller = routeInfo.controller;
          // console.log("Route", route);
          this.emitter.emit("before-route", path);
          let ret = controller ? controller(ctx) : identity(ctx);
          if(!isPromise(ret)) {
            ret = Promise.resolve(ret);
          }
          return ret.then(retVal => {
            if(retVal.redirect) {
              console.log(`Redirecting from ${routeInfo.path} to ${retVal.redirect}`);
              return this.resolve(retVal.redirect, "REDIRECT", {
                route: {
                  // redirect: true,
                  from: routeInfo.path
                }
              });
            }else {
              this.current = routeInfo;
              // console.log("Returning", retVal);
              this.emitter.emit("route", {
                route,
                ...retVal
              });
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
          message: `Route not found ${path}`,
          path
        });
      },
      route(path, state) {
        this.history.push(path, state);
      },
      start() {
        if(!this.history) {
          const {options} = this, history = this.history = createHistory(options.type, options);
          history.block(options.block);
          this.stopHistoryListener = history.listen((location, action) => {
            const path = location.pathname || "/~error",
                ret = this.resolve(path, action);
            ret.catch(rErr => {
              console.log(rErr);
              this.emitter.emit("route-error", {
                ...rErr
              });
            });
          });
        }
      },
      stop() {
        if(this.history) {
          this.stopHistoryListener();
          this.history = null;
          this.stopHistoryListener = null;
        }
      },
      addRoutes(routes = []) {
        routes.forEach(r => {
          this.addRoute(r);
        });
      },
      addRoute(r) {
        this.routes.push(makeRoute(r));
      }
    },

    makeRoute = route => {
      const keys = [], pattern = pathToRegexp(route.path, keys);
      return {
        path: route.path,
        controller: route.controller,
        pattern,
        keys
      };
    };


export default {
  create(routes = [], options = {}) {
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
