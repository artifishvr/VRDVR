<script lang="ts">
	import '../app.css';
	import '@fontsource/maple-mono';

	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>VRDVR</title>
</svelte:head>

{@render children?.()}
