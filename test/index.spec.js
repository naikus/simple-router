/* global test expect describe beforeEach, afterEach */
import Router from "../src";

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
  router = Router.create(routes, {type: "memory"});
  router.start();
});

afterEach(() => {
  router.stop();
});

describe("Router tests", () => {
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
