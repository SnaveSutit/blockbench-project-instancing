import { ProjectInstanceElement } from './outliner/projectInstanceElement'

declare global {
	interface ModelProject {
		projectInstanceElements: ProjectInstanceElement[]
	}
}
