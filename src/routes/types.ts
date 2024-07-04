export interface XY<T = number> {
	x: T
	y: T
}

export interface ModifierKeys<T = boolean> {
	altKey: T
	ctrlKey: T
	metaKey: T
	shiftKey: T
}

export type GameState = 'playing' | 'lost' | 'won'

export interface GameSettings {
	size: XY
	mines: number
	firstRevealOpen: boolean
}

export interface SettingsPreset {
	options: Omit<GameSettings, 'firstRevealOpen'>
	display: string
}
