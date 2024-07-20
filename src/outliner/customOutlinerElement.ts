export interface ICustomOutlinerElementOptions {
	name?: string
	position?: ArrayVector3
	rotation?: ArrayVector3
	visibility?: boolean
}

export class CustomOutlinerElement extends OutlinerElement {
	public static type = 'custom_outliner_element'
	public static icon = 'fa-cube'
	public static selected: CustomOutlinerElement[] = []
	public static all: CustomOutlinerElement[] = []

	// Type
	public type = CustomOutlinerElement.type
	public icon = CustomOutlinerElement.icon

	// Properties
	public name: string
	public position: ArrayVector3
	public rotation: ArrayVector3
	public visibility: boolean
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public preview_controller = PREVIEW_CONTROLLER

	// Transform flags
	public movable = true
	public rotatable = true

	constructor(data: ICustomOutlinerElementOptions, uuid = guid()) {
		super(data, uuid)

		this.extend(data)

		this.name ??= 'resizable_outliner_element'
		this.position ??= [0, 0, 0]
		this.rotation ??= [0, 0, 0]
		this.visibility ??= true

		CustomOutlinerElement.all.safePush(this)
		Object.getPrototypeOf(this).constructor.all.safePush(this)
	}

	remove() {
		CustomOutlinerElement.all.remove(this)
		Object.getPrototypeOf(this).constructor.all.remove(this)
		return super.remove()
	}

	get origin() {
		return this.position
	}

	getWorldCenter(): THREE.Vector3 {
		Reusable.vec3.set(0, 0, 0)
		// @ts-ignore
		return THREE.fastWorldPosition(this.mesh, Reusable.vec2).add(Reusable.vec3) as THREE.Vector3
	}

	public extend(data: any) {
		for (const key in Object.getPrototypeOf(this).constructor.properties) {
			Object.getPrototypeOf(this).constructor.properties[key].merge(this, data)
		}
		if (data.visibility !== undefined) {
			this.visibility = data.visibility
		}

		return this
	}

	select() {
		if (Group.selected) {
			Group.selected.unselect()
		}
		if (!Pressing.ctrl && !Pressing.shift) {
			if (Cube.selected.length) {
				Cube.selected.forEachReverse(el => el.unselect())
			}
			if (selected.length) {
				selected.forEachReverse(el => el !== this && el.unselect())
			}
		}

		Object.getPrototypeOf(this).constructor.selected.safePush(this)
		this.selectLow()
		this.showInOutliner()
		updateSelection()
		if (Animator.open && Blockbench.Animation.selected) {
			Blockbench.Animation.selected.getBoneAnimator(this)?.select()
		}
		return this
	}

	unselect() {
		if (!this.selected) return
		if (
			Animator.open &&
			Timeline.selected_animator &&
			Timeline.selected_animator.element === this &&
			Timeline.selected
		) {
			Timeline.selected.empty()
		}
		Project!.selected_elements.remove(this)
		Object.getPrototypeOf(this).constructor.selected.remove(this)
		this.selected = false
		TickUpdates.selection = true
		this.preview_controller.updateHighlight?.(this)
	}

	selectLow() {
		Project!.selected_elements.safePush(this)
		this.selected = true
		TickUpdates.selection = true
		return this
	}

	getUndoCopy() {
		const copy: Record<string, any> = {}

		for (const key in Object.getPrototypeOf(this).constructor.properties) {
			Object.getPrototypeOf(this).constructor.properties[key].copy(this, copy)
		}

		copy.type = this.type
		copy.uuid = this.uuid
		return copy
	}

	getSaveCopy() {
		const el: Record<string, any> = {}
		for (const key in Object.getPrototypeOf(this).constructor.properties) {
			Object.getPrototypeOf(this).constructor.properties[key].copy(this, el)
		}
		el.type = this.type
		el.uuid = this.uuid
		return el
	}
}
new Property(CustomOutlinerElement, 'string', 'name', { default: 'custom_outliner_element' })
new Property(CustomOutlinerElement, 'vector', 'position', { default: [0, 0, 0] })
new Property(CustomOutlinerElement, 'vector', 'rotation', { default: [0, 0, 0] })
new Property(CustomOutlinerElement, 'string', 'visibility', { default: true })

export const PREVIEW_CONTROLLER = new NodePreviewController(CustomOutlinerElement, {
	setup(el: CustomOutlinerElement) {
		const mesh = new THREE.Mesh()
		mesh.fix_rotation = new THREE.Euler(0, 0, 0, 'ZYX')
		mesh.fix_rotation.x = Math.degToRad(el.rotation[0])
		mesh.fix_rotation.y = Math.degToRad(el.rotation[1])
		mesh.fix_rotation.z = Math.degToRad(el.rotation[2])
		mesh.fix_position = new THREE.Vector3(...el.position)
		Project!.nodes_3d[el.uuid] = mesh

		el.preview_controller.updateGeometry?.(el)
		el.preview_controller.dispatchEvent('setup', { element: el })
	},
	updateTransform(el: CustomOutlinerElement) {
		NodePreviewController.prototype.updateTransform.call(el.preview_controller, el)
		if (el.mesh.fix_position) {
			el.mesh.fix_position.set(...el.position)
			if (el.parent instanceof Group) {
				el.mesh.fix_position.x -= el.parent.origin[0]
				el.mesh.fix_position.y -= el.parent.origin[1]
				el.mesh.fix_position.z -= el.parent.origin[2]
			}
		}
		if (el.mesh.fix_rotation) {
			el.mesh.fix_rotation.copy(el.mesh.rotation)
		}
		// @ts-ignore
		el.preview_controller.dispatchEvent('update_transform', { element: el })
	},
})
