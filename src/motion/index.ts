// The motion engine shared by the walk and launch styles: frame-pure easing and motion helpers, the canvas layout per
// format, a scene camera, a cursor, counters, kinetic words and a font gate. Colours and fonts come from useTheme().
export { EASE, tween, enter, exit, press, drift, arc, TRAVEL } from './motion'
export { layoutFor, useLayout, type Kind, type Layout, type Safe } from './layout'
export { camAt, Camera, Box, At, Center, type Cam, type CamKey } from './Camera'
export { cursorAt, Cursor, type Move } from './Cursor'
export { Odometer, Counter, mixColor } from './Counter'
export { Words } from './Words'
export { useFontGate, firstFamily } from './fonts'
