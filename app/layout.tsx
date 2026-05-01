import { ClerkProvider } from '@clerk/nextjs'
import { ThemeProvider } from '@/lib/theme'
import './globals.css'

export const metadata = {
  title: 'MyLeaguePortal',
  description: 'Professional sports league management platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}