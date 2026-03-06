'use client'

import { useState, useEffect } from 'react'
import BackLink from '@/components/BackLink'
import CustomSelect from '@/components/CustomSelect'
import { useProduct } from '@/lib/contexts/ProductContext'
import Loader from '@/components/Loader'
import { getJapaneseDescription } from '@/lib/constants/ga4MetadataTranslations'
import type { Metric, Dimension } from './types'
import styles from './GA4MetadataPage.module.css'

export default function GA4MetadataPage() {
    const { currentProduct } = useProduct()
    const [loading, setLoading] = useState(false)
    const [metrics, setMetrics] = useState<Metric[]>([])
    const [dimensions, setDimensions] = useState<Dimension[]>([])
    const [error, setError] = useState<string | null>(null)
    const [selectedCategory, setSelectedCategory] = useState<string>('all')

    const fetchMetadata = async () => {
        if (!currentProduct?.ga4PropertyId) {
            setError('プロダクトが選択されていません')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const response = await fetch(
                `/api/ga4/metadata?propertyId=${currentProduct.ga4PropertyId}`
            )

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.message || 'メタデータの取得に失敗しました')
            }

            const data = await response.json()
            setMetrics(data.metrics || [])
            setDimensions(data.dimensions || [])
        } catch (err) {
            console.error('Metadata fetch error:', err)
            setError(err instanceof Error ? err.message : 'メタデータの取得に失敗しました')
        } finally {
            setLoading(false)
        }
    }

    const getCategoryDisplayName = (category: string): string => {
        const categoryMap: Record<string, string> = {
            'EVENT': 'イベント',
            'USER': 'ユーザー',
            'SESSION': 'セッション',
            'ITEM': 'アイテム',
            'ECOMMERCE': 'Eコマース',
            'TRAFFIC_SOURCE': 'トラフィックソース',
            'GEO': '地理',
            'TECHNOLOGY': '技術',
            'CONTENT': 'コンテンツ',
            'APP': 'アプリ',
            'VIDEO': '動画',
            'AUDIENCE': 'オーディエンス',
            'LIFECYCLE': 'ライフサイクル',
            'CONVERSION': 'コンバージョン',
            'CUSTOM': 'カスタム',
        }
        return categoryMap[category] || category
    }

    const getTypeDisplayName = (type: string): string => {
        const typeMap: Record<string, string> = {
            'TYPE_INTEGER': '整数',
            'TYPE_FLOAT': '浮動小数点数',
            'TYPE_SECONDS': '秒',
            'TYPE_MILLISECONDS': 'ミリ秒',
            'TYPE_MINUTES': '分',
            'TYPE_HOURS': '時間',
            'TYPE_STANDARD': '標準',
            'TYPE_CURRENCY': '通貨',
            'TYPE_FEET': 'フィート',
            'TYPE_MILES': 'マイル',
            'TYPE_METERS': 'メートル',
            'TYPE_KILOMETERS': 'キロメートル',
        }
        return typeMap[type] || type
    }

    const filteredMetrics = selectedCategory === 'all'
        ? metrics
        : metrics.filter((m) => m.category === selectedCategory)

    const filteredDimensions = selectedCategory === 'all'
        ? dimensions
        : dimensions.filter((d) => d.category === selectedCategory)

    const categories = Array.from(
        new Set([
            ...metrics.map((m) => m.category),
            ...dimensions.map((d) => d.category),
        ])
    ).filter(Boolean)

    if (!currentProduct) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>GA4 メトリクス・ディメンション一覧</h1>
                    <BackLink href="/">ダッシュボードに戻る</BackLink>
                </div>
                <div className={styles.warningContainer}>
                    <p className={styles.warningText}>
                        プロダクトを選択してください。右上のドロップダウンから選択できます。
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>GA4 メトリクス・ディメンション一覧</h1>
                    <p className={styles.description}>
                        プロダクト: <span className={styles.productName}>{currentProduct.name}</span>
                        {currentProduct.ga4PropertyId && (
                            <span className={styles.propertyId}>
                                (プロパティID: {currentProduct.ga4PropertyId})
                            </span>
                        )}
                    </p>
                </div>
                <BackLink href="/">ダッシュボードに戻る</BackLink>
            </div>

            <div className={styles.controls}>
                <button
                    onClick={fetchMetadata}
                    disabled={loading}
                    className={styles.fetchButton}
                >
                    {loading ? '取得中...' : 'メタデータを取得'}
                </button>

                {categories.length > 0 && (
                    <CustomSelect
                        value={selectedCategory}
                        onChange={setSelectedCategory}
                        options={[
                            { value: 'all', label: 'すべてのカテゴリ' },
                            ...categories.map((cat) => ({ value: cat, label: getCategoryDisplayName(cat) })),
                        ]}
                        triggerClassName={styles.categorySelect}
                        aria-label="カテゴリ"
                    />
                )}
            </div>

            {error && (
                <div className={styles.errorContainer}>
                    <p className={styles.errorText}>{error}</p>
                </div>
            )}

            {loading && (
                <div className={styles.loaderContainer}>
                    <Loader />
                </div>
            )}

            {!loading && metrics.length === 0 && dimensions.length === 0 && !error && (
                <div className={styles.emptyContainer}>
                    <p className={styles.emptyText}>
                        メタデータを取得するには、「メタデータを取得」ボタンをクリックしてください。
                    </p>
                </div>
            )}

            {!loading && (filteredMetrics.length > 0 || filteredDimensions.length > 0) && (
                <div className={styles.content}>
                    {filteredMetrics.length > 0 && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>メトリクス ({filteredMetrics.length})</h2>
                            <div className={styles.tableContainer}>
                                <table className={styles.table}>
                                    <thead className={styles.tableHeader}>
                                        <tr>
                                            <th className={styles.tableHeaderCell}>API名</th>
                                            <th className={styles.tableHeaderCell}>表示名</th>
                                            <th className={styles.tableHeaderCell}>説明</th>
                                            <th className={styles.tableHeaderCell}>タイプ</th>
                                            <th className={styles.tableHeaderCell}>カテゴリ</th>
                                        </tr>
                                    </thead>
                                    <tbody className={styles.tableBody}>
                                        {filteredMetrics.map((metric) => (
                                            <tr key={metric.apiName} className={styles.tableRow}>
                                                <td className={`${styles.tableCell} ${styles.tableCellMono}`}>
                                                    {metric.apiName}
                                                </td>
                                                <td className={`${styles.tableCell} ${styles.tableCellText}`}>
                                                    {metric.uiName}
                                                </td>
                                                <td className={`${styles.tableCell} ${styles.tableCellSecondary}`}>
                                                    {getJapaneseDescription(metric.apiName, metric.description || '', 'metric')}
                                                </td>
                                                <td className={`${styles.tableCell} ${styles.tableCellSecondary}`}>
                                                    {getTypeDisplayName(metric.type)}
                                                </td>
                                                <td className={`${styles.tableCell} ${styles.tableCellSecondary}`}>
                                                    {getCategoryDisplayName(metric.category)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {filteredDimensions.length > 0 && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>ディメンション ({filteredDimensions.length})</h2>
                            <div className={styles.tableContainer}>
                                <table className={styles.table}>
                                    <thead className={styles.tableHeader}>
                                        <tr>
                                            <th className={styles.tableHeaderCell}>API名</th>
                                            <th className={styles.tableHeaderCell}>表示名</th>
                                            <th className={styles.tableHeaderCell}>説明</th>
                                            <th className={styles.tableHeaderCell}>カテゴリ</th>
                                        </tr>
                                    </thead>
                                    <tbody className={styles.tableBody}>
                                        {filteredDimensions.map((dimension) => (
                                            <tr key={dimension.apiName} className={styles.tableRow}>
                                                <td className={`${styles.tableCell} ${styles.tableCellMono}`}>
                                                    {dimension.apiName}
                                                </td>
                                                <td className={`${styles.tableCell} ${styles.tableCellText}`}>
                                                    {dimension.uiName}
                                                </td>
                                                <td className={`${styles.tableCell} ${styles.tableCellSecondary}`}>
                                                    {getJapaneseDescription(dimension.apiName, dimension.description || '', 'dimension')}
                                                </td>
                                                <td className={`${styles.tableCell} ${styles.tableCellSecondary}`}>
                                                    {getCategoryDisplayName(dimension.category)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
