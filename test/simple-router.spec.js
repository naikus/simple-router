
import {test, expect, beforeEach, afterEach, describe} from "vitest";
import createRouter from "../src/simple-router";

/**
 * @typedef {import("../src/types").RouteDefn} RouteDefn
 * @typedef {import("../src/types").Router} Router
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
 * Delays the resolve of a value
 * @param {any} val
 * @param {number} timeout
 * @return {Promise}
 */
function delay(val, timeout = 1000) {
  return new Promise((res, rej) => {
    // eslint-disable-next-line no-undef
    setTimeout(() => res(val), timeout);
  });
}

/** @type {Array<RouteDefn>} */
const routes = [
  {
    path: "/hello",
    controller: context => {
      return {
        message: "hello world"
      };
    }
  },
  {
    path: "/forward-target/{:name}",
    controller: context => {
      const {route: {params}} = context;
      return params;
    }
  },
  {
    path: "/params-test/{:name}/{:value}",
    controller: context => {
      const {route: {params}} = context;
      return params;
    }
  },
  {
    path: "/forward-test/{:name}",
    controller: context => {
      const {route: {params}} = context;
      return {
        forward: `/forward-target/${params.name}`,
        name: params.name
      };
    }
  },
  {
    path: "/auto-abort-test",
    controller: context => {
      return delay({
        delayed: true
      });
    }
  }
];


/**
 * 
 * @return {[Router, function]}
 */
function makeRouter() {
  const router = createRouter(routes, {});
  router.start();
  return [router, () => router.stop()];
}


describe("Router tests", () => {
  let router;

  test("Routes to a path", () => {
    const {promise, resolve, reject} = promiseWithResolvers(),
        [router, cleanup] = makeRouter();
    router.once("route", event => {
      const context = event.detail;
      expect(context.route.path).toBe("/hello");
      expect(context.message).toBe("hello world");
      resolve();
    });
    router.once("route-error", event => {
      reject(event.detail);
    });

    router.route("/hello");
    return promise.finally(() => cleanup);
  });

  test("Forwards to correct route", () => {
    const {promise, resolve, reject} = promiseWithResolvers(),
        [router, cleanup] = makeRouter();

    router.once("route-forward", event => {
      const context = event.detail;
      try {
        // console.log("Redirects route", context);
        expect(context.route.path).toBe("/forward-test/naikus");
        expect(context.name).toBe("naikus");
        expect(context.forward).toBe("/forward-target/naikus");
      }catch(e) {
        reject(e);
      }
    });

    // This is the final route for redirect
    router.once("route", event => {
      const context = event.detail;
      // console.log("Final Route", context);
      try {
        expect(context.route.from.path).toBe("/forward-test/naikus");
        expect(context.route.path).toBe("/forward-target/naikus");
        resolve();
      }catch(e) {
        reject(e);
      }
    });

    router.route("/forward-test/naikus");
    return promise.finally(() => cleanup);
  });

  test("Throws route error event if route not found", () => {
    const {promise, resolve, reject} = promiseWithResolvers(),
        [router, cleanup] = makeRouter();

    let dispose = router.on("route-error", event => {
      // console.log("Throws route error", event.detail);
      dispose();
      expect(true);
      resolve();
    });
    router.route("/foo/bar");
    return promise.finally(() => cleanup);
  });

  test("Create router instance", () => {
    expect(router).not.toBeNull();
  });

  test("Test route matches", () => {
    const [router, cleanup] = makeRouter();
    expect(router.matches("/hello")).toBe(true);
    cleanup();
  });

  test("Test route matches with trailing slash", () => {
    const [router, cleanup] = makeRouter();
    expect(router.matches("/hello/")).toBe(true);
    cleanup();
  });

  test("Test route does not match", () => {
    const [router, cleanup] = makeRouter();
    expect(router.matches("/hello/w")).toBe(false);
    cleanup();
  });

  test("The match returns a route object when route matches", () => {
    const [router, cleanup] = makeRouter(),
        routeInfo = router.match("/hello");
    expect(routeInfo).not.toBeNull();
    expect(routeInfo?.path).toBe("/hello");
  });

  test("Route params extraction", () => {
    const [router, cleanup] = makeRouter();
    const route = router.getRoute("/params-test/bar/baz");
    expect(route).not.toBeNull();
    const params = route?.params;
    expect(params?.name).toBe("bar");
    expect(params?.value).toBe("baz");
    cleanup();
  });

  test("Before route fired correctly", () => {
    // console.log("Events before-route");
    const {promise, resolve} = promiseWithResolvers(),
        [router, cleanup] = makeRouter();
    let myRouter = createRouter(routes, {});

    myRouter.start();
    myRouter.once("before-route", (event) => {
      const path = event.detail;
      expect(path).not.toBeNull();
      expect(path).toBe("/hello");
      resolve();
    });
    router.route("/hello");
    return promise.finally(() => cleanup());
  });

  test("Ongoing routing gets aborted if another call to route() is made while routing", async() => {
    const {promise, resolve, reject} = promiseWithResolvers(),
        [router, cleanup] = makeRouter();

    router.once("route", event => {
      // console.log(event.detail);
      const routeInfo = event.detail;
      // console.log("Detail is -------- ", routeInfo);
      expect(routeInfo.route.path).toBe("/hello");
      // resolve();
    });

    router.once("route-abort", e => {
      // console.log(e.detail.reason);
      const {reason} = e.detail;
      expect(reason.data).toBe("/hello");
      resolve();
    });

    router.route("/auto-abort-test"); // this one takes 1 sec to finish
    // console.log("Calling another route immediately");
    router.route("/hello");
    return promise.finally(() => cleanup());
  });

  test("Aborting route from before-route handler", () => {
    const {promise, resolve, reject} = promiseWithResolvers(),
        [router, cleanup] = makeRouter();

    router.on("before-route", event => {
      event.preventDefault();
    });

    router.once("route-abort", event => {
      const {detail} = event;
      try {
        expect(detail.path).toBe("/hello");
        expect(detail.reason.name).toBe("prevented");
        resolve();
      }catch(e) {
        reject(e);
      }
    });

    router.route("/hello");
    return promise.finally(() => cleanup);
  });
});
