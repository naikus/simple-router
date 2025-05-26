/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://localhost:8080"}
 */
import {test, expect, beforeEach, afterEach, describe} from "@jest/globals";
import {log} from "console";
import create from "../src/simple-router";

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
        redirect: `/hi/${params.name}`,
        name: params.name
      };
    }
  }
];

// jest.setTimeout(10000);

let router;

beforeEach(() => {
  // console.log("Before all");
  router = create(routes, {
  });
  router.start();
});


afterEach(() => {
  router.stop();
});

describe("Router tests", () => {
  test("Routes to a path", () => {
    let dispose = router.on("route", (context) => {
      console.log("Routes to path", context);
      dispose();
      expect(context.route.path).toBe("/hello");
      expect(context.message).toBe("hello");
    });
    router.route("/hello");
  });

  test("Redirects to correct route", async () => {
    let dispose = router.on("route", (context) => {
      console.log("Redirects to correct route", context);
      dispose();
      // expect(true).toBe(true);
      expect(context.route.path).toBe("/hi/naikus");
      expect(context.name).toBe("naikus");
    });
    router.route("/hola/naikus");
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
    const routeInfo = router.match("/hi/World");
    expect(routeInfo).not.toBeNull();
    expect(routeInfo.params).not.toBeNull();
    expect(routeInfo.params.name).toBe("World");
  });

  test("Controller gets recent state", () => {
    const dispose = router.on("route", (context) => {
      console.log("Controller gets state", context);
      dispose();
      console.log("Context is", context);
      expect(context.hello).toBe("World");
    });
    router.route("/state-test", {hello: "World"});
  });

  test("Before route fired correctly", () => {
    // console.log("Events before-route");
    const dispose = router.on("before-route", (path) => {
      console.log("Before route", path);
      dispose();
      // console.log("before-route", path);
      expect(path).not.toBeNull();
    });
    router.route("/hi/Events");
  });
});
