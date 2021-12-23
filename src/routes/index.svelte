<script>
  import { Manager, TechTree, Resource } from '@tionkje/queuelib';
  import { writable } from 'svelte/store';
  import { onMount } from 'svelte';
  import Item from '$lib/Item.svelte';
  import Progress from '$lib/Progress.svelte';

  const TT = new TechTree({
    A: { group: 'P', cost: [1, 'itium'], time: 5, reqs: ['A'] },
    B: { group: 'P', cost: [1, 'itium'], time: 2, reqs: ['A', 'R'] },
    R: { group: 'R', cost: [10, 'itium'], time: 10, reqs: ['A'] },
    G: { group: 'G', cost: [0], gather: [1, 'itium'], time: 5, reqs: ['A'] },
    G2: { group: 'G', cost: [0], gather: [1, 'itium'], time: 1, reqs: ['B'] }
  });

  let selection = [];
  let research = {};
  let resources = { itium: new Resource(20) };
  const populationLimit = 20;

  $: population = $dir.producers.filter((x) => !x.paused).length;

  function initDir() {
    const dir = new Manager();
    const op = dir.createUnpausedProducer();
    op.producerKind = 'A';
    return dir;
  }
  const dir = writable(initDir());

  let debug = false;
  onMount(() => {
    const e = () => (debug = !!document.location.hash.match(/dev|debug/i));
    window.addEventListener('hashchange', e);
    return () => window.removeEventListener('hashchange', e);
  });

  function getSelectionHead() {
    return selection.slice().sort((a, b) => {
      if (!!a.paused != !!b.paused) return !!a.paused - !!b.paused;
      // TODO: sort by time taken by actions. What to do for not determined action times? (guesstimate??)
      return a.actionQueue.length - b.actionQueue.length;
    })[0];
  }
  function resourcePred(cost) {
    if (!Array.isArray(cost)) cost = [cost];
    if (!Array.isArray(cost[0])) cost = [cost];
    cost = cost.filter(([a]) => a > 0);
    if (cost.length == 0) return () => true;
    cost = cost.map(([amount, resourceType]) => [amount, resources[resourceType]]);
    return () => {
      if (cost.every(([amount, resource]) => resource.canSpend(amount))) {
        cost.forEach(([amount, resource]) => resource.spend(amount));
        resources = resources;
        return true;
      }
      return false;
    };
  }

  function filterResearch(obj, key) {
    if (!Array.isArray(key)) key = [key];
    return Object.fromEntries(Object.entries(obj).filter(([k, v]) => key.includes(v)));
  }
  function create(producer, kind, count = 1) {
    const t = TT.tree[kind];
    const rPred = resourcePred(t.cost);
    const pred = () =>
      (t.group != 'P' || popupation < populationLimit) &&
      TT.getProduceOptions(producer.producerKind, filterResearch(research, 'done')).includes(kind) &&
      rPred();
    let a;
    switch (t.group) {
      case 'P':
        a = produceProducer(producer, pred, t.time, kind);
        break;
      case 'R':
        a = produceResearch(producer, pred, t.time, kind);
        count = 1;
        break;
      case 'G':
        a = produceGather(producer, pred, t.time, t.gather);
        break;
      default:
        throw new Error('Invalid group');
    }
    a.actionGroup = t.group;
    if (--count) a.on('finish', () => create(producer, kind, count));
  }
  function produceProducer(producer, pred, time, kind) {
    const a = producer.enqueuePredProduceAction(pred, time);
    a.producing.producerKind = kind;
    return a;
  }
  function produceResearch(producer, pred, time, kind) {
    if (research[kind]) throw new Error('Multi research');
    research[kind] = 'queued';
    const a = producer.enqueuePredWaitAction(pred, time, () => {
      research[kind] = 'done';
      research = research;
    });
    a.on('start', () => (research[kind] = 'start'));
    a.on('cancel', () => {
      delete research[kind];
      research = research;
    });
    return a;
  }
  function produceGather(producer, pred, time, gather) {
    if (!Array.isArray(gather)) gather = [gather];
    if (!Array.isArray(gather[0])) gather = [gather];
    const a = producer.enqueuePredWaitAction(pred, time, () => {
      gather.forEach(([amount, resourceType]) => resources[resourceType].gather(amount));
      resources = resources;
    });
    return a;
  }

  function countTypes(producers) {
    const cobj = producers.reduce((c, p) => {
      if (!c[p.producerKind]) c[p.producerKind] = 0;
      c[p.producerKind]++;
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

<main class="mainLayout">
  {#if debug}
    <fieldset class="controls">
      <legend>Controls</legend>
      <button on:click={(e) => (paused = !paused)}>
        {#if paused} Go {:else} Pause {/if}
      </button>
    </fieldset>

    <fieldset class="researched">
      <legend>Research</legend>
      {#each Object.entries(research) as [research, status]}
        <div class="research {status}">{research}</div>
      {/each}
    </fieldset>
  {/if}

  <fieldset class="researched">
    <legend>Resources</legend>
    {#each Object.entries(resources) as [resource, amount]}
      <div>{resource} {amount}</div>
    {/each}
    <div>population {population}/{populationLimit}</div>

  </fieldset>

  {#if selection.length}
    <fieldset class="selection">
      <legend>Selection</legend>
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
                  on:click={(e) => ['P'].includes(action.actionGroup) && (selection = [action.producing])}
                  on:contextmenu|preventDefault={(e) => selected.cancelAction(action)}
                >
                  {action.actionGroup}
                </button>
                {#if action.actionGroup == 'P'}
                  <div class="badge">{action.producing.id}</div>
                {/if}
                <Progress {action} />
              </div>
            {/each}
            <div>
              {#each TT.getProduceOptions(selected.producerKind, research).filter((x) => !research[x]) as kind}
                <div class="produceButton">
                  <button
                    on:click={(e) => create(selected, kind)}
                    on:contextmenu|preventDefault={(e) => create(selected, kind, Infinity)}
                  >
                    {kind}
                  </button>
                  <div class="badge">{TT.tree[kind].group}</div>
                </div>
              {/each}
            </div>
            <div>
              <button
                on:click={(e) => {
                  $dir.removeProducer(selected);
                  selection.splice(selection.indexOf(selected), 1);
                }}>X</button
              >
            </div>
          {/each}
        {:else}
          {#each countTypes(selection) as [producerKind, count]}
            <div class="self item">
              <div class="producerType">{producerKind}</div>
              <div class="badge">{count}</div>
            </div>
          {/each}
          <div class="self item">
            <div class="producerType">{selection.reduce((a, p) => a + p.actionQueue.length, 0)}</div>
          </div>
        {/if}
      {/if}
    </fieldset>
  {/if}

  <fieldset class="field">
    <legend>Field</legend>
    <!-- <button on:click={(e) => (selection = $dir.producers)}>select all</button> -->
    <br />
    {#each $dir.producers.filter((x) => !x.paused) as p, i}
      <Item bind:selection bind:producer={p} />
    {/each}
    <br />
    {#each $dir.producers.filter((x) => x.paused) as p, i}
      <Item bind:selection bind:producer={p} />
    {/each}
  </fieldset>

  <!-- <pre>{JSON.stringify($dir,0,2)}</pre> -->
</main>

<style>
  :global(body) {
    font-family: Arial;
  }
  :global(button) {
    cursor: pointer;
    font-size: inherit;
    font-family: inherit;
  }
  main.mainLayout {
    display: grid;
  }
  .paused {
    opacity: 0.6;
  }
  fieldset {
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
  .item,
  .produceButton {
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
  .badge {
    position: absolute;
    left: 0;
    bottom: 0;
    font-size: 0.5em;
    pointer-events: none;
  }

  .produceButton button {
    height: 50px;
    width: 100%;
  }
</style>
