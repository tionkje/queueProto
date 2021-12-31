import { tick } from 'svelte';

export function createTooltip() {
  let tooltip;
  let hovers = [];

  return [
    function tooltipEl(node) {
      if (tooltip) throw new Error(`Unexpected 2 times`);

      tooltip = node;

      tooltip.style.display = 'none';
      tooltip.style.position = 'fixed';

      return () => (tooltip = null);
    },
    function hoverEl(node, data) {
      function positionTooltip(e) {
        const { innerWidth, innerHeight } = window;
        const { clientX, clientY } = e;
        let { width, height } = tooltip.getBoundingClientRect();

        // check bigger than screen size
        var xmax = Math.max(clientX, innerWidth - clientX);
        tooltip.style.maxWidth = xmax < width ? xmax + 'px' : '';
        var ymax = Math.max(clientY, innerHeight - clientY);
        tooltip.style.maxHeight = ymax < height ? ymax + 'px' : '';
        ({ width, height } = tooltip.getBoundingClientRect());

        // position
        var x = clientX,
          y = clientY - height;
        if (clientX - width < 0) x = clientX;
        if (clientY - height < 0) y = clientY;
        if (clientX + width > innerWidth) x = clientX - width;
        if (clientY + height > innerHeight) y = clientY - height;

        tooltip.style.transform = `translate(${x}px,${y}px)`;
      }
      async function onover(e) {
        if (!tooltip) return;
        tooltip.style.display = 'block';
        tooltip.dispatchEvent(new CustomEvent('hover', { detail: data }));

        await tick(); // wait for content to be present
        positionTooltip(e);
      }
      function onmove(e) {
        positionTooltip(e);
      }
      function onout() {
        if (!tooltip) return;
        // console.log('out');
        tooltip.style.display = 'none';
      }
      node.addEventListener('pointerover', onover);
      node.addEventListener('pointerout', onout);
      node.addEventListener('pointermove', onmove);
      hovers.push(node);
      return () => {
        hovers.splice(hovers.indexOf(node));
        node.removeEventListener('pointerover', onover);
        node.removeEventListener('pointerout', onout);
        node.removeEventListener('pointermove', onmove);
      };
    }
  ];
}
