/* global test expect describe beforeEach, afterEach */
import Router from "../src/simple-router";

const routes = [
  {
    path: "/hello",
    controller: context => {
      return {
        context,
        message: "hello"
      };
    }
  }
];

let router;

beforeEach(() => {
  router = Router.create(routes, {
    type: "memory",
    getUserConfirmation(message, callback) {
      // setTimeout(() => {
        const val = !!Math.round(Math.random());
        console.log(message, val);
        console.log(callback);
        callback(val);
      // }, 100);
    },
    block(location, action) {
      console.log(location, action);
      return `Are you sure you want to go to ${location.pathname}`;
    }
  });
  router.on("before-route", (e, path) => console.log("Before route", path));
  router.on("route", (e, route) => console.log("Route", route));
  router.on("route-error", (e, err) => console.log("Route error", err));
  router.start();
});

afterEach(() => {
  router.stop();
});

describe("Router tests", () => {
  test("Routes to a path", () => {
    router.route("/hello");
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
});
