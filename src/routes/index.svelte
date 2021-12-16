<script>
  import { Manager } from 'queueDirector';
  import { writable } from 'svelte/store';
  import { onMount } from 'svelte';
  import Item from '$lib/Item.svelte';

  function initDir() {
    const dir = new Manager();
    const op = dir.createUnpausedProducer();
    op.type = 'A';
    return dir;
  }
  const dir = writable(initDir());

  let selection = [];
  let research = {};

  function createClick(e) {
    let amount = 1;
    if (typeof e == 'number') amount = e;
    else if (e.shiftKey) amount = 5;
    for (let i = 0; i < amount; i++) createNewInSelected();
  }
  function getSelectionHead() {
    return selection.slice().sort((a, b) => {
      // TODO: sort by time taken by actions. What to do for not determined action times? (guesstimate??)
      return a.actionQueue.length - b.actionQueue.length;
    })[0];
  }
  function createNewInSelected() {
    const sel = getSelectionHead();
    const newp = sel.enqueueProduceAction(10).producing;
    newp.type = 'A';
    $dir.producers = $dir.producers;
  }

  function researchClick(e) {
    const name = 'thing';
    if (research[name]) return;
    const sel = getSelectionHead();
    research[name] = 'start';
    sel.enqueueWaitAction(10, () => {
      research[name] = 'done';
    });
  }

  function cancelAction(producer, action) {
    producer.cancelAction(action);
    producer.actionQueue = selection[0].actionQueue;
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
      if (!paused) $dir.evaluate(dt);
      prev = now;
      $dir = $dir;
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

<section class="researched">
  {JSON.stringify(research, 0, 2)}
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
        {#each selected.actionQueue as action}
          {#if action.type == 'ProduceAction'}
            <div class="inprogress item">
              <button
                class="producerType"
                on:click={(e) => (selection = [action.producing])}
                on:contextmenu|preventDefault={(e) => cancelAction(selected, action)}
              >
                {action.producing.type}
              </button>
              <div class="producerId">{action.producing.id}</div>
              {#if action.started}
                <progress value={1 - action.timeLeft / action.totalTime} />
              {/if}
            </div>
          {:else if action.type == 'WaitAction'}
            <div class="inprogress item">
              <button
                class="producerType"
                on:click={(e) => (selection = [action.producing])}
                on:contextmenu|preventDefault={(e) => cancelAction(selected, action)}
              >
                R
              </button>
              {#if action.started}
                <progress value={1 - action.timeLeft / action.totalTime} />
              {/if}
            </div>
          {:else}Not implementd{/if}
        {/each}
      {/each}
    {:else}
      {#each countTypes(selection) as [type, count]}
        <div class="self item">
          <div class="producerType">{type}</div>
          <div class="producerId">{count}</div>
        </div>
      {/each}
        <div class="self item">
          <div class="producerType">{selection.reduce((a,p)=>a+p.actionQueue.length,0)}</div>
        </div>
    {/if}
    <br />
    <button on:click={researchClick}>research</button>
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
  <button on:click={(e) => (selection = $dir.producers)}>select all</button>
  <br />
  {#each $dir.producers.filter((x) => !x.paused) as p, i}
    <Item bind:selection bind:producer={p} />
  {/each}
  <br />
  {#each $dir.producers.filter((x) => x.paused) as p, i}
    <Item bind:selection bind:producer={p} />
  {/each}
</section>

<pre>{JSON.stringify($dir,0,2)}</pre>

<style>
  :global(body) {
    font-family: Arial;
  }
  :global(button) {
    cursor: pointer;
    font-size: inherit;
    font-family: inherit;
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
