<script lang="ts">
	export let header: boolean = false
</script>

<h1 class="title" class:header>
	<a class="title-header" href="https://alic3.dev">
		<div class="title-main">
			<span class="title-main-start">A</span>
			<div class="title-main-part">l</div>
			<div class="title-main-middle title-main-part">i</div>
			<div class="title-main-c title-main-part">c</div>
			<div class="title-main-end title-main-part">3</div>
		</div>
		<div class="title-secondary" aria-hidden="true">
			L<span class="title-emphasis">I</span>C3
		</div>
	</a>
</h1>

<style>
	.title {
		user-select: none;

		font-size: 20px;
		font-weight: 700;

		margin: 0;
		padding: 0;

		font-family: 'Exo 2', Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;

		font-size: 10px;
		line-height: normal;
		letter-spacing: 0.5px;
		text-rendering: optimizeLegibility;
	}

	.title,
	.title * {
		box-sizing: border-box;
	}

	.title.header {
		position: fixed;
		top: 5px;
		left: 30px;
	}

	.title-header {
		display: flex;
		align-items: baseline;

		opacity: 0.5;

		transition: opacity 250ms ease-in-out;
	}

	.title-header:active,
	.title-header:visited,
	.title-header:link,
	.title-header:focus,
	.title-header:hover {
		text-decoration: none;
		color: #eaefff;
	}

	.title-header:hover,
	.title-header:focus,
	.title-header:active {
		opacity: 1;
	}

	.title-main {
		position: relative;
		font-size: 3em;
		font-weight: 300;
	}

	.title-secondary {
		font-size: 3em;
		font-weight: 100;
		z-index: 1;

		opacity: 0;

		transition: opacity 250ms ease-in-out;
	}

	.title-emphasis {
		font-weight: 300;
	}

	.title-main-part {
		position: absolute;
		left: 0px;
		bottom: 7.5px;
	}

	.title-main-start {
		font-size: 1.5em;
		font-weight: 100;

		font-family: 'Inconsolata', monospace;
	}

	.title-main-middle {
		font-size: 0.875em;
		font-weight: 100;
	}

	.title-main-c {
		bottom: 4px;
	}

	.title-main-end {
		font-size: 0.6875em;
		font-weight: 100;
		left: 3px;
		bottom: 8px;
	}
</style>
