export type RouteAction = "PUSH" | "POP" | null;

export interface RouteDefn {
  path: string;
  controller: <T>(context: any) => Promise<T> | T;
}

export interface RouteInfo {
  action: string;
  path: string;
  runtimePath: string;
  from?: RouteInfo;
  params: Record<string, string>;
  controller: (context: any) => Promise<any>;
  pattern: RegExp;
  keys: any;
}

export type RouteEventHandler = (...args: any) => void;

export interface Router {
  // emitter: any;
  // current: RouteInfo;
  [propName: string]: any;
  state?: any;
  routes: Array<RouteInfo>;
  options: any;

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
   * @see on
   */
  once(event: string, handler: RouteEventHandler): Function;
  matches(path: string): boolean;
  
  /**
   * Tries to match the Route to the specified path
   * @param {string} path 
   * @returns {RouteInfo|null}
   */
  match(path: string): RouteInfo | null;

  /**
   * Resolve a route specified by path, calling the controller for the rute defn if found
   * @param {string} path The route path
   * @param {string} action "PUSH" | "POP"
   * @param {any} context 
   */
  resolve(path: string, action: RouteAction, context?: any): Promise<any>;
  setState(state: any): void;
  clearState(): void;
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