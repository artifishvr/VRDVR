<script lang="ts">
	let { item = $bindable(), show = $bindable() }: { item: any; show: boolean } = $props();
	import { PUBLIC_S3_HOST } from '$env/static/public';
	import { Calendar, Clock, Download, X } from '@lucide/svelte';
</script>

<div class="fixed bottom-6 right-6 z-50">
	<div class=" rounded border border-zinc-700 bg-zinc-800/60 backdrop-blur-2xl p-4 shadow-lg">
		<div class="flex items-baseline justify-between gap-2">
			<div>
				<div class="font-semibold truncate">{item.username}</div>
				<div class="text-sm text-zinc-400 flex items-center mt-1">
					<Calendar size={12} class="mr-1" />
					{new Date(item.timestamp).toLocaleDateString()} @ {new Date(
						item.timestamp
					).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
				</div>
				<div class="text-sm text-zinc-400 flex items-center mt-1">
					<Clock size={12} class="mr-1" />
					{(() => {
						const s = Number(item.runtimeSeconds);
						const h = Math.floor(s / 3600);
						const m = Math.floor((s % 3600) / 60);
						const sec = s % 60;
						const parts = [];
						if (h) parts.push(`${h}h`);
						if (m || h) parts.push(`${m}m`);
						parts.push(`${sec}s`);
						return parts.join('');
					})()}
				</div>
			</div>
		</div>
		{#key item}
			<audio
				controls
				class="w-full md:min-w-md mt-2"
				onloadedmetadata={(e: Event) => ((e.currentTarget as HTMLAudioElement).volume = 0.3)}
			>
				<source src={`${PUBLIC_S3_HOST}/${item.s3Key}`} type="audio/ogg" />
				use a modern browser pls
			</audio>
		{/key}

		<div class="absolute top-3 right-3">
			<div class="flex gap-2">
				<button
					class="text-zinc-400 hover:text-zinc-200"
					onclick={() => {
						const link = document.createElement('a');
						link.href = `${PUBLIC_S3_HOST}/${item.s3Key}`;
						link.download = '';
						document.body.appendChild(link);
						link.click();
						document.body.removeChild(link);
					}}
					aria-label="Download"
				>
					<Download size={18} />
				</button>
				<button
					class="text-zinc-400 hover:text-zinc-200"
					onclick={() => (show = false)}
					aria-label="Close"
				>
					<X size={18} />
				</button>
			</div>
		</div>
	</div>
</div>
