import { ProjectInstanceElement } from '../outliner/projectInstanceElement'
import { mergeGeometries } from '../util/bufferGeometryUtils'
import { translate } from '../util/translation'

export interface IBBModelFormatJSON {
	textures?: Texture[]
	elements?: any[]
	outliner?: any[]
	[key: string]: any
}

const MODEL_CACHE = new Map<string, THREE.Mesh>()

export function clearCachedInstance(model: string) {
	MODEL_CACHE.delete(model)
}

export function generateMeshFromBBModel(
	model: IBBModelFormatJSON,
	path: string
): THREE.Mesh | undefined {
	console.log(`Parsing BBModel from '${path}'...`)

	if (MODEL_CACHE.has(path)) {
		console.log('Using cached model...')
		return cloneCachedMesh(MODEL_CACHE.get(path)!)
	}

	const mesh = new THREE.Mesh()
	const textures: Texture[] = []

	if (model.textures) {
		for (const texture of model.textures) {
			const newTexture = new Texture(texture, texture.uuid)
			textures.push(newTexture)
			Project!.textures.safePush(newTexture)
			if (texture.relative_path && Project!.save_path) {
				const resolvedPath = PathModule.resolve(Project!.save_path, texture.relative_path)
				if (fs.existsSync(resolvedPath)) {
					newTexture.fromPath(resolvedPath)
					continue
				}
			}
			if (texture.path && fs.existsSync(texture.path) && !model.meta.backup) {
				newTexture.fromPath(texture.path)
			} else if (texture.source && texture.source.startsWith('data:')) {
				newTexture.fromDataURL(texture.source)
			}
		}
	}

	const geos: THREE.BufferGeometry[] = []
	const outlines: THREE.BufferGeometry[] = []
	if (model.elements) {
		const defaultTexture = Texture.getDefault()
		for (const element of model.elements) {
			if (element.type === ProjectInstanceElement.type) {
				console.warn('Cannot have recursive ProjectInstanceElements!')
				continue
			} else if (element.type !== 'cube') {
				console.warn(`Unsupported element type '${element.type as string}'!`)
				continue
			}
			const newElement = OutlinerElement.fromSave(element, true)
			switch (true) {
				case newElement instanceof Cube: {
					for (const face in newElement.faces) {
						if (element.faces) {
							const texture =
								element.faces[face].texture !== undefined &&
								textures[element.faces[face].texture]
							if (texture) {
								newElement.faces[face].texture = texture.uuid
							}
						} else if (
							defaultTexture &&
							newElement.faces &&
							newElement.faces[face].texture !== undefined
						) {
							newElement.faces[face].texture = defaultTexture.uuid
						}
					}
					break
				}
			}
			const elementMesh = newElement.mesh
			Canvas.updateAll()
			newElement.remove()
			elementMesh.outline?.removeFromParent()
			mesh.add(elementMesh)
			let geo = (elementMesh as THREE.Mesh)?.geometry
			if (geo) {
				geo = geo.clone()
				geo.rotateX(elementMesh.rotation.x)
				geo.rotateY(elementMesh.rotation.y)
				geo.rotateZ(elementMesh.rotation.z)
				geo.translate(
					elementMesh.position.x,
					elementMesh.position.y,
					elementMesh.position.z
				)
				geos.push(geo)
				const outline = new THREE.EdgesGeometry(geo)
				outlines.push(outline)
			}
		}
	}

	if (geos.length === 0 && outlines.length === 0) {
		console.warn('No elements found in model!')
		Blockbench.showMessageBox({
			title: translate('model_loader.no_elements_found.title'),
			message: translate('model_loader.no_elements_found.message'),
			icon: 'warning',
		})
		return
	}

	if (outlines.length > 0) {
		const geo = mergeGeometries(geos)!
		mesh.geometry = geo
		mesh.material = Canvas.transparentMaterial
		const outlineGeo = mergeGeometries(outlines)!
		mesh.outline = new THREE.LineSegments(outlineGeo, Canvas.outlineMaterial)
		mesh.add(mesh.outline)
	}

	for (const texture of textures) {
		texture.remove(true)
	}

	Canvas.updateAll()
	Validator.validate()

	MODEL_CACHE.set(path, mesh)
	return cloneCachedMesh(mesh)
}

function cloneCachedMesh(mesh: THREE.Mesh): THREE.Mesh {
	const clone = mesh.clone(true)
	const outline = clone.children.at(-1)!
	clone.remove(outline)
	clone.outline = outline.clone(true)
	clone.add(clone.outline)
	return clone
}

export function loadBBModelIntoProject(
	model: IBBModelFormatJSON,
	instance: ProjectInstanceElement
): () => void {
	const textures: Texture[] = []

	if (model.textures) {
		for (const texture of model.textures) {
			const newTexture = new Texture(texture, guid())
			textures.push(newTexture)

			Project!.textures.push(newTexture)
			if (texture.relative_path && Project!.save_path) {
				const resolvedPath = PathModule.resolve(Project!.save_path, texture.relative_path)
				if (fs.existsSync(resolvedPath)) {
					newTexture.fromPath(resolvedPath)
					continue
				}
			}
			if (texture.path && fs.existsSync(texture.path) && !model.meta.backup) {
				newTexture.fromPath(texture.path)
			} else if (texture.source && texture.source.startsWith('data:')) {
				newTexture.fromDataURL(texture.source)
			}
		}
	}

	let group: Group | undefined

	if (model.elements) {
		group = new Group({
			name: 'Imported Model',
			origin: [0, 0, 0],
			rotation: [0, 0, 0],
		}).init()

		const defaultTexture = Texture.getDefault()
		for (const element of model.elements) {
			if (element.type === ProjectInstanceElement.type) {
				console.warn('Cannot have recursive ProjectInstanceElements!')
				continue
			} else if (element.type !== 'cube') {
				console.warn(`Unsupported element type '${element.type as string}'!`)
				continue
			}
			const cube = OutlinerElement.fromSave(element, false) as Cube
			cube.addTo(group)
			cube.moveVector([instance.origin[0], instance.origin[1], instance.origin[2]], 1)
			cube.origin = [instance.origin[0], instance.origin[1], instance.origin[2]]
			cube.rotation = [instance.rotation[0], instance.rotation[1], instance.rotation[2]]
			Canvas.updateAll()

			for (const face in cube.faces) {
				if (element.faces) {
					const texture =
						element.faces[face].texture !== undefined &&
						textures[element.faces[face].texture]
					console.log('Texture:', texture, element.faces[face].texture)
					if (texture) {
						cube.faces[face].texture = texture.uuid
					}
				} else if (defaultTexture && cube.faces && cube.faces[face].texture !== undefined) {
					cube.faces[face].texture = defaultTexture.uuid
				}
			}
		}

		group.addTo(instance.parent instanceof Group ? instance.parent : undefined)
		group.transferOrigin([instance.origin[0], instance.origin[1], instance.origin[2]])

		return () => {
			//
		}
	}

	return () => {
		if (group) {
			group.remove(false)
		}
		for (const texture of textures) {
			texture.remove(true)
		}
	}
}
