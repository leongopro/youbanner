import type { Metadata } from 'next'
import "./globals.css"
import ErrorBoundary from '@/components/ErrorBoundary';
import { ErrorHandlerProvider } from '@/providers/ErrorHandlerProvider';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'AutoYouBanner - YouTube Banner生成器',
  description: '一键生成YouTube频道Banner，支持各种风格定制',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col">
        <ErrorHandlerProvider>
          <ErrorBoundary>
            <main className="flex-grow">
              {children}
            </main>
            <Footer />
          </ErrorBoundary>
        </ErrorHandlerProvider>
      </body>
    </html>
  )
} 