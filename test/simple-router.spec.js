/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://localhost:8080"}
 */
import {test, expect, beforeEach, afterEach, describe} from "@jest/globals";
import {log} from "console";
import createRouter from "../src/simple-router";

/**
 * @typedef {import("../src/types").RouteDefn} RouteDefn
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

// jest.setTimeout(10000);

let router;

beforeEach(() => {
  // console.log("Before all");
  router = createRouter(routes, {});
  router.start();
});


afterEach(() => {
  router.stop();
});

describe("Router tests", () => {
  test("Routes to a path", async () => {
    const {promise, resolve, reject} = promiseWithResolvers();
    router.once("route", event => {
      const context = event.detail;
      // console.log("Routes to path", context);
      expect(context.route.path).toBe("/hello");
      expect(context.message).toBe("hello world");
      resolve();
    });
    router.once("route-error", event => {
      reject(event.detail);
    });

    router.route("/hello");
    return promise;
  });

  test("Forwards to correct route", async () => {
    const {promise, resolve, reject} = promiseWithResolvers();

    router.once("route", event => {
      const context = event.detail;
      try {
        // console.log("Redirects route", context);
        expect(context.route.path).toBe("/forward-test/naikus");
        expect(context.name).toBe("naikus");
        expect(context.forward).toBe("/forward-target/naikus");
      }catch(e) {
        reject(e);
      }

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
    });

    router.route("/forward-test/naikus");
    return promise;
  });

  test("Throws route error event if route not found", () => {
    let dispose = router.on("route-error", (context) => {
      // console.log("Throws route error", context);
      dispose();
      expect(true);
    });
    router.route("/foo/bar");
  });

  test("Create router instance", () => {
    expect(router).not.toBeNull();
  });

  test("Test route matches", () => {
    expect(router.matches("/hello")).toBe(true);
  });

  test("Test route matches with trailing slash", () => {
    expect(router.matches("/hello/")).toBe(true);
  });

  test("Test route does not match", () => {
    expect(router.matches("/hello/w")).toBe(false);
  });

  test("The match returns a route object when route matches", () => {
    const routeInfo = router.match("/hello");
    expect(routeInfo).not.toBeNull();
    expect(routeInfo.path).toBe("/hello");
  });

  test("Route params extraction", () => {
    const route = router.getRoute("/params-test/bar/baz");
    expect(route).not.toBeNull();
    const params = route.params;
    // console.log(params);
    expect(params.name).toBe("bar");
    expect(params.value).toBe("baz");
  });

  test("Ongoing routing gets aborted if another call to route() is made while routing", () => {
    const {promise, resolve} = promiseWithResolvers();
    router.on("route-error", event => {
      const data = event.detail;
      // console.log(data.error);
      resolve();
    });

    router.route("/auto-abort-test"); // this one takes 1 sec to finish
    // console.log("Calling another route immediately");
    router.route("/hello");
    return promise;
  });

  /*
  test("Controller gets recent state", () => {
    const dispose = router.on("route", (context) => {
      console.log("Controller gets state", context);
      dispose();
      console.log("Context is", context);
      expect(context.hello).toBe("World");
    });
    router.route("/state-test", {hello: "World"});
  });
  */

  test("Before route fired correctly", () => {
    // console.log("Events before-route");
    const dispose = router.on("before-route", (path) => {
      console.error("Before route", path);
      dispose();
      // console.log("before-route", path);
      expect(path).not.toBeNull();
    });
    router.route("/hi/Events");
  });
});
