/* global jest setTimeout test expect describe beforeAll, afterAll */
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
  },
  {
    path: "/hi/:name",
    controller: context => {
      const {route: {params}} = context;
      return params;
    }
  }
];

// jest.setTimeout(10000);

let router;

beforeAll(() => {
  console.log("Before all");
  router = Router.create(routes, {
    type: "memory",
    getUserConfirmation(message, callback) {
      // setTimeout(() => {
      const val = !!Math.round(Math.random());
      // console.log(message, val);
      // console.log(callback);
      callback(val);
      // }, 100);
    },
    block(location, action) {
      // console.log(location, action);
      return `Are you sure you want to go to ${location.pathname}`;
    }
  });
  router.start();
});


afterAll(() => {
  router.stop();
});


describe("Router tests", () => {
  test("Routes to a path", () => {
    let subs = router.on("route", (event, ret) => {
      subs.dispose();
      expect(ret.context.route.path).toBe("/hello");
      expect(ret.message).toBe("hello");
    });
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

  test("Route params extraction", () => {
    const routeInfo = router.match("/hi/World");
    expect(routeInfo).not.toBeNull();
    expect(routeInfo.params).not.toBeNull();
    expect(routeInfo.params.name).toBe("World");
  });

  test("Before route fired correctly", () => {
    // console.log("Events before-route");
    const subs = router.on("before-route", (event, path) => {
      subs.dispose();
      // console.log("before-route", path);
      expect(path).not.toBeNull();
    });
    router.route("/hi/Events");
  });
});
