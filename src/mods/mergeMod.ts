import { PACKAGE } from '../constants'
import { createBlockbenchMod } from '../util/moddingTools'

createBlockbenchMod(
	`${PACKAGE.name}:mergeMod`,
	{
		originalFunction: Merge.function,
	},
	context => {
		Merge.function = function (source: any, index?: any, validate?: boolean) {
			if (source instanceof Codec && index === 'compile') {
				console.log('Codec compile:', source)
			}

			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return context.originalFunction.call(this, source, index, validate)
		}

		return context
	},
	context => {
		Merge.function = context.originalFunction
	}
)
