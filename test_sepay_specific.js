import { getTransactions } from './includes/services/sepayService.js';

const testSepaySpecific = async () => {
    try {
        const accountNumber = '334218';
        const apiKey = 'AUIYQTXXCACDGJRK1OQGMS3BB6ERFH7CGG42BIIPKSVVT8PMNFNOP6QUAZZ9E5J5';

        // Get today's range in YYYY-MM-DD HH:mm:ss format
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        const transaction_date_min = `${dateStr} 00:00:00`;
        const transaction_date_max = `${dateStr} 23:59:59`;

        console.log(`Fetching Sepay transactions for Account: ${accountNumber}`);
        console.log(`From: ${transaction_date_min}`);
        console.log(`To:   ${transaction_date_max}`);

        const data = await getTransactions(apiKey, {
            account_number: accountNumber,
            transaction_date_min,
            transaction_date_max,
            limit: 20
        });

        console.log('API Response Status:', data.status);
        if (data.transactions) {
            console.log(`Found ${data.transactions.length} transactions:`);
            data.transactions.forEach(tx => {
                console.log(`- [${tx.transaction_date}] ${tx.amount_in} VND | Content: ${tx.transaction_content}`);
            });
        } else {
            console.log('Result:', data);
        }

    } catch (error) {
        console.error('Test failed:', error.message);
    }
};

testSepaySpecific();
