import pathToRegexp from "path-to-regexp";
import {createHashHistory, createBrowserHistory, createMemoryHistory} from "history";

const isPromise = type => typeof type.then === "function",
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
        handlers.forEach(h => {
          h.handler(event, ...args);
        });
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
        this.emitter.on(evt, handler);
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
      resolve(path, context = {}) {
        const routeInfo = this.match(path);
        if(routeInfo) {
          const ctx = Object.assign({}, context, {
            route: {
              path: routeInfo.path,
              params: routeInfo.params
            }
          });
          let ret = routeInfo.controller(ctx);
          if(!isPromise(ret)) {
            ret = Promise.resolve(ret);
          }
          ret.then(() => this.emitter.emit("route", routeInfo));
          return ret;
        }
        return Promise.reject(`Route not found ${path}`);
      },
      route(path) {
        this.history.push(path);
      },
      start(listener) {
        if(!this.history) {
          const {options} = this, history = this.history = createHistory(options.type, options);
          history.block(options.block);
          this.stopHistoryListener = history.listen((location, action) => {
            const path = location.pathname || "/~error";
            listener(path, action, location);
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
          this.routes.push(makeRoute(r));
        });
        // console.log(this.routes);
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
