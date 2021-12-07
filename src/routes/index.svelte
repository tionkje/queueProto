<script>
  import { Manager, ProduceAction } from 'queueDirector';

  const dir = new Manager();
  dir.createProducer();

  let selIdx;
  let selected;
  $: if(!isNaN(selIdx)) selected = dir.producers[selIdx];

  function createNewInSelected() {
    selected.enque((newP) => new ProduceAction(1, newP));
    dir.producers = dir.producers;
  }
  function cancelAction(action){
    selected.cancelAction(action);
    selected.actionQueue = selected.actionQueue;
  }
</script>

{#each dir.producers as p, i}
<button class:paused={p.paused} on:click={(e) => (selIdx = i)}>{p.id}</button>
{/each}

<br>
<br>

{#if selected}
  {selected.id}
  <button on:click={createNewInSelected}>create</button>
  <br>
  {#each selected.actionQueue as action}
  <button on:click={e=>cancelAction(action)}>{action.id}</button>
  {/each}
{/if}

<style>
.paused{ opacity:.6; }
</style>
