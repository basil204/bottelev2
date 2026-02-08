// Test ChatGPT Team Invite API with Cookie
const testChatGPTInvite = async () => {
    const accountId = "26c08774-651a-48fd-a53c-92e0e565f564";
    const accessToken = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE5MzQ0ZTY1LWJiYzktNDRkMS1hOWQwLWY5NTdiMDc5YmQwZSIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MSJdLCJjbGllbnRfaWQiOiJhcHBfWDh6WTZ2VzJwUTl0UjNkRTduSzFqTDVnSCIsImV4cCI6MTc3MTM5MzgxNiwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS9hdXRoIjp7ImNoYXRncHRfYWNjb3VudF9pZCI6IjI2YzA4Nzc0LTY1MWEtNDhmZC1hNTNjLTkyZTBlNTY1ZjU2NCIsImNoYXRncHRfYWNjb3VudF91c2VyX2lkIjoidXNlci1JeU9NTlFySGZzdklJdFl0NGZTZmZrOWZfXzI2YzA4Nzc0LTY1MWEtNDhmZC1hNTNjLTkyZTBlNTY1ZjU2NCIsImNoYXRncHRfY29tcHV0ZV9yZXNpZGVuY3kiOiJub19jb25zdHJhaW50IiwiY2hhdGdwdF9wbGFuX3R5cGUiOiJ0ZWFtIiwiY2hhdGdwdF91c2VyX2lkIjoidXNlci1JeU9NTlFySGZzdklJdFl0NGZTZmZrOWYiLCJ1c2VyX2lkIjoidXNlci1JeU9NTlFySGZzdklJdFl0NGZTZmZrOWYifSwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS9wcm9maWxlIjp7ImVtYWlsIjoibGlnaHQwbTR3aWxsc29uQGhvdG1haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJpYXQiOjE3NzA1Mjk4MTUsImlzcyI6Imh0dHBzOi8vYXV0aC5vcGVuYWkuY29tIiwianRpIjoiZTljZjJlNTktZmNlZC00MDk5LTllNzItZWM5ODkxMDZkMWYzIiwibmJmIjoxNzcwNTI5ODE1LCJwd2RfYXV0aF90aW1lIjoxNzcwNTI5ODE0MDQ1LCJzY3AiOlsib3BlbmlkIiwiZW1haWwiLCJwcm9maWxlIiwib2ZmbGluZV9hY2Nlc3MiLCJtb2RlbC5yZXF1ZXN0IiwibW9kZWwucmVhZCIsIm9yZ2FuaXphdGlvbi5yZWFkIiwib3JnYW5pemF0aW9uLndyaXRlIl0sInNlc3Npb25faWQiOiJhdXRoc2Vzc194cnFFZUxaUjZXMlVoeXhEUlNzYkVHa1oiLCJzdWIiOiJhdXRoMHxXMk1jZXJDTEp4SDN6NjhJT1M3UGQyQlYifQ.MmC12981S3FIWic6pc66K8bqgzNmm2KHsZaCm100ic7YsVgt61yDi1UpVvGfp0ljTzdLqVDjZKeizEMyGTxWliffpAuHVI_UJ6Q_XQ4c8tRswVPZiCewYtji0v4DmgY2Yj_Iut7PpYCrtoIvWlmE9KB7R5_TXZMnaD7GxGlXNkFdZ49mchGYqv-xjhduUsfHTZnEh5HSxOgaQBm2WDI13TqdHSdtsy02i74htFxbZGqW6QiMTw-WhVmYUzeSP44injgle4r2sPDmG-g9Xg2nzAU_Jj9_4E7HfbA6FdF8cTuPUkirt1sV-98Sy92NW2rb-FOWWbJYk57nJtkyp9iHEhCL6VEnpbw8qT6erU-qokwwjdwOulMHJ0X1iSVIkGPoSitCzzZiNBGMLrxO34Kzpx4oujUEIq3aKC4RwNOA2eMXPbhtyLut6mZrDz1Tm5rgYvZcOAjxThvZQyOtR8zGJT3-PxhjJk7c5PEQhzQ9LhFhPaW9QjdCo61_RoZZyb10YMyFabR0A8YHsVJhpuHP8YZGb3stuCQmvgNQkx2iPW1iaiK569EZr615WvS4ACF3UB1acdlQ1A353wm3lYpqT_18bBZ7mmerZ8rm0MUVpgOq4-xBgecfITpcieFrkMfOs0vedIK4ZR2kMxQUQle99lY0Dx5mhJkpi9Xdet-dooQ";

    // Cookie cần thiết để bypass Cloudflare
    const cookie = `oai-did=56773f1b-073b-494a-868f-c09365bef2f1; _account=${accountId}; _puid=user-IyOMNQrHfsvIItYt4fSffk9f:1770529820-9qrLCajRzWj%2FHpfMBJmHXTl55qTd%2BNF4n38qabIIZtM%3D`;

    const email = "manhnlpp02832@fpt.edu.vn";

    try {
        const response = await fetch(`https://chatgpt.com/backend-api/accounts/${accountId}/invites`, {
            method: "POST",
            headers: {
                "accept": "*/*",
                "accept-language": "vi",
                "authorization": `Bearer ${accessToken}`,
                "chatgpt-account-id": accountId,
                "content-type": "application/json",
                "cookie": cookie,
                "oai-device-id": "56773f1b-073b-494a-868f-c09365bef2f1",
                "oai-language": "vi-VN",
                "origin": "https://chatgpt.com",
                "referer": "https://chatgpt.com/",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36"
            },
            body: JSON.stringify({
                email_addresses: [email],
                role: "standard-user",
                resend_emails: true
            })
        });

        console.log("Status:", response.status);
        console.log("Status Text:", response.statusText);

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            console.log("Response:", JSON.stringify(data, null, 2));
        } else {
            const text = await response.text();
            console.log("Response Text:", text.substring(0, 500));
        }

    } catch (error) {
        console.error("Error:", error.message);
    }
};

testChatGPTInvite();
