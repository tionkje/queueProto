<script>
  import { Manager } from 'queueDirector';
  import { writable } from 'svelte/store';
  import { onMount } from 'svelte';
  import Item from '$lib/Item.svelte';
  import Progress from '$lib/Progress.svelte';

  function initDir() {
    const dir = new Manager();
    const op = dir.createUnpausedProducer();
    op.producerType = 'A';
    return dir;
  }
  const dir = writable(initDir());

  let selection = [];
  let research = {};
  let resources = { itium: 1 };

  function createClick(e) {
    let amount = 1;
    if (typeof e == 'number') amount = e;
    else if (e.shiftKey) amount = 5;
    for (let i = 0; i < amount; i++) createNewInSelected();
  }
  function getSelectionHead() {
    return selection.slice().sort((a, b) => {
      if (!!a.paused != !!b.paused) return !!a.paused - !!b.paused;
      // TODO: sort by time taken by actions. What to do for not determined action times? (guesstimate??)
      return a.actionQueue.length - b.actionQueue.length;
    })[0];
  }
  function resourcePred(resourceType, amount) {
    return () => {
      if (resources[resourceType] >= amount) {
        resources[resourceType] -= amount;
        return true;
      }
      return false;
    };
  }
  function createNewInSelected() {
    const sel = getSelectionHead();
    const a = sel.enqueuePredProduceAction(resourcePred('itium', 1), 10);
    a.actionKind = 'A';
    const newp = a.producing;
    newp.producerType = 'A';
    $dir.producers = $dir.producers;
  }
  function gather() {
    const sel = getSelectionHead();
    const a = sel.enqueueWaitAction(1, () => (resources.itium += 1));
    a.actionKind = 'g';
  }
  function infinigather() {
    const sel = getSelectionHead();
    function Q() {
      const a = sel.enqueueWaitAction(1, () => {
        resources.itium += 1;
        Q();
      });
      a.actionKind = 'G';
    }
    Q();
  }

  function researchClick(name) {
    if (research[name]) return;
    const sel = getSelectionHead();
    research[name] = 'queued';
    const a = sel.enqueueWaitAction(10, () => (research[name] = 'done'));
    a.actionKind = 'R';
    a.on('start', () => (research[name] = 'start'));
    a.on('cancel', () => {
      delete research[name];
      research = research;
    });
  }

  function countTypes(producers) {
    const cobj = producers.reduce((c, p) => {
      if (!c[p.producerType]) c[p.producerType] = 0;
      c[p.producerType]++;
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
  {JSON.stringify(resources, 0, 2)}
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
            <Progress action={selected.produceAction} />
          {/if}
        </div>
        {#each selected.actionQueue as action}
          <div class="inprogress item">
            <button
              class="producerType"
              on:click={(e) => ['A'].includes(action.actionKind) && (selection = [action.producing])}
              on:contextmenu|preventDefault={(e) => selected.cancelAction(action)}
            >
              {action.actionKind}
            </button>
            {#if action.actionKind == 'A'}
              <div class="producerId">{action.producing.id}</div>
            {/if}
            <Progress action={action} />
          </div>
        {/each}
      {/each}
    {:else}
      {#each countTypes(selection) as [producerType, count]}
        <div class="self item">
          <div class="producerType">{producerType}</div>
          <div class="producerId">{count}</div>
        </div>
      {/each}
      <div class="self item">
        <div class="producerType">{selection.reduce((a, p) => a + p.actionQueue.length, 0)}</div>
      </div>
    {/if}
    <br />
    <button on:click={(e) => gather()}>gather</button>
    <button on:click={(e) => infinigather()}>infinigather</button>
    <br />
    {#if !research['thing']}
      <button on:click={(e) => researchClick('thing')}>research</button>
    {/if}
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

</style>
