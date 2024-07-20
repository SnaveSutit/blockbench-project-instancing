/// <reference path="blockbenchTypeMods.d.ts" />

declare module '*.png' {
	const value: string
	export = value
}

declare module '*.gif' {
	const value: string
	export = value
}

declare module '*.svg' {
	const value: string
	export = value
}

declare module '*.webp' {
	const value: string
	export = value
}

declare module '*.worker.ts' {
	export = Worker
}
