import type { ReactNode } from 'react'

/** Transparent document so video shows through empty overlay regions when embedded. */
export default function GameOverlayLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: transparent !important;
              min-height: 100%;
            }
          `,
        }}
      />
      {children}
    </>
  )
}
