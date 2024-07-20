import { PACKAGE } from './constants'
import { events } from './util/events'
import './util/translation'

// Outliner Elemnts
import './outliner/projectInstanceElement'
// Interface

// Blockbench Mods
import './mods/codecMod'
import './mods/mergeMod'

// Misc imports

// Global

// Uninstall events
events.EXTRACT_MODS.subscribe(() => {
	// @ts-ignore
	globalThis.AnimatedJava = undefined
})

BBPlugin.register(PACKAGE.name, {
	title: PACKAGE.title,
	author: PACKAGE.author.name,
	description: PACKAGE.description,
	icon: 'fa-cubes',
	variant: 'desktop',
	version: PACKAGE.version,
	min_version: PACKAGE.min_blockbench_version,
	tags: ['Projects', 'Instancing'],
	await_loading: true,
	onload() {
		events.LOAD.dispatch()
	},
	onunload() {
		events.UNLOAD.dispatch()
	},
	oninstall() {
		events.INSTALL.dispatch()
	},
	onuninstall() {
		events.UNINSTALL.dispatch()
	},
})
