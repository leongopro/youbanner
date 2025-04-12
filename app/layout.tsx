import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AutoYouBanner - YouTube Banner生成器',
  description: '自动生成专业美观的YouTube频道横幅，适配所有设备',
  keywords: 'YouTube, Banner, 横幅, 生成器, AI, 设计',
  authors: [{ name: 'AutoYouBanner Team' }],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
} 