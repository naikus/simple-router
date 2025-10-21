export type RouteAction = "PUSH" | "POP" | null;

export interface Route {
  forwarded?: boolean;
  action?: RouteAction;
  path: string;
  from?: Route;
  params: Record<string, string>;
}

export interface RouteContext {
  route: Route;
  [propName: string]: any;
}

export interface EmptyRouteContext {
  route?: Route;
  [propName: string]: any;
}


export type RouteControllerOpts = {
  signal?: AbortSignal
}
export interface RouteDefn {
  path: string;
  // controller: <T>(context: RouteContext, opts?: RouteControllerOpts) => Promise<T> | T;
  controller: (context: RouteContext, opts?: RouteControllerOpts) => Promise<Record> | Record;
}

export interface RouteInfo extends RouteDefn {
  pattern: RegExp;
  keys: any;
}

export type RouteEventHandler = (...args: any) => void;
export type RouteHistoryListener = (route: string, action: RouteAction) => void;

export interface RouteHistory {
  getSize: () => number;
  /**
   * Start listening to hash based route history
   * @param listener 
   * @returns {Function} Un-subscriber
   */
  listen: (listener: RouteHistoryListener) => Function;
  push: (path: string) => void;
  replace: (path: string) => void;
  /**
   * Set a path and push it on the stack without calling the hash listener
   * @param path 
   * @param push 
   * @return {void}
   */
  set: (path: string, push?: boolean) => void;

  /**
   * Pop from the history
   * @param toPath 
   * @return {void}
   */
  pop: (toPath?: string) => void;
}

export interface Router {
  // emitter: any;
  // current: RouteInfo;
  [propName: string]: any;
  // state?: any;
  // routes: Array<RouteInfo>;
  // options: any;

  /**
   * Listen for router event.
   * @param {string} event Event name, one of "before-route" | "route" | "route-error"
   * @param {function} handler The handler to call for the event
   * @returns {function} The unsubscribe function;
   */
  on(event: string, handler: RouteEventHandler): Function;

  /**
   * Listen for an event once
   * @param {string} event The event name
   * @param {function} handler The handler
   * @returns {function} The unsubscribe function
   * @see #on
   */
  once(event: string, handler: RouteEventHandler): Function;

  /**
   * Detemines if the specified path matches a route defined with the router
   * @param {string} path The path to match (runtime path)
   * @returns {true} If there's a match
   */
  matches(path: string): boolean;
  
  /**
   * Tries to match the Route to the specified path
   * @param {string} path 
   * @returns {RouteInfo|null}
   */
  match(path: string): RouteInfo | null;
  getRoute(path: string): Route | null;

  /**
   * Resolve a route specified by path, calling the controller for the rute defn if found
   * @param {string} path The route path
   * @param {string} action "PUSH" | "POP"
   * @param {any} context 
   */
  // resolve(path: string, action: RouteAction, context?: any): Promise<any>;
  // setState(state: any): void;
  // clearState(): void;
  route(path: string, state?: any, replace?: boolean): void;
  back(toPath?: string, state?: any): void;
  set(routePath: string, state?: any): void;
  getBrowserRoute(): string | null;
  getCurrentRoute(): RouteInfo | null;
  start(): void;
  stop(): void;
  addRoutes(routes: RouteDefn[]): void;
  addRoute(route: RouteDefn): void;
}

declare function create(routes: Array<RouteDefn>, options: any): Router;