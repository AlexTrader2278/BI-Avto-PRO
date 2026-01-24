import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BI-AVTO PRO - Интеллектуальная диагностика автомобилей',
  description: 'AI-powered automotive diagnostic and service recommendation system',
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  )
}