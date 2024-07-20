import { ComponentConstructorOptions } from 'svelte'

export type SvelteComponentConstructor<T, U extends ComponentConstructorOptions> = new (
	options: U
) => T

export * from './svelteDialog'
