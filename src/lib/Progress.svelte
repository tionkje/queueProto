<script>
  export let action;
</script>

{#if action.started}
  <progress value={1 - action.progress} />
{/if}

<style>
  progress {
    pointer-events: none;
    border: none;
    width: 100%;
    height: 100%;
    background: transparent;
    position: absolute;
    opacity: 0.2;
  }
  progress[value]::-webkit-progress-bar {
    background-color: transparent;
  }
  progress[value]::-webkit-progress-value {
    background-color: black;
  }
</style>
