<script lang="ts">
	import { inject } from '@vercel/analytics'

	import '../styles.css'

	inject()
</script>

<main>
	<slot />
</main>
