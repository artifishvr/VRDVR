<script lang="ts">
	import { Download, Calendar as CalendarIcon, Clock, Play, EllipsisVertical, Link, Search } from '@lucide/svelte';
	import { PUBLIC_S3_HOST } from '$env/static/public';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Calendar } from '$lib/components/ui/calendar';
	import * as Popover from '$lib/components/ui/popover';
	import AudioPlayer from '$lib/components/AudioPlayer.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { DateFormatter, getLocalTimeZone, type DateValue } from '@internationalized/date';

	import { pushState } from '$app/navigation';

	let showAudioPlayer = $state(false);
	let currentItem = $state({});

	let items = $state<any[]>([]);
	let authStatus = $state<'idle' | 'loading' | 'unauthorized' | 'ready' | 'error'>('idle');
	let authMessage = $state('');
	
	let searchQuery = $state('');
	let dateValue = $state<DateValue | undefined>(undefined);

	const df = new DateFormatter('en-US', {
		dateStyle: 'long'
	});

	let filteredItems = $derived(
		items.filter((item: any) => {
			const matchesSearch = item.username.toLowerCase().includes(searchQuery.toLowerCase());
			
			let matchesDate = true;
			if (dateValue) {
				const itemDate = new Date(item.timestamp);
				const selectedDate = dateValue.toDate(getLocalTimeZone());
				
				matchesDate = 
					itemDate.getFullYear() === selectedDate.getFullYear() &&
					itemDate.getMonth() === selectedDate.getMonth() &&
					itemDate.getDate() === selectedDate.getDate();
			}
			
			return matchesSearch && matchesDate;
		})
	);

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

	function syncPlayerFromUrl() {
		const playId = page.url.searchParams.get('play');
		if (!playId) {
			showAudioPlayer = false;
			return;
		}

		const found = items.find((it: any) => it.id === playId);
		if (found) {
			currentItem = found;
			showAudioPlayer = true;
		} else {
			showAudioPlayer = false;
		}
	}

	async function loadRecordings() {
		const storedPassword = localStorage.getItem('vrdvr_password');
		if (!storedPassword) {
			authStatus = 'unauthorized';
			authMessage = 'No password is set in local storage.';
			items = [];
			return;
		}

		authStatus = 'loading';
		authMessage = '';

		try {
			const response = await fetch('/api/recordings', {
				headers: {
					"x-vrdvr-password": storedPassword
				}
			});

			if (response.status === 401) {
				authStatus = 'unauthorized';
				authMessage = 'Stored password was rejected.';
				items = [];
				return;
			}

			if (!response.ok) {
				authStatus = 'error';
				authMessage = 'Unable to load recordings right now.';
				items = [];
				return;
			}

			const payload = await response.json();
			items = payload.recordings ?? [];
			authStatus = 'ready';
			syncPlayerFromUrl();
		} catch (error) {
			authStatus = 'error';
			authMessage = 'Network error while loading recordings.';
			items = [];
		}
	}

	onMount(() => {
		const windowWithSetter = window as Window & {
			meow?: (value: string) => void;
		};
		windowWithSetter.meow = (value: string) => {
			localStorage.setItem("vrdvr_password", value);
			window.location.reload();
		};

		loadRecordings();

		const onPop = () => {
			syncPlayerFromUrl();
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

	{#if authStatus !== 'ready'}
		<div class="rounded border border-zinc-800 bg-zinc-900 p-6">
			<h2 class="text-xl font-semibold mb-2">Listings locked</h2>
			<p class="text-zinc-300 mb-4">
				Set the password in your browser console to unlock the recordings.
			</p>
			<pre class="bg-zinc-950 text-zinc-200 rounded p-3 text-sm overflow-auto">
localStorage.setItem('vrdvr_password', 'YOUR_PASSWORD');
location.reload();
			</pre>
			<p class="text-zinc-400 mt-4">
				{#if authStatus === 'loading'}
					Validating password...
				{:else if authStatus === 'unauthorized'}
					{authMessage}
				{:else if authStatus === 'error'}
					{authMessage}
				{:else}
					Waiting for password.
				{/if}
			</p>
		</div>
	{:else}
		<div class="flex flex-col sm:flex-row gap-4 mb-6">
			<div class="relative flex-1 max-w-sm">
				<Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
				<Input
					type="search"
					placeholder="Search by username..."
					class="pl-8"
					bind:value={searchQuery}
				/>
			</div>
			
			<Popover.Root>
				<Popover.Trigger>
					{#snippet child({ props })}
						<Button
							variant="outline"
							class="w-[240px] justify-start text-left font-normal {dateValue ? '' : 'text-muted-foreground'}"
							{...props}
						>
							<CalendarIcon class="mr-2 h-4 w-4" />
							{dateValue ? df.format(dateValue.toDate(getLocalTimeZone())) : "Pick a date"}
						</Button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="w-auto p-0" align="start">
					<Calendar type="single" bind:value={dateValue} />
				</Popover.Content>
			</Popover.Root>
			
			{#if dateValue || searchQuery}
				<Button variant="ghost" onclick={() => { dateValue = undefined; searchQuery = ''; }}>
					Clear filters
				</Button>
			{/if}
		</div>

		{#if filteredItems.length === 0}
			<p>No items found.</p>
		{:else}
			<ul class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
				{#each filteredItems as item}
					<li class="rounded border border-zinc-800 bg-zinc-900 p-4 hover:shadow transition relative">
						<div class="font-semibold truncate">{item.username}</div>
						<div class="text-sm text-zinc-400 flex items-center mt-1">
							<CalendarIcon size={12} class="mr-1" />
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
	{/if}
</div>

{#if showAudioPlayer}
	<AudioPlayer bind:item={currentItem} bind:show={showAudioPlayer} />
{/if}
