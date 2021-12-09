<script>
  import { Manager, ProduceAction } from 'queueDirector';

  import { onMount } from 'svelte';

  const dir = new Manager();
  dir.createProducer();

  let selIdx;
  let selected;
  $: if (!isNaN(selIdx)) selected = dir.producers[selIdx];

  function createNewInSelected() {
    selected.enque((newP) => new ProduceAction(10, newP));
    dir.producers = dir.producers;
  }
  function cancelAction(action) {
    selected.cancelAction(action);
    selected.actionQueue = selected.actionQueue;
  }

  onMount(() => {
    let prev = performance.now();
    function loop() {
      let now = performance.now();
      const dt = (now - prev) / 1000;
      if (!paused) dir.evaluate(dt);
      prev = now;
      dir = dir;
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });
  let paused = false;
</script>

{#if paused}
  <button on:click={(e) => (paused = false)}>Go</button>
{:else}
  <button on:click={(e) => (paused = true)}>Pauze</button>
{/if}

<br />

{#each dir.producers as p, i}
  <button class:paused={p.paused} on:click={(e) => (selIdx = i)}>
    {p.id}
    {p.actionQueue.length || ''}
  </button>
{/each}

<br />
<br />

{#if selected}
  {selected.id}
  <button on:click={createNewInSelected}>create</button>
  <br />
  {#each selected.actionQueue as action}
    <button on:click={(e) => cancelAction(action)}>
      {action.id}
      {action.timeLeft.toFixed(1)}
      <progress value={1 - action.timeLeft / action.totalTime} /></button
    >
  {/each}
{/if}

<style>
  .paused {
    opacity: 0.6;
  }
</style>
