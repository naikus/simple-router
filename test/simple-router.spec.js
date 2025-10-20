/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://localhost:8080"}
 */
import {test, expect, beforeEach, afterEach, describe} from "@jest/globals";
import {log} from "console";
import createRouter from "../src/index";

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

const routes = [
  {
    path: "/hello",
    controller: context => {
      return {
        message: "hello"
      };
    }
  },
  {
    path: "/hi/{:name}",
    controller: context => {
      const {route: {params}} = context;
      return params;
    }
  },
  {
    path: "/state-test",
    controller: context => {
      const {route} = context;
      return route.state;
    }
  },
  {
    path: "/hola/{:name}",
    controller: context => {
      const {route: {params}} = context;
      return {
        forward: `/hi/${params.name}`,
        name: params.name
      };
    }
  }
];

// jest.setTimeout(10000);

let router;

beforeEach(() => {
  // console.log("Before all");
  router = createRouter(routes);
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
      console.log("Routes to path", context);
      expect(context.route.path).toBe("/hello");
      expect(context.message).toBe("hello");
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
        expect(context.route.path).toBe("/hola/naikus");
        expect(context.name).toBe("naikus");
        expect(context.forward).toBe("/hi/naikus");
      }catch(e) {
        reject(e);
      }

      // This is the final route for redirect
      router.once("route", event => {
        const context = event.detail;
        // console.log("Final Route", context);
        try {
          expect(context.route.from.path).toBe("/hola/naikus");
          expect(context.route.path).toBe("/hi/naikus");
          resolve();
        }catch(e) {
          reject(e);
        }
      });
    });

    router.route("/hola/naikus");
    return promise;
  });

  test("Throws route error event if route not found", () => {
    let dispose = router.on("route-error", (context) => {
      console.log("Throws route error", context);
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
    const route = router.getRoute("/hi/World");
    expect(route).not.toBeNull();
    expect(route.params).not.toBeNull();
    expect(route.params.name).toBe("World");
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
