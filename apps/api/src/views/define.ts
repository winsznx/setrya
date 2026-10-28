import type { Auth, Ctx } from '../http/route';

export interface ViewQuery {
  /** Required string parameter; a missing one is a client bug, so it fails as invalid input. */
  get(name: string): string;
  optional(name: string): string | undefined;
}

export interface ViewDefinition<A extends Auth, T> {
  auth: A;
  /** Method syntax on purpose: the registry stores loaders of every auth level side by side. */
  load(ctx: Ctx<A>, query: ViewQuery): Promise<T>;
}

export function defineView<A extends Auth, T>(auth: A, load: (ctx: Ctx<A>, query: ViewQuery) => Promise<T>): ViewDefinition<A, T> {
  return { auth, load };
}
