export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getCascadingPosition(
  existingWindowsCount: number,
  preferredWidth: number,
  preferredHeight: number,
  viewportWidth: number = 1280,
  viewportHeight: number = 800
): WindowBounds {
  // Safe desktop canvas margins
  const minX = 80; // Left margin for workspace switcher
  const minY = 30; // Top margin
  const maxX = Math.max(minX + 100, viewportWidth - preferredWidth - 20);
  const maxY = Math.max(minY + 100, viewportHeight - preferredHeight - 110); // Bottom margin for dock

  // Center starting point
  const startX = Math.max(minX, Math.round((viewportWidth - preferredWidth) / 2));
  const startY = Math.max(minY, Math.round((viewportHeight - preferredHeight) / 2) - 20);

  // Offset per open window count
  const stepX = 30;
  const stepY = 24;

  let calculatedX = startX + (existingWindowsCount % 8) * stepX;
  let calculatedY = startY + (existingWindowsCount % 8) * stepY;

  // Clamp within desktop bounds
  if (calculatedX > maxX) calculatedX = Math.max(minX, calculatedX % maxX);
  if (calculatedY > maxY) calculatedY = Math.max(minY, calculatedY % maxY);

  return {
    x: Math.round(calculatedX),
    y: Math.round(calculatedY),
    width: preferredWidth,
    height: preferredHeight
  };
}

export function getMaximizedBounds(
  viewportWidth: number,
  viewportHeight: number
): WindowBounds {
  const inset = 10;
  const leftMargin = 72; // Workspace switcher offset
  const bottomMargin = 96; // Dock offset

  return {
    x: leftMargin,
    y: inset,
    width: Math.max(300, viewportWidth - leftMargin - inset),
    height: Math.max(300, viewportHeight - inset - bottomMargin)
  };
}
