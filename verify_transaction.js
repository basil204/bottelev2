const extractToken = (text) => {
    if (!text) return null;
    const match = text.toUpperCase().match(/([A-Z]{4}[0-9]{4})/);
    return match ? match[1] : null;
};

const tx = {
    "id": "40192212",
    "amount_in": "50000.00",
    "transaction_content": "MBVCB.12760536962.160535.MPIC0837.CT tu 9338739954 NGUYEN LIEN MANH toi 334218 NGUYEN LIEN MANH tai MB- Ma GD ACSP/ yu160535"
};

console.log("🔍 Testing Token Extraction...");
console.log("📄 Content:", tx.transaction_content);

const token = extractToken(tx.transaction_content);
console.log("🔑 Extracted Token:", token);

if (token === "MPIC0837") {
    console.log("✅ Success: Token matches expected format.");
} else {
    console.log("❌ Failed: Could not extract correct token.");
}
