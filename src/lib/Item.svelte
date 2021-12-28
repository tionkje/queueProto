<script>
  import Progress from '$lib/Progress.svelte';
  import { getContext } from 'svelte';
  export let selection = false;
  export let producer = null;

  const dir = getContext('dir');
  const util = getContext('util');

  function onClick(e) {
    if (e.detail > 1) {
      selection = $dir.producers.filter(
        (p) => p.producerKind == producer.producerKind && p.paused === producer.paused
      );
      return;
    }
    if (selection.includes(producer) && selection.length == 1)
      selection = selection.filter((x) => x != producer);
    else selection = [producer];
  }
  function onRightClick(e) {
    if (selection.includes(producer)) selection.splice(selection.indexOf(producer), 1);
    else selection.push(producer);
  }
</script>

<div
  class="producers item"
  class:selected={selection.includes(producer)}
  class:paused={producer.paused}
>
  <button class="producerType" on:click={onClick} on:contextmenu|preventDefault={onRightClick}>
    {producer.producerKind}
  </button>
  <div class="badge bl">{producer.id}</div>
  {#if producer.head}
    <div class="badge br">{util.printCount(producer.actionCount())}</div>
    {#if !producer.paused}
      <Progress action={producer.head} />
    {/if}
  {/if}
  {#if producer.paused && producer.produceAction}
    <Progress action={producer.produceAction} />
  {/if}
</div>

<style>
  .item {
    width: 50px;
    display: inline-flex;
    position: relative;
    font-size: 2em;
    margin: 2px;
  }
  .item.paused {
    opacity: 0.6;
  }
  .item.selected {
    border: 1px solid black;
  }

  .item button {
    border: none;
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
</style>
