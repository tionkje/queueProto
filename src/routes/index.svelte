<script>
  import { Manager, TechTree, Resource } from '@tionkje/queuelib';
  import { writable, readable } from 'svelte/store';
  import { onMount } from 'svelte';
  import Item from '$lib/Item.svelte';
  import Progress from '$lib/Progress.svelte';

  let hash = readable('', (set) => {
    onMount(() => {
      const e = () => set(document.location.hash);
      e();
      window.addEventListener('hashchange', e);
      return () => window.removeEventListener('hashchange', e);
    });
  });

  $: debug = $hash.match(/dev|debug/i);

  // Visuals
  const U = { dead: '💀', traktor: '🚜 ', face: '😶', grain: '🌾', tree: '🌳', book: '📖', people: '👥' };
  const resource1 = U.grain;

  // Tech Tree
  const TT = new TechTree({
    [U.face]: { group: 'P', cost: [1, resource1], time: 10, reqs: [U.face] },
    [U.book]: { group: 'R', cost: [20, resource1], time: 60, reqs: [U.face] },
    [U.grain]: { group: 'G', cost: [0], gather: [1, resource1], time: 10, reqs: [U.face] },

    [U.traktor]: { group: 'P', cost: [5, resource1], time: 2, reqs: [U.face, U.book] },
    [U.tree]: { group: 'G', cost: [0], gather: [10, resource1], time: 1, reqs: [U.traktor] }
  });

  // initial state
  let research, resources, populationLimit;
  const dir = writable(new Manager());

  defaultStart();

  function defaultStart() {
    dir.set(new Manager());
    research = {};
    resources = { [resource1]: new Resource(0) };
    populationLimit = 200;
    const op = $dir.createUnpausedProducer();
    // op.producerKind = U.face;
    op.producerKind = Object.keys(TT.tree)[0];
  }

  $: if ($hash.match(/testcase/)) TESTCASE1();
  function TESTCASE1() {
    dir.set(new Manager());
    research = {};
    resources = { [resource1]: new Resource(2) };
    populationLimit = 4;
    const op = $dir.createUnpausedProducer();
    const op2 = $dir.createUnpausedProducer();
    op.producerKind = Object.keys(TT.tree)[0];
    op2.producerKind = Object.keys(TT.tree)[0];
    queueNewAction(op, U.face);
    // queueNewAction(op2, U.face);
  }

  let selection = [];

  const population = writable(1);
  $: $population = $dir.unPausedProducers.length;

  function resourcePred(cost) {
    if (!Array.isArray(cost)) cost = [cost];
    if (!Array.isArray(cost[0])) cost = [cost];
    cost = cost.filter(([a]) => a > 0);
    if (cost.length == 0) return () => true;
    cost = cost.map(([amount, resourceType]) => [amount, resources[resourceType]]);
    let gathered = false;
    return () => {
      if (gathered) return true;
      if (cost.every(([amount, resource]) => resource.canSpend(amount))) {
        cost.forEach(([amount, resource]) => resource.spend(amount));
        resources = resources;
        gathered = true;
        return true;
      }
      return false;
    };
  }

  function filterResearch(obj, key) {
    if (!Array.isArray(key)) key = [key];
    return Object.fromEntries(Object.entries(obj).filter(([k, v]) => key.includes(v)));
  }
  function queueNewAction(producer, kind, count = 1) {
    if (producer.head?.actionKind == kind) return (producer.head.actionCount += count);
    const t = TT.tree[kind];
    const _resourcePred = resourcePred(t.cost);
    const populationPred = () => $dir.unPausedProducers.length < populationLimit;
    const techTreePred = () =>
      TT.getProduceOptions(producer.producerKind, filterResearch(research, 'done')).includes(kind);
    let a;
    switch (t.group) {
      case 'P':
        {
          let pred = () => populationPred() && techTreePred() && _resourcePred();
          let postPred = () => {
            return populationPred() && techTreePred();
          };
          a = produceProducer(producer, pred, postPred, t.time, kind);
        }
        break;
      case 'R':
        {
          let pred = () => techTreePred() && _resourcePred();
          a = produceResearch(producer, pred, t.time, kind);
          count = 1;
        }
        break;
      case 'G':
        let pred = () => techTreePred() && _resourcePred();
        a = produceGather(producer, pred, t.time, t.gather);
        break;
      default:
        throw new Error('Invalid group');
    }
    a.actionGroup = t.group;
    a.actionKind = kind;
    a.actionCount = count;
    if (a.actionCount >= 1) a.on('finish', () => queueNewAction(producer, kind, a.actionCount - 1));
  }
  function produceProducer(producer, pred, postPred, time, kind) {
    const a = producer.enqueuePredProduceAction(pred, time, postPred);
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

  function selfDestruct(producer) {
    const a = producer.enqueueWaitAction(0, () => {
      $dir.removeProducer(producer);
      if (selection.includes(producer)) selection.splice(selection.indexOf(producer), 1);
    });
    a.actionGroup = U.dead;
  }

  function countTypes(producers) {
    const cobj = producers.reduce((c, p) => {
      if (!c[p.producerKind]) c[p.producerKind] = 0;
      c[p.producerKind]++;
      return c;
    }, {});
    return Object.entries(cobj);
  }

  function getSelectionHead() {
    return selection.slice().sort((a, b) => {
      if (!!a.paused != !!b.paused) return !!a.paused - !!b.paused;
      // TODO: sort by time taken by actions. What to do for not determined action times? (guesstimate??)
      return a.actionQueue.length - b.actionQueue.length;
    })[0];
  }

  let speed = 1;
  onMount(() => {
    let prev = performance.now();
    function loop() {
      let now = performance.now();
      const dt = ((now - prev) / 1000) * speed;
      if (!paused) $dir.evaluate(dt);
      prev = now;
      $dir = $dir;
      selection = selection;
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });

  import { crossfade, fade } from 'svelte/transition';
  const [send, receive] = crossfade({
    duration: 1500,
    // easing: quintOut
    fallback: fade
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
      {speed}
      <button on:click={(e) => (speed *= 2)}> faster </button>
      <button on:click={(e) => (speed /= 2)}> slower </button>
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
    <div>{U.people} {$population}/{populationLimit}</div>
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
                  {action.actionKind}
                </button>
                <div class="badge bl">{action.actionGroup}</div>
                <div class="badge br">{action.actionCount}</div>
                <Progress {action} />
              </div>
            {/each}
            <div>
              {#each TT.getProduceOptions(selected.producerKind, research).filter((x) => !research[x]) as kind}
                <div class="produceButton">
                  <button
                    on:click={(e) => queueNewAction(selected, kind)}
                    on:contextmenu|preventDefault={(e) => queueNewAction(selected, kind, Infinity)}
                  >
                    {kind}
                  </button>
                  <div class="badge bl">{TT.tree[kind].group}</div>
                </div>
              {/each}
            </div>
            <div>
              <div class="produceButton">
                <button on:click={(e) => selfDestruct(selected)}>{U.dead}</button>
              </div>
            </div>
          {/each}
        {:else}
          {#each countTypes(selection) as [producerKind, count]}
            <div class="self item">
              <div class="producerType">{producerKind}</div>
              <div class="badge bl">{count}</div>
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
    <!-- <br /> -->
    {#each $dir.unPausedProducers.filter((x) => !x.paused) as p}
      <div class="fieldItem" in:send={{ key: p.id }} out:receive={{ key: p.id }}>
        <Item bind:selection bind:producer={p} />
      </div>
    {/each}
  </fieldset>

  <fieldset class="field">
    <legend>Expected</legend>
    {#each $dir.pausedProducers.filter((x) => x.paused) as p}
      <div class="fieldItem" in:send={{ key: p.id }} out:receive={{ key: p.id }}>
        <Item bind:selection bind:producer={p} />
      </div>
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
  .field {
    display: flex;
    flex-wrap: wrap;
  }
  .selection {
    background-color: #fffde7;
    height: 200px;
    position: fixed;
    bottom: 0;
    right: 0;
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
    padding: 2px 4px;
    font-size: 0.5em;
    font-family: Arial;
    pointer-events: none;
  }
  .badge.br {
    right: 0;
    bottom: 0;
    background: black;
    color: white;
    opacity: 0.8;
  }
  .badge.bl {
    left: 0;
    bottom: 0;
  }
  .produceButton button {
    height: 50px;
    width: 100%;
  }
</style>
