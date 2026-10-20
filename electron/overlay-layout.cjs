const PLACEMENTS = ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'];
function overlayPosition(bounds, area, action, step = 32) {
  let x = bounds.x, y = bounds.y;
  const margin = 24;
  if (action === 'restore') { /* Clamp saved coordinates to the current work area. */ }
  else if (['left', 'right', 'up', 'down'].includes(action)) {
    const distance = Math.max(1, Math.min(200, Number(step) || 32));
    x += action === 'left' ? -distance : action === 'right' ? distance : 0;
    y += action === 'up' ? -distance : action === 'down' ? distance : 0;
  } else if (PLACEMENTS.includes(action)) {
    const [vertical, horizontal] = action.split('-');
    x = horizontal === 'left' ? area.x + margin : horizontal === 'right' ? area.x + area.width - bounds.width - margin : area.x + (area.width - bounds.width) / 2;
    y = vertical === 'top' ? area.y + margin : vertical === 'bottom' ? area.y + area.height - bounds.height - margin : area.y + (area.height - bounds.height) / 2;
  } else throw new Error('Choose a movement direction or a screen placement.');
  return { x: Math.round(Math.max(area.x, Math.min(x, Math.max(area.x, area.x + area.width - bounds.width)))), y: Math.round(Math.max(area.y, Math.min(y, Math.max(area.y, area.y + area.height - bounds.height)))) };
}
function fitWindow(bounds, area) {
  if(!area||area.width<1||area.height<1)throw new Error('Display has no usable work area.');
  const width=Math.max(1,Math.min(bounds.width,area.width)),height=Math.max(1,Math.min(bounds.height,area.height));
  return {...overlayPosition({...bounds,width,height},area,'restore'),width,height};
}
module.exports = { overlayPosition, PLACEMENTS, fitWindow };
