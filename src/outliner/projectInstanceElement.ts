import { PACKAGE } from '../constants'
import {
	clearCachedInstance,
	generateMeshFromBBModel,
	IBBModelFormatJSON,
} from '../systems/bbmodelLoader'
import { events } from '../util/events'
import { createAction, createBlockbenchMod } from '../util/moddingTools'
import { translate } from '../util/translation'
import { CustomOutlinerElement, type ICustomOutlinerElementOptions } from './customOutlinerElement'
import type { FSWatcher } from 'fs'

interface InstanceOptions extends ICustomOutlinerElementOptions {
	project_path?: string
}

const WATCHER_MAP = new Map<string, FSWatcher>()

export class ProjectInstanceElement extends CustomOutlinerElement {
	static type = `${PACKAGE.name}:instance`
	static icon = 'fa-cubes'
	static selected: ProjectInstanceElement[] = []
	static all: ProjectInstanceElement[] = []

	public type = ProjectInstanceElement.type
	public icon = ProjectInstanceElement.icon
	public needsUniqueName = true
	public needsUpdate = true
	public projectJSON: IBBModelFormatJSON | undefined

	private _projectPath: string
	private _projectUUID: string

	public menu = new Menu([
		...Outliner.control_menu_group,
		SELECT_PROJECT_ACTION,
		'_',
		'rename',
		'delete',
	])
	public buttons = [Outliner.buttons.export, Outliner.buttons.locked, Outliner.buttons.visibility]
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public preview_controller = PREVIEW_CONTROLLER

	constructor(data: InstanceOptions, uuid = guid()) {
		super(data, uuid)
		this.name = 'Project Instance'
		this._projectPath ??= ''
		super.extend(data)
		this._projectUUID = Project!.uuid

		Object.defineProperty(this, 'export', {
			get() {
				return false
			},
			set() {
				// Do nothing
			},
		})

		events.SELECT_PROJECT.subscribe(project => {
			if (this.needsUpdate && this._projectUUID === project.uuid) {
				console.log('Updating project...')
				this.updateProject()
			}
		})
	}

	get projectPath() {
		return this._projectPath
	}
	set projectPath(path: string) {
		if (!path) return
		if (WATCHER_MAP.has(this._projectPath)) {
			WATCHER_MAP.get(this._projectPath)!.close()
			WATCHER_MAP.delete(this._projectPath)
		}
		this._projectPath = path
		WATCHER_MAP.set(
			path,
			fs.watch(path, () => {
				clearCachedInstance(path)
				this.needsUpdate = true
			})
		)
		requestAnimationFrame(() => {
			this.updateProject()
		})
	}

	updateProject() {
		console.log('Updating project...')
		if (!this._projectPath) {
			console.log('No project path selected')
			return
		}

		try {
			const content = fs.readFileSync(this._projectPath, 'utf8')
			this.projectJSON = JSON.parse(content)
		} catch (error) {
			console.error(error)
			return
		}
		this.needsUpdate = false
		const mesh = generateMeshFromBBModel(this.projectJSON!, this._projectPath)
		if (!mesh) return

		mesh.name = this.uuid
		mesh.no_export = true
		mesh.isElement = true
		mesh.outline!.name = this.uuid + '_outline'
		mesh.outline!.visible = this.selected
		mesh.outline!.no_export = true

		Project!.nodes_3d[this.uuid].removeFromParent()
		Project!.nodes_3d[this.uuid] = mesh
		Canvas.updateAll()
	}
}
new Property(ProjectInstanceElement, 'string', 'projectPath', {
	label: translate('instance.property.project_path'),
})
OutlinerElement.registerType(ProjectInstanceElement, ProjectInstanceElement.type)

async function selectFile() {
	const result = await electron.dialog.showOpenDialog({
		properties: ['openFile'],
		filters: [
			{
				extensions: ['bbmodel', 'ajblueprint'],
				name: translate('instance.file_dialog_filter.all'),
			},
			{ extensions: ['bbmodel'], name: translate('instance.file_dialog_filter.bbmodel') },
			{
				extensions: ['ajblueprint'],
				name: translate('instance.file_dialog_filter.ajblueprint'),
			},
		],
		message: translate('action.select_project_to_instance.file_dialog_message'),
	})
	return result.filePaths[0]
}

export const SELECT_PROJECT_ACTION = createAction(`${PACKAGE.name}:select_project_to_instance`, {
	name: translate('action.select_project_to_instance.title'),
	icon: 'folder_open',
	click() {
		if (ProjectInstanceElement.selected.length === 0) return

		console.log('Select project to instance')
		void selectFile().then(path => {
			if (!path) return
			Undo.initEdit({
				outliner: true,
				elements: ProjectInstanceElement.selected,
				selection: true,
			})
			for (const instance of ProjectInstanceElement.selected) {
				instance.projectPath = path
				instance.updateProject()
			}
			Undo.finishEdit('Select Project', {
				outliner: true,
				elements: ProjectInstanceElement.selected,
				selection: true,
			})
		})
	},
})

export const CREATE_ACTION = createAction(`${PACKAGE.name}:create_instance`, {
	name: translate('action.create_instance.title'),
	icon: ProjectInstanceElement.icon,
	category: PACKAGE.name,
	condition() {
		return true
	},
	click() {
		Undo.initEdit({ outliner: true, elements: [], selection: true })

		const textDisplay = new ProjectInstanceElement({}).init()
		const group = getCurrentGroup()

		if (group instanceof Group) {
			textDisplay.addTo(group)
			textDisplay.extend({ position: group.origin.slice() as ArrayVector3 })
		}

		selected.forEachReverse(el => el.unselect())
		Group.selected && Group.selected.unselect()
		textDisplay.select()

		Undo.finishEdit('Create Instance', {
			outliner: true,
			elements: selected,
			selection: true,
		})

		return textDisplay
	},
})

createBlockbenchMod(
	`${PACKAGE.name}:instance`,
	{
		subscriptions: [] as Array<() => void>,
	},
	context => {
		Interface.Panels.outliner.menu.addAction(CREATE_ACTION, 3)
		Toolbars.outliner.add(CREATE_ACTION, 0)
		MenuBar.menus.edit.addAction(CREATE_ACTION, 8)

		context.subscriptions.push(
			events.SELECT_PROJECT.subscribe(project => {
				project.projectInstanceElements ??= []
				ProjectInstanceElement.all.empty()
				ProjectInstanceElement.all.push(...project.projectInstanceElements)
			}),
			events.UNSELECT_PROJECT.subscribe(project => {
				project.projectInstanceElements = [...ProjectInstanceElement.all]
				ProjectInstanceElement.all.empty()
			})
		)
		return context
	},
	context => {
		Interface.Panels.outliner.menu.removeAction(CREATE_ACTION.id)
		Toolbars.outliner.remove(CREATE_ACTION)
		MenuBar.menus.edit.removeAction(CREATE_ACTION.id)

		context.subscriptions.forEach(unsub => unsub())
	}
)

export const PREVIEW_CONTROLLER = new NodePreviewController(ProjectInstanceElement, {
	setup(el: ProjectInstanceElement) {
		CustomOutlinerElement.prototype.preview_controller.setup(el)
	},
	updateTransform(el: ProjectInstanceElement) {
		CustomOutlinerElement.prototype.preview_controller.updateTransform(el)
	},
	updateGeometry(el: ProjectInstanceElement) {
		if (el.needsUpdate) {
			el.updateProject()
		}
	},
	updateHighlight(el: ProjectInstanceElement, force?: boolean | ProjectInstanceElement) {
		const highlighted = Modes.edit && (force === true || force === el || el.selected) ? 1 : 0

		const blockModel = el.mesh.children.at(0) as THREE.Mesh
		if (!blockModel) return
		for (const child of blockModel.children) {
			if (!(child instanceof THREE.Mesh)) continue
			const highlight = child.geometry.attributes.highlight

			if (highlight.array[0] != highlighted) {
				// @ts-ignore
				highlight.array.set(Array(highlight.count).fill(highlighted))
				highlight.needsUpdate = true
			}
		}
	},
})
