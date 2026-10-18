import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const userId = Number(id);

        if (!userId) {
            return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const apiOnly = searchParams.get('api_only') === 'true' || searchParams.get('source') === 'api';

        // Get user's orders with product info
        let ordersQuery = `
            SELECT 
                o.id,
                o.invoice_code,
                o.product_id,
                o.price,
                o.email,
                o.note,
                o.status,
                o.api_key_id,
                COALESCE(o.source, 'bot') as source,
                CASE WHEN (o.api_key_id IS NOT NULL OR o.source = 'api' OR o.note LIKE '%API%') THEN 1 ELSE 0 END as is_api_order,
                o.created_at,
                o.completed_at,
                COALESCE(p.name, o.note, 'Sản phẩm') as product_name
            FROM orders o
            LEFT JOIN products p ON p.id = o.product_id
            WHERE o.user_id = ?
        `;
        const sqlParams: any[] = [userId];

        if (apiOnly) {
            ordersQuery += ` AND (o.api_key_id IS NOT NULL OR o.source = 'api' OR o.note LIKE '%API%')`;
        }

        ordersQuery += ` ORDER BY o.created_at DESC LIMIT 50`;

        const [orders] = await pool.query<any[]>(ordersQuery, sqlParams);

        // Group by product to create a summary
        const productSummary: { [key: string]: { count: number; totalSpent: number; lastPurchase: string; productName: string } } = {};

        for (const order of orders) {
            const productId = order.product_id;
            const productName = order.product_name || `Product #${productId}`;

            if (!productSummary[productId]) {
                productSummary[productId] = {
                    count: 0,
                    totalSpent: 0,
                    lastPurchase: order.created_at,
                    productName
                };
            }

            productSummary[productId].count += 1;
            productSummary[productId].totalSpent += Number(order.price) || 0;
        }

        return NextResponse.json({
            orders,
            summary: Object.entries(productSummary).map(([productId, data]) => ({
                productId: Number(productId),
                ...data
            })),
            total: orders.length
        });
    } catch (error) {
        console.error('Error fetching user orders:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
