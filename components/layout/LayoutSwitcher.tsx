'use client'

import { usePathname } from 'next/navigation'
import { ProductProvider } from '@/lib/contexts/ProductContext'
import AppShell from './AppShell'

export default function LayoutSwitcher({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const isLogin = pathname === '/login'

    if (isLogin) {
        return <>{children}</>
    }

    return (
        <ProductProvider>
            <AppShell>{children}</AppShell>
        </ProductProvider>
    )
}
