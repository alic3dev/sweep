<script lang="ts">
	import type {
		GameSettings,
		GameState,
		ModifierKeys,
		SettingsPreset,
		XY,
	} from './types'

	import { onMount } from 'svelte'

	import Alic3 from '$lib/Alic3.svelte'

	let hasMounted: boolean = false

	let canvas: HTMLCanvasElement
	let ctx: CanvasRenderingContext2D | null

	let monoFontFamily: string = "'Inconsolata', Mono, monospace"

	let headerYOffset: number = 0
	let adjustedCanvasHeight: number = 0
	let cellSize: number = 0
	let cellOffset: XY = {
		x: 0,
		y: 0,
	}

	let headerButtonSize: number = 0
	let headerGameButtonPosition: XY = {
		x: 0,
		y: 0,
	}
	let headerGameSettingsPosition: XY = {
		x: 0,
		y: 0,
	}

	const mousePosition: XY = {
		x: 0,
		y: 0,
	}

	const adjustedMousePosition: XY = {
		x: 0,
		y: 0,
	}

	let mousedDownAt: (XY & ModifierKeys & { button: number }) | null = null
	let previouslyRevealedAt: XY | null = null

	let grid: number[][] = []
	let gridRevealed: boolean[][] = []
	let gridFlagged: number[][] = []

	let firstReveal: boolean = true

	let gameState: GameState = 'playing'
	let hitMine: XY | null = null

	const settingsPresets: SettingsPreset[] = [
		{
			options: {
				size: {
					x: 10,
					y: 8,
				},
				mines: 10,
			},
			display: 'Beginner',
		},
		{
			options: {
				size: {
					x: 21,
					y: 12,
				},
				mines: 40,
			},
			display: 'Intermediate',
		},
		{
			options: {
				size: { x: 30, y: 16 },
				mines: 99,
			},
			display: 'Expert',
		},
	]

	const gameSettings: GameSettings = {
		...settingsPresets[2].options,
		firstRevealOpen: true,
	}
	let settingsOpen: boolean = false
	const gameSettingsLocalStorageKey: string = 'sweep:settings'

	let pointer: boolean = false

	function usePreset(preset: SettingsPreset): void {
		gameSettings.size = { ...preset.options.size }
		gameSettings.mines = preset.options.mines
	}

	function saveSettings(): void {
		if (gameSettings.size.x < 1) {
			gameSettings.size.x = 1
		}

		if (gameSettings.size.y < 1) {
			gameSettings.size.y = 1
		}

		if (gameSettings.mines < 1) {
			gameSettings.mines = 1
		}

		if (gameSettings.mines >= gameSettings.size.x * gameSettings.size.y) {
			gameSettings.mines = gameSettings.size.x * gameSettings.size.y - 1
		}

		if (!hasMounted || typeof window === 'undefined' || !window.localStorage) {
			return
		}

		window.localStorage.setItem(
			gameSettingsLocalStorageKey,
			JSON.stringify(gameSettings),
		)
	}

	function loadSettings(): void {
		if (!hasMounted || typeof window === 'undefined' || !window.localStorage) {
			return
		}

		const storedSettings: string | null = window.localStorage.getItem(
			gameSettingsLocalStorageKey,
		)

		if (!storedSettings) {
			return
		}

		try {
			const parsedStoredSettings: GameSettings = JSON.parse(storedSettings)

			if (
				typeof parsedStoredSettings !== 'object' ||
				Array.isArray(parsedStoredSettings)
			) {
				return
			}

			if (parsedStoredSettings.size) {
				gameSettings.size = {
					x: parsedStoredSettings.size.x || gameSettings.size.x,
					y: parsedStoredSettings.size.y || gameSettings.size.y,
				}
			}

			gameSettings.mines = parsedStoredSettings.mines || gameSettings.mines

			gameSettings.firstRevealOpen =
				parsedStoredSettings.firstRevealOpen ?? gameSettings.firstRevealOpen
		} catch {}
	}

	function calculateSizes(): void {
		if (!ctx) return

		headerYOffset = ctx.canvas.height / 20

		adjustedCanvasHeight = ctx.canvas.height - headerYOffset

		cellSize = Math.min(
			ctx.canvas.width / grid.length,
			adjustedCanvasHeight / grid[0].length,
		)

		cellOffset = {
			x: ctx.canvas.width / 2 - (grid.length * cellSize) / 2,
			y:
				headerYOffset +
				adjustedCanvasHeight / 2 -
				(grid[0].length * cellSize) / 2,
		}

		headerButtonSize = headerYOffset / 1.5
		headerGameButtonPosition = {
			x: ctx.canvas.width / 2 - headerButtonSize / 2,
			y: headerYOffset / 2 - headerButtonSize / 2,
		}

		headerGameSettingsPosition = {
			x: ctx.canvas.width - headerButtonSize * 2,
			y: headerGameButtonPosition.y,
		}
	}

	function forNeighbors(
		x: number,
		y: number,
		callback: (xn: number, yn: number) => void,
	): void {
		const validOffsets: XY<number[]> = {
			x: [x],
			y: [y],
		}

		if (x - 1 >= 0) {
			validOffsets.x.push(x - 1)
		}

		if (x + 1 < grid.length) {
			validOffsets.x.push(x + 1)
		}

		if (y - 1 >= 0) {
			validOffsets.y.push(y - 1)
		}

		if (y + 1 < grid[x].length) {
			validOffsets.y.push(y + 1)
		}

		for (const xo of validOffsets.x) {
			for (const yo of validOffsets.y) {
				if (xo === x && yo === y) {
					continue
				}

				callback(xo, yo)
			}
		}
	}

	function revealConnectingZeros(x: number, y: number): void {
		const hasRevealed: XY[] = []

		const _revealConnectingZeros = (_x: number, _y: number): void => {
			hasRevealed.push({ x: _x, y: _y })

			forNeighbors(_x, _y, (xn: number, yn: number): void => {
				gridRevealed[xn][yn] = true

				if (
					!hasRevealed.find(
						(revealed: XY): boolean => revealed.x === xn && revealed.y === yn,
					) &&
					grid[xn][yn] === 0
				) {
					_revealConnectingZeros(xn, yn)
				}
			})
		}

		return _revealConnectingZeros(x, y)
	}

	function newGame(): void {
		grid = []
		gridRevealed = []
		gridFlagged = []

		firstReveal = true

		gameState = 'playing'

		closeSettings()

		for (let x: number = 0; x < gameSettings.size.x; x++) {
			for (let y: number = 0; y < gameSettings.size.y; y++) {
				if (y === 0) {
					grid.push([])
					gridRevealed.push([])
					gridFlagged.push([])
				}

				grid[x].push(0)
				gridRevealed[x].push(false)
				gridFlagged[x].push(0)
			}
		}

		for (let i: number = 0; i < gameSettings.mines; i++) {
			const randomX: number = Math.floor(Math.random() * grid.length)
			const randomY: number = Math.floor(Math.random() * grid[randomX].length)

			if (grid[randomX][randomY] !== 0) {
				i--
				continue
			} else {
				grid[randomX][randomY] = -1
			}
		}

		for (let x: number = 0; x < grid.length; x++) {
			for (let y: number = 0; y < grid[x].length; y++) {
				if (grid[x][y] === -1) {
					continue
				}

				let surroundingMines: number = 0

				forNeighbors(x, y, (xn: number, yn: number): void => {
					if (grid[xn][yn] === -1) {
						surroundingMines++
					}
				})

				grid[x][y] = surroundingMines
			}
		}

		calculateSizes()
	}

	function closeSettings(): void {
		settingsOpen = false
	}

	function drawHeaderButton({
		ctx,
		position,
		size = headerButtonSize,
		text = '',
		mousedOver = false,
	}: {
		ctx: CanvasRenderingContext2D
		position: XY
		size?: number
		text?: string
		mousedOver?: boolean
	}): void {
		ctx.fillStyle = mousedOver ? '#161616' : '#111111'
		ctx.beginPath()
		ctx.moveTo(position.x, position.y + size)
		ctx.lineTo(position.x, position.y)
		ctx.lineTo(position.x + size, position.y)
		ctx.closePath()
		ctx.fill()

		ctx.fillStyle = mousedOver ? '#363636' : '#333333'
		ctx.beginPath()
		ctx.moveTo(position.x + size, position.y)
		ctx.lineTo(position.x + size, position.y + size)
		ctx.lineTo(position.x, position.y + size)
		ctx.closePath()
		ctx.fill()

		ctx.fillStyle = mousedOver ? '#4a4a4a' : '#444444'
		ctx.fillRect(position.x + 4, position.y + 4, size - 8, size - 8)

		const fontSize: number = size - size / 3

		drawCenterFillText({
			ctx,
			position: {
				x: position.x + size / 2,
				y: position.y + size / 1.8,
			},
			text,
			fontSize,
		})
	}

	function drawMine({
		ctx,
		position,
		size = cellSize,
		fontSize,
	}: {
		ctx: CanvasRenderingContext2D
		position: XY
		size?: number
		fontSize: number
	}) {
		drawCenterFillText({
			ctx,
			position: { x: position.x + size / 2, y: position.y + size / 1.75 },
			text: '💥',
			fontSize,
		})
	}

	function drawCenterFillText({
		ctx,
		position,
		text,
		color = '#000000',
		fontSize,
		fontFamily = monoFontFamily,
	}: {
		ctx: CanvasRenderingContext2D
		position: XY
		text: string
		color?: string | CanvasGradient | CanvasPattern
		fontSize: string | number
		fontFamily?: string
	}) {
		ctx.fillStyle = color
		ctx.font = `${fontSize}px ${fontFamily}`

		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'

		ctx.fillText(text, position.x, position.y)
	}

	function onWindowResize(): void {
		canvas.height = window.innerHeight * 2
		canvas.width = window.innerWidth * 2

		calculateSizes()
	}

	function onMouseMove(event: MouseEvent): void {
		mousePosition.x = event.clientX
		mousePosition.y = event.clientY

		if (ctx) {
			adjustedMousePosition.x =
				(mousePosition.x * ctx.canvas.width) / window.innerWidth
			adjustedMousePosition.y =
				(mousePosition.y * ctx.canvas.height) / window.innerHeight
		}
	}

	function onMouseDown(event: MouseEvent): void {
		mousedDownAt = {
			button: event.button,
			altKey: event.altKey,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
			shiftKey: event.shiftKey,
			x: event.clientX,
			y: event.clientY,
		}
	}

	function onKeyDown(event: KeyboardEvent): void {
		switch (event.key) {
			case 'Escape':
				closeSettings()
				break
		}
	}

	function onSettingsWrapperClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			closeSettings()
		}
	}

	function checkWin(): void {
		for (let x: number = 0; x < grid.length; x++) {
			for (let y: number = 0; y < grid[x].length; y++) {
				if (grid[x][y] === -1) {
					if (!gridFlagged[x][y]) return
				} else {
					if (!gridRevealed[x][y]) return
				}
			}
		}

		gameState = 'won'
	}

	$: gameSettings && saveSettings()

	onMount((): (() => void) => {
		hasMounted = true

		loadSettings()
		newGame()

		if (!ctx) {
			ctx = canvas.getContext('2d')
		}

		onWindowResize()

		let frame: number

		const loop: FrameRequestCallback = (): void => {
			if (!ctx) {
				frame = requestAnimationFrame(loop)
				return
			}

			ctx.fillStyle = '#181818'
			ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

			const headerGradient: CanvasGradient = ctx.createLinearGradient(
				0,
				0,
				0,
				headerYOffset,
			)
			headerGradient.addColorStop(0, '#3f3f3f')
			headerGradient.addColorStop(0.96, '#3f3f3f')
			headerGradient.addColorStop(1, '#111111')

			ctx.fillStyle = headerGradient
			ctx.fillRect(0, 0, ctx.canvas.width, headerYOffset)

			const mousedOverHeaderGameButton: boolean =
				!settingsOpen &&
				adjustedMousePosition.x >= headerGameButtonPosition.x &&
				adjustedMousePosition.x <=
					headerGameButtonPosition.x + headerButtonSize &&
				adjustedMousePosition.y >= headerGameButtonPosition.y &&
				adjustedMousePosition.y <= headerGameButtonPosition.y + headerButtonSize

			const mousedOverHeaderSettingsButton: boolean =
				!settingsOpen &&
				adjustedMousePosition.x >= headerGameSettingsPosition.x &&
				adjustedMousePosition.x <=
					headerGameSettingsPosition.x + headerButtonSize &&
				adjustedMousePosition.y >= headerGameSettingsPosition.y &&
				adjustedMousePosition.y <=
					headerGameSettingsPosition.y + headerButtonSize

			let mousedOver: boolean =
				mousedOverHeaderGameButton || mousedOverHeaderSettingsButton

			let hasMousedOver: XY | 'game-button' | 'settings-button' | null =
				mousedOverHeaderGameButton
					? 'game-button'
					: mousedOverHeaderSettingsButton
						? 'settings-button'
						: null

			if (mousedOver) {
				pointer = true
			}

			drawHeaderButton({
				ctx,
				position: headerGameButtonPosition,
				text:
					gameState === 'playing' ? '🙂' : gameState === 'lost' ? '🤯' : '👑',
				mousedOver: mousedOverHeaderGameButton,
			})
			drawHeaderButton({
				ctx,
				position: headerGameSettingsPosition,
				text: '⚙️',
				mousedOver: mousedOverHeaderSettingsButton,
			})

			const fontSize = cellSize - cellSize / 4

			for (let x: number = 0; x < grid.length; x++) {
				for (let y: number = 0; y < grid[x].length; y++) {
					const cellPosition: XY = {
						x: cellOffset.x + x * cellSize,
						y: cellOffset.y + y * cellSize,
					}

					mousedOver = false

					if (!settingsOpen && gameState === 'playing') {
						if (
							adjustedMousePosition.x >= cellPosition.x &&
							adjustedMousePosition.x <= cellPosition.x + cellSize &&
							adjustedMousePosition.y >= cellPosition.y &&
							adjustedMousePosition.y <= cellPosition.y + cellSize
						) {
							mousedOver = !gridRevealed[x][y]
							hasMousedOver = { x, y }
							pointer = !gridRevealed[x][y] || !!grid[x][y]
						}
					}

					ctx.fillStyle = mousedOver ? '#161616' : '#111111'
					ctx.beginPath()
					ctx.moveTo(cellPosition.x, cellPosition.y + cellSize)
					ctx.lineTo(cellPosition.x, cellPosition.y)
					ctx.lineTo(cellPosition.x + cellSize, cellPosition.y)
					ctx.closePath()
					ctx.fill()

					ctx.fillStyle = mousedOver ? '#363636' : '#333333'
					ctx.beginPath()
					ctx.moveTo(cellPosition.x + cellSize, cellPosition.y)
					ctx.lineTo(cellPosition.x + cellSize, cellPosition.y + cellSize)
					ctx.lineTo(cellPosition.x, cellPosition.y + cellSize)
					ctx.closePath()
					ctx.fill()

					if (gridRevealed[x][y]) {
						ctx.fillStyle = grid[x][y] === -1 ? '#662222' : '#222222'
					} else if (mousedOver) {
						ctx.fillStyle = '#4a4a4a'
					} else if (gameState === 'lost' && grid[x][y] === -1) {
						ctx.fillStyle = '#333333'
					} else {
						ctx.fillStyle = '#444444'
					}

					ctx.fillRect(
						cellPosition.x + 4,
						cellPosition.y + 4,
						cellSize - 8,
						cellSize - 8,
					)

					if (gridRevealed[x][y]) {
						if (grid[x][y] === -1) {
							drawMine({ ctx, position: cellPosition, fontSize })
						} else if (grid[x][y] !== 0) {
							let color: string = '#FF0000'

							switch (grid[x][y]) {
								case 1:
									color = '#0066FF'
									break
								case 2:
									color = '#00FFFF'
									break
								case 3:
									color = '#00FF00'
									break
								case 4:
									color = '#FFFF00'
									break
								case 5:
									color = '#FFAACC'
									break
								case 6:
									color = '#FF66AA'
									break
								case 7:
									color = '#FF00FF'
									break
							}

							drawCenterFillText({
								ctx,
								position: {
									x: cellPosition.x + cellSize / 2,
									y: cellPosition.y + cellSize / 2,
								},
								text: grid[x][y].toString(),
								fontSize,
								color,
							})
						}
					} else if (gameState === 'lost' && grid[x][y] === -1) {
						drawMine({ ctx, position: cellPosition, fontSize })
					} else if (gridFlagged[x][y] === 1) {
						drawCenterFillText({
							ctx,
							position: {
								x: cellPosition.x + cellSize / 2,
								y: cellPosition.y + cellSize / 1.9,
							},
							text: '🚩',
							fontSize,
						})
					} else if (gridFlagged[x][y] === 2) {
						drawCenterFillText({
							ctx,
							position: {
								x: cellPosition.x + cellSize / 2,
								y: cellPosition.y + cellSize / 2,
							},
							text: '?',
							fontSize,
						})
					}
				}
			}

			if (mousedDownAt && !settingsOpen) {
				if (hasMousedOver === 'game-button') {
					newGame()
				} else if (hasMousedOver === 'settings-button') {
					settingsOpen = true
				} else if (hasMousedOver && gameState === 'playing') {
					if (mousedDownAt.shiftKey || mousedDownAt.button === 2) {
						gridFlagged[hasMousedOver.x][hasMousedOver.y] =
							(gridFlagged[hasMousedOver.x][hasMousedOver.y] + 1) % 3

						checkWin()
					} else {
						if (gridRevealed[hasMousedOver.x][hasMousedOver.y]) {
							if (
								previouslyRevealedAt &&
								previouslyRevealedAt.x === hasMousedOver.x &&
								previouslyRevealedAt.y === hasMousedOver.y
							) {
								let flaggedMines: number = 0

								forNeighbors(
									hasMousedOver.x,
									hasMousedOver.y,
									(xn: number, yn: number): void => {
										if (gridFlagged[xn][yn] === 1) {
											flaggedMines++
										}
									},
								)

								if (flaggedMines >= grid[hasMousedOver.x][hasMousedOver.y]) {
									forNeighbors(
										hasMousedOver.x,
										hasMousedOver.y,
										(xn: number, yn: number): void => {
											if (gridFlagged[xn][yn] !== 1) {
												gridRevealed[xn][yn] = true

												switch (grid[xn][yn]) {
													case 0:
														revealConnectingZeros(xn, yn)
														break
													case -1:
														hitMine = {
															x: xn,
															y: yn,
														}
														gameState = 'lost'
														break
												}
											}
										},
									)

									checkWin()
								}
							} else {
								previouslyRevealedAt = {
									x: hasMousedOver.x,
									y: hasMousedOver.y,
								}
							}
						} else {
							if (firstReveal) {
								if (gameSettings.firstRevealOpen) {
									while (grid[hasMousedOver.x][hasMousedOver.y] !== 0) {
										newGame()
									}
								}

								firstReveal = false
							}

							gridRevealed[hasMousedOver.x][hasMousedOver.y] = true

							switch (grid[hasMousedOver.x][hasMousedOver.y]) {
								case 0:
									revealConnectingZeros(hasMousedOver.x, hasMousedOver.y)
									break
								case -1:
									hitMine = {
										x: hasMousedOver.x,
										y: hasMousedOver.y,
									}
									gameState = 'lost'
									break
							}

							checkWin()
						}
					}
				} else {
					previouslyRevealedAt = null
				}

				mousedDownAt = null
			}

			if (!hasMousedOver) {
				pointer = false
			}

			frame = requestAnimationFrame(loop)
		}
		frame = requestAnimationFrame(loop)

		return (): void => {
			cancelAnimationFrame(frame)
		}
	})
</script>

<svelte:body on:contextmenu|preventDefault|stopPropagation />

<svelte:window on:resize={onWindowResize} on:keydown={onKeyDown} />

<div class="container">
	<canvas
		bind:this={canvas}
		width="1920"
		height="1080"
		class:pointer
		on:mousemove={onMouseMove}
		on:mousedown|preventDefault|stopPropagation={onMouseDown}
	/>

	<div class="logo" style={`font-size: ${headerButtonSize / 2}px`}>
		<Alic3 />
	</div>

	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="settings-wrapper"
		class:active={settingsOpen}
		on:click|preventDefault|stopPropagation={onSettingsWrapperClick}
	></div>

	<div class="settings" class:active={settingsOpen}>
		<h1>Settings</h1>

		<h2>Presets</h2>

		{#each settingsPresets as preset}
			<button on:click={() => usePreset(preset)}>{preset.display}</button>
		{/each}

		<h2>Options</h2>

		<label>
			Width

			<input type="number" min="1" max="255" bind:value={gameSettings.size.x} />
		</label>

		<label>
			Height

			<input type="number" min="1" max="255" bind:value={gameSettings.size.y} />
		</label>

		<label>
			Mines

			<input
				type="number"
				min="1"
				max={gameSettings.size.x * gameSettings.size.y - 1}
				bind:value={gameSettings.mines}
			/>
		</label>

		<label>
			Always open space on first reveal

			<input type="checkbox" bind:checked={gameSettings.firstRevealOpen} />
		</label>

		<button on:click={newGame}>New Game</button>
	</div>
</div>

<style>
	.container {
		position: relative;
	}

	canvas {
		width: 100%;
		height: 100%;
	}

	canvas.pointer {
		cursor: pointer;
	}

	.logo {
		position: absolute;
		top: 0;
		left: 0.5em;
	}

	.settings-wrapper {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;

		background: rgba(0, 0, 0, 0.3);

		opacity: 0;

		transition: opacity ease-in-out 250ms;

		pointer-events: none;
	}

	.settings {
		position: absolute;
		top: 50%;
		left: 50%;

		display: flex;
		flex-direction: column;

		width: 400px;
		max-width: 95%;

		padding: 1rem;

		background: rgba(0, 0, 0, 0.4);

		border-radius: 5px;

		box-shadow: 0px 4px 8px 2px rgba(0, 0, 0, 0.6);

		color: #efefef;
		font-size: 0.75rem;

		backdrop-filter: blur(20px);

		transform: translate(-50%, -50%);

		opacity: 0;

		transition: opacity ease-in-out 250ms;

		pointer-events: none;
	}

	.settings-wrapper.active,
	.settings.active {
		opacity: 1;

		pointer-events: all;
	}

	.settings h1 {
		font-size: 1rem;
	}

	.settings h2 {
		font-size: 0.85rem;

		margin: 0;
		margin-top: 2rem;
		margin-bottom: 0.5rem;
	}

	.settings label {
		display: flex;
		align-items: center;
		justify-content: space-between;

		margin-bottom: 0.5rem;
	}

	.settings label * {
		width: 4rem;
		margin-left: 1rem;
	}

	.settings label input[type='checkbox'] {
		width: unset;
		margin-left: 2.5rem;
		margin-right: 1.6rem;
	}

	.settings button {
		margin-top: 0.5rem;
	}
</style>
