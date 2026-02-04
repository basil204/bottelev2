import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// API to manually create tables if they don't exist
export async function GET() {
    try {
        // Create account_types table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS account_types (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create stored_accounts table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS stored_accounts (
                id INT PRIMARY KEY AUTO_INCREMENT,
                account_type_id INT NOT NULL,
                data TEXT NOT NULL,
                payment_status ENUM('pending', 'paid', 'invalid') DEFAULT 'pending',
                sale_status ENUM('in_stock', 'sold') DEFAULT 'in_stock',
                paid_at TIMESTAMP NULL,
                sold_at TIMESTAMP NULL,
                note TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_type_id) REFERENCES account_types(id) ON DELETE CASCADE,
                INDEX idx_type (account_type_id),
                INDEX idx_payment_status (payment_status),
                INDEX idx_sale_status (sale_status)
            )
        `);

        return NextResponse.json({
            success: true,
            message: 'Tables created successfully'
        });
    } catch (error) {
        console.error('Error creating tables:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
