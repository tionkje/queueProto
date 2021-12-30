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
      function onover(e) {
        if (!tooltip) return;
        tooltip.style.display = 'block';

        tooltip.dispatchEvent(new CustomEvent('hover', { detail: data }));
      }
      function onmove(e) {
        const { clientX, clientY } = e;
        // console.log('move', clientX, clientY);
        tooltip.style.transform = `translate(${clientX}px,${clientY}px)`;
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
