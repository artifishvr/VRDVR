<script>
	import { Download } from '@lucide/svelte';

	const { data } = $props();
	const items = $derived(
		(data?.items ?? [])
			.slice()
			.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
	);
</script>

<div class="m-6">
	<h1 class="text-4xl font-bold mb-2">VRDVR</h1>

	{#if items.length === 0}
		<p>No items found.</p>
	{:else}
		<ul class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
			{#each items as item}
				<li class="rounded border border-zinc-800 bg-zinc-900 p-4 hover:shadow transition relative">
					<a
						href={item.url}
						download
						target="_blank"
						class="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200"
						aria-label="Download audio"
					>
						<Download size={18} />
					</a>

					<div class="font-semibold truncate">{item.username}</div>
					<div class="text-sm text-gray-500">
						{new Date(item.date).toLocaleDateString()} @ {new Date(item.date).toLocaleTimeString()}
					</div>
					<audio controls class="w-full mt-2">
						<source src={item.url} type="audio/ogg" />
						use a modern browser pls
					</audio>
				</li>
			{/each}
		</ul>
	{/if}
</div>
