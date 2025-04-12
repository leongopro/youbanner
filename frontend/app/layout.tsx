import type { Metadata } from 'next'
import "../styles/globals.css"

export const metadata: Metadata = {
  title: 'AutoYouBanner - YouTube Banner生成器',
  description: '一键生成YouTube频道Banner，支持各种风格定制',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
} 