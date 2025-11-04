<script lang="ts">
	import { Download, Calendar, Clock, Play, EllipsisVertical, Link } from '@lucide/svelte';
	import { PUBLIC_S3_HOST } from '$env/static/public';
	import type { PageProps } from './$types';
	import { Button } from '$lib/components/ui/button';
	import AudioPlayer from '$lib/components/AudioPlayer.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';

	import { pushState } from '$app/navigation';

	let { data }: PageProps = $props();

	let showAudioPlayer = $state(false);
	let currentItem = $state({});

	let items = data.recordings;

	function downloadItem(item: any) {
		const url = `${PUBLIC_S3_HOST}/${item.s3Key}`;
		const link = document.createElement('a');
		link.href = url;
		link.download = `${item.username}-${new Date(item.timestamp).toISOString()}.ogg`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
	function copyLink(item: any) {
		const url = `${page.url.origin}/?play=${item.id}`;
		navigator.clipboard.writeText(url);
	}

	onMount(() => {
		const playId = page.url.searchParams.get('play');
		if (!playId) return;

		const found = items.find((it: any) => it.id === playId);
		if (found) {
			currentItem = found;
			showAudioPlayer = true;
		}

		const onPop = () => {
			const playId = new URL(window.location.href).searchParams.get('play');
			if (playId) {
				const found = items.find((it: any) => it.id === playId);
				if (found) {
					currentItem = found;
					showAudioPlayer = true;
				} else {
					showAudioPlayer = false;
				}
			} else {
				showAudioPlayer = false;
			}
		};

		window.addEventListener('popstate', onPop);

		onDestroy(() => {
			window.removeEventListener('popstate', onPop);
		});

		$effect(() => {
			if (!showAudioPlayer) {
				const url = new URL(window.location.href);
				url.searchParams.delete('play');
				pushState(url.toString(), {
					itemId: null
				});
			}
		});
	});
</script>

<div class="m-6">
	<h1 class="text-4xl font-bold mb-2">VRDVR</h1>
	<p class="text-zinc-300">Catalog of automatically recorded DJ sets from VRChat</p>

	<p class="text-zinc-300 mb-6">
		Fully open source on <a
			href="https://github.com/artifishvr/VRDVR"
			target="_blank"
			class="underline text-blue-300">GitHub</a
		>
		<br />
		<a
			href="https://github.com/artifishvr/VRDVR/tree/main/cap#readme"
			target="_blank"
			class="underline text-blue-300">Add to the Catalog</a
		>
	</p>

	{#if items.length === 0}
		<p>No items found.</p>
	{:else}
		<ul class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
			{#each items as item}
				<li class="rounded border border-zinc-800 bg-zinc-900 p-4 hover:shadow transition relative">
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

					<div class="absolute right-4 bottom-4 flex items-center gap-2">
						<Button
							variant="default"
							size="icon"
							class="size-8"
							onclick={() => {
								currentItem = item;
								showAudioPlayer = true;
								const url = new URL(window.location.href);
								url.searchParams.set('play', item.id);
								pushState(url.toString(), {
									itemId: item.id
								});
							}}
						>
							<Play />
						</Button>

						<DropdownMenu.Root>
							<DropdownMenu.Trigger>
								{#snippet child({ props })}
									<Button variant="secondary" size="icon" class="size-8" {...props}>
										<EllipsisVertical />
									</Button>
								{/snippet}
							</DropdownMenu.Trigger>
							<DropdownMenu.Content>
								<DropdownMenu.Group>
									<DropdownMenu.Item onclick={() => downloadItem(item)}
										><Download /> Download</DropdownMenu.Item
									>
									<DropdownMenu.Item onclick={() => copyLink(item)}
										><Link /> Copy Link</DropdownMenu.Item
									>
								</DropdownMenu.Group>
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

{#if showAudioPlayer}
	<AudioPlayer bind:item={currentItem} bind:show={showAudioPlayer} />
{/if}
