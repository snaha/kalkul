/**
 * Whether the app is running inside a frame on another page. GitHub Pages
 * sends no response headers and `frame-ancestors` is ignored in a `<meta>`
 * policy, so the root layout refuses to render instead: a page that frames
 * the app could otherwise overlay it and steer clicks onto its buttons.
 */
export function isFramed(win: { top: unknown; self: unknown }): boolean {
  return win.top !== win.self
}
