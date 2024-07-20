import { PACKAGE } from '../constants'
import { ProjectInstanceElement } from '../outliner/projectInstanceElement'
import { loadBBModelIntoProject } from '../systems/bbmodelLoader'
import { createBlockbenchMod } from '../util/moddingTools'

createBlockbenchMod(
	`${PACKAGE.name}:codecMod`,
	{
		originalFunctions: {} as Record<string, typeof Codec.prototype.compile>,
	},
	context => {
		for (const [name, codec] of Object.entries(Codecs)) {
			if (name === 'project') continue
			context.originalFunctions[name] = codec.compile

			codec.compile = function (this: Codec, options: any) {
				const instances = ProjectInstanceElement.all
				console.log('Project Instances:', instances)
				// TODO - Modify the outliner to temporarally include all of the elements from all instanced models.

				const unloaders: Array<() => void> = []
				for (const instance of instances) {
					if (!instance.projectJSON) {
						console.error('Instance has no saved project JSON:', instance)
						continue
					}
					unloaders.push(loadBBModelIntoProject(instance.projectJSON, instance))
				}

				const result = context.originalFunctions[name].call(this, options)

				for (const unload of unloaders) {
					unload()
				}

				// eslint-disable-next-line @typescript-eslint/no-unsafe-return
				return result
			}
		}

		return context
	},
	context => {
		for (const [name, codec] of Object.entries(Codecs)) {
			if (context.originalFunctions[name]) {
				codec.compile = context.originalFunctions[name]
			}
		}
	}
)
