import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import App from './App'

/* The one test that renders the whole app.
 *
 * Every other suite mounts a screen with props, which is why a wiring mistake at the root
 * would pass all of them and still leave the desk blank on a cold start. This environment
 * has no localStorage and no window, so the render exercises the two fallbacks the living
 * world depends on: `load()` starts a clean save, and the world memo catches its own
 * failure and reports an empty cast rather than taking the root down with it.
 */

describe('the app root', () => {
  it('renders the desk on a cold start, with no save and no country on file', () => {
    const html = renderToStaticMarkup(<App />)
    expect(html).toContain('class="desk-bg"')
    expect(html).toContain('STATE EXECUTIVE COUNCIL')
    expect(html).toContain('WEEK 41')
    /* the desk, not a blank page: the tray and the week close are both on screen */
    expect(html).toContain('dv2')
    expect(html.length).toBeGreaterThan(2000)
  })

  it('does not invent a cast before the country has run', () => {
    const html = renderToStaticMarkup(<App />)
    expect(html).not.toContain('WHO IS WATCHING')
  })
})
