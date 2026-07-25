/**
 * Shared no-op API client that replaces the old DB client.
 * Every query-builder method is chainable and awaitable.
 * Replace the internals with your real backend calls when ready.
 */

function queryBuilder(): any {
  const result: any = { data: [] as any[], error: null, count: 0 };
  const builder: any = {
    select:      (...a: any[]) => builder,
    insert:      (...a: any[]) => builder,
    update:      (...a: any[]) => builder,
    delete:      (...a: any[]) => builder,
    upsert:      (...a: any[]) => builder,
    eq:          (...a: any[]) => builder,
    neq:         (...a: any[]) => builder,
    in:          (...a: any[]) => builder,
    is:          (...a: any[]) => builder,
    gt:          (...a: any[]) => builder,
    gte:         (...a: any[]) => builder,
    lt:          (...a: any[]) => builder,
    lte:         (...a: any[]) => builder,
    like:        (...a: any[]) => builder,
    ilike:       (...a: any[]) => builder,
    order:       (...a: any[]) => builder,
    limit:       (...a: any[]) => builder,
    range:       (...a: any[]) => builder,
    single:      ()            => ({ ...result, data: null, then: (r: any, j?: any) => Promise.resolve({ ...result, data: null }).then(r, j) }),
    maybeSingle: ()            => ({ ...result, data: null, then: (r: any, j?: any) => Promise.resolve({ ...result, data: null }).then(r, j) }),
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

export const DB = {
  from: (_table: string) => queryBuilder(),
  rpc:  async (..._a: any[]) => ({ data: null, error: null }),
  auth: {
    getUser:    async () => ({ data: { user: null }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    signOut:    async () => ({ error: null }),
    signInWithPassword: async (_creds: any) => ({ data: { user: null, session: null }, error: null }),
    onAuthStateChange:  (_cb: any) => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  storage: {
    from: (_bucket: string) => ({
      upload:        async (...a: any[]) => ({ data: null, error: null }),
      getPublicUrl:  (path: string) => ({ data: { publicUrl: '' } }),
      remove:        async (...a: any[]) => ({ data: null, error: null }),
    }),
  },
  channel: (_name: string) => ({
    on: (...a: any[]) => ({ subscribe: () => ({}) }),
  }),
  removeChannel: (_ch: any) => {},
};
