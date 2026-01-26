import axios from 'axios';

const SEPAY_API_URL = 'https://my.sepay.vn/userapi/transactions/list';
export const getTransactions = async (token, filters = {}) => {
    try {
        if (!token) throw new Error('Sepay API Token is required');

        const config = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            params: filters
        };

        const response = await axios.get(SEPAY_API_URL, config);
        return response.data;
    } catch (error) {
        console.error('Error fetching Sepay transactions:', error.response ? error.response.data : error.message);
        throw error; // Rethrow to let caller handle or ignore
    }
};
