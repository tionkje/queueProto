<script>
  import { Manager, ProduceAction } from 'queueDirector';

  import { onMount } from 'svelte';

  const dir = new Manager();
  dir.createUnpausedProducer();

  let selIdx;
  let selected;
  $: if (!isNaN(selIdx)) selected = dir.producers[selIdx];

  function createNewInSelected() {
    var newp = selected.enqueueProduceAction(10);
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

<section class="controls">
  <button on:click={(e) => (paused = !paused)}>
    {#if paused} Go {:else} Pause {/if}
  </button>
</section>

<section class="field">
  {#each dir.producers as p, i}
    <div
      class="producers item"
      class:selected={selIdx == i}
      class:paused={p.paused}
    >
      <button class="producerId" on:click={(e) => (selIdx = selIdx == i ? null : i)}>
        {p.id}
      </button>
      {#if p.head}
        <div class="count">{p.actionQueue.length || ''}</div>
        {#if !p.paused && p.head.started}
          <progress value={1 - p.head.timeLeft / p.head.totalTime} />
        {/if}
      {/if}
      {#if p.paused && p.produceAction}
        <progress value={1 - p.produceAction.timeLeft / p.produceAction.totalTime} />
      {/if}

    </div>
  {/each}
</section>

{#if selected}
  <section class="selection">
    <div class="self item">
      <div class="producerId">
      {selected.id}
      </div>
      {#if selected.paused && selected.produceAction}
      <progress value={1 - selected.produceAction.timeLeft / selected.produceAction.totalTime} />
      {/if}
    </div>
    <button on:click={createNewInSelected}>create</button>
    <br />
    {#each selected.actionQueue as action}
      <div class="inprogress item">
        <button class="producerId"
          on:click={(e) => (selIdx = dir.producers.indexOf(action._result))}
          on:contextmenu|preventDefault={(e) => cancelAction(action)}
        >
          {action.produceId}
        </button>
        {#if action.started}
          <!-- {action.timeLeft.toFixed(1)} -->
          <progress value={1 - action.timeLeft / action.totalTime} />
        {/if}
      </div>
    {/each}
  </section>
{/if}

<style>
:global(body) {
  /* this will apply to <body> */
  font-family:Arial;
}
  .paused {
    opacity: 0.6;
  }
  section {
    margin: 10px 0px;
    border: 1px solid grey;
  }
  .selection {
    background-color:#fffde7;
  }
  .selected {
    /* color: white; */
    /* background: black; */
    border: 1px solid black;
  }
  button {
    cursor: pointer;
    font-size: inherit;
    font-family:inherit;
  }
  .item {
    width: 50px;
    display: inline-flex;
    position: relative;
    font-size: 2em;
    margin: 2px;
  }
  .item .producerId{
    display:inline-flex;
    padding: 0;
    margin: 0;
    height: 50px;
    width: 100%;
    text-align:center;
    align-items: center;
    justify-content:center;
    background:#d6d6d6;
  }
  .item button {
    border: none;
  }

  .item progress {
    pointer-events: none;
    border: none;
    width: 100%;
    height: 100%;
    background: transparent;
    position: absolute;
    opacity: 0.2;
  }
  .item progress[value]::-webkit-progress-bar {
    background-color: transparent;
  }
  .item progress[value]::-webkit-progress-value {
    background-color: black;
  }

  .item .count {
    position: absolute;
    right: 0;
    bottom: 0;
    background: black;
    color: white;
    padding: 2px 4px;
    font-size: 0.5em;
    font-weight: bold;
    font-family: Arial;
    opacity: 0.8;
    pointer-events: none;
  }
</style>
