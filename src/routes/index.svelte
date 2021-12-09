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
      dir.evaluate(dt);
      prev = now;
      dir = dir;
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });
</script>

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
      {action.timeLeft}
    </button>
  {/each}
{/if}

<style>
  .paused {
    opacity: 0.6;
  }
</style>
