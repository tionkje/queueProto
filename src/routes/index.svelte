<script>
  import { Manager, ProduceAction } from 'queueDirector';

  import { onMount } from 'svelte';

  const dir = new Manager();
  const op = dir.createUnpausedProducer();
  op.type = 'A';

  let selection = [];

  function createClick(e) {
    let amount = 1;
    if (typeof e == 'number') amount = e;
    else if (e.shiftKey) amount = 5;
    for (let i = 0; i < amount; i++) createNewInSelected();
  }
  function createNewInSelected() {
    const sel = selection.slice().sort((a, b) => {
      // TODO: sort by time taken by actions. What to do for not determined action times? (guesstimate??)
      return a.actionQueue.length - b.actionQueue.length;
    });
    const newp = sel[0].enqueueProduceAction(10);
    newp.type = 'A';
    dir.producers = dir.producers;
  }
  function cancelAction(action) {
    selection[0].cancelAction(action);
    selection[0].actionQueue = selection[0].actionQueue;
  }

  function countTypes(producers) {
    const cobj = producers.reduce((c, p) => {
      if (!c[p.type]) c[p.type] = 0;
      c[p.type]++;
      return c;
    }, {});
    return Object.entries(cobj);
  }

  onMount(() => {
    let prev = performance.now();
    function loop() {
      let now = performance.now();
      const dt = (now - prev) / 1000;
      if (!paused) dir.evaluate(dt);
      prev = now;
      dir = dir;
      selection = selection;
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

<section class="selection">
  {#if selection.length}
    {#if selection.length == 1}
      {#each selection as selected}
        <div class="self item">
          <div class="producerType">
            {selected.id}
          </div>
          {#if selected.paused && selected.produceAction}
            <progress value={1 - selected.produceAction.timeLeft / selected.produceAction.totalTime} />
          {/if}
        </div>
      {/each}
    {:else}
      {#each countTypes(selection) as [type, count]}
        <div class="self item">
          <div class="producerType">{type}</div>
          <div class="producerId">{count}</div>
        </div>
      {/each}
    {/if}
    {#each selection[0].actionQueue as action}
      {#if action.type == 'ProduceAction'}
        <div class="inprogress item">
          <button
            class="producerType"
            on:click={(e) => (selection = [action.producing])}
            on:contextmenu|preventDefault={(e) => cancelAction(action)}
          >
            {action.producing.type}
          </button>
          <div class="producerId">{action.producing.id}</div>
          {#if action.started}
            <progress value={1 - action.timeLeft / action.totalTime} />
          {/if}
        </div>
      {:else}Not implementd{/if}
    {/each}
    <br />
    <button on:click={createClick}>create</button>
    <button on:click={(e) => createClick(5)}>create 5</button>
    <button on:click={(e) => createClick(10)}>create 10</button>
    <button on:click={(e) => createClick(20)}>create 20</button>
    <button on:click={(e) => createClick(50)}>create 50</button>
    <button on:click={(e) => createClick(100)}>create 100</button>
  {/if}
</section>

<section class="field">
  <button on:click={(e) => (selection = dir.producers)}>select all</button>
  <br />
  {#each dir.producers as p, i}
    <div class="producers item" class:selected={selection.includes(p)} class:paused={p.paused}>
      <button
        class="producerType"
        on:click={(e) =>
          (selection = selection.includes(p) && selection.length == 1 ? selection.filter((x) => x != p) : [p])}
        on:contextmenu|preventDefault={(e) =>
          selection.includes(p) ? selection.splice(selection.indexOf(p), 1) : selection.push(p)}
      >
        {p.type}
      </button>
      <div class="producerId">{p.id}</div>
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

<style>
  :global(body) {
    font-family: Arial;
  }
  .paused {
    opacity: 0.6;
  }
  section {
    margin: 10px 0px;
    border: 1px solid grey;
  }
  .selection {
    background-color: #fffde7;
    height: 200px;
  }
  .selected {
    border: 1px solid black;
  }
  button {
    cursor: pointer;
    font-size: inherit;
    font-family: inherit;
  }
  .item {
    width: 50px;
    display: inline-flex;
    position: relative;
    font-size: 2em;
    margin: 2px;
  }
  .item .producerType {
    display: inline-flex;
    padding: 0;
    margin: 0;
    height: 50px;
    width: 100%;
    text-align: center;
    align-items: center;
    justify-content: center;
    background: #d6d6d6;
  }
  .item button {
    border: none;
  }
  .item .producerId {
    position: absolute;
    left: 0;
    bottom: 0;
    font-size: 0.5em;
    pointer-events: none;
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
