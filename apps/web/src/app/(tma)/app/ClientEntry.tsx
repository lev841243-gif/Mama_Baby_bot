'use client'
import dynamic from 'next/dynamic'

// SDK Telegram работает только в браузере.
const MiniApp = dynamic(() => import('./MiniApp'), { ssr: false })

export function ClientEntry() {
  return <MiniApp />
}
