// CapCut Auto Join - Client-side JavaScript

function toggleInputMode() {
    const inputMode = document.getElementById('inputMode').value;
    const singleMode = document.getElementById('singleMode');
    const batchMode = document.getElementById('batchMode');
    
    if (inputMode === 'single') {
        singleMode.style.display = 'block';
        batchMode.style.display = 'none';
    } else {
        singleMode.style.display = 'none';
        batchMode.style.display = 'block';
    }
}

function toggleProxyMode() {
    const proxyMode = document.getElementById('proxyMode').value;
    const singleProxyMode = document.getElementById('singleProxyMode');
    const batchProxyMode = document.getElementById('batchProxyMode');
    
    if (proxyMode === 'single') {
        singleProxyMode.style.display = 'block';
        batchProxyMode.style.display = 'none';
        // Set required attributes
        document.getElementById('proxyUrl').required = true;
        document.getElementById('proxies').required = false;
    } else if (proxyMode === 'batch') {
        singleProxyMode.style.display = 'none';
        batchProxyMode.style.display = 'block';
        // Set required attributes
        document.getElementById('proxyUrl').required = false;
        document.getElementById('proxies').required = true;
    } else {
        singleProxyMode.style.display = 'none';
        batchProxyMode.style.display = 'none';
        // Clear required attributes
        document.getElementById('proxyUrl').required = false;
        document.getElementById('proxies').required = false;
    }
}

function updateAccountCounter() {
    const accountsText = document.getElementById('accounts').value;
    const counter = document.getElementById('accountCounter');
    
    if (!accountsText.trim()) {
        counter.innerHTML = '';
        return;
    }
    
    const accounts = accountsText.split('\n').map(line => {
        const [email, password] = line.split(':');
        return { email: email?.trim(), password: password?.trim() };
    }).filter(acc => acc.email && acc.password);
    
    const count = accounts.length;
    const maxCount = 5;
    
    if (count > maxCount) {
        counter.innerHTML = `<span style="color: #dc3545;">⚠️ ${count}/${maxCount} tài khoản (vượt quá giới hạn)</span>`;
    } else if (count === maxCount) {
        counter.innerHTML = `<span style="color: #ffc107;">📊 ${count}/${maxCount} tài khoản (đã đạt giới hạn)</span>`;
    } else {
        counter.innerHTML = `<span style="color: #28a745;">📊 ${count}/${maxCount} tài khoản</span>`;
    }
}

// Lấy proxy free
async function getFreeProxies() {
    const btn = document.getElementById('getFreeProxiesBtn');
    const status = document.getElementById('proxyStatus');
    const textarea = document.getElementById('proxies');
    
    btn.disabled = true;
    btn.textContent = '🔄 Đang lấy...';
    status.innerHTML = '⏳ Đang lấy proxy free từ fineproxy.org...';
    
    try {
        const response = await fetch('/api/free-proxies?count=10');
        const data = await response.json();
        
        if (data.success) {
            const proxyList = data.proxies.map(p => `${p.ip}:${p.port}`).join('\n');
            textarea.value = proxyList;
            status.innerHTML = `✅ Đã lấy ${data.count} proxy free từ ${data.source}`;
        } else {
            status.innerHTML = `❌ Lỗi: ${data.error}`;
        }
    } catch (error) {
        status.innerHTML = `❌ Lỗi: ${error.message}`;
    } finally {
        btn.disabled = false;
        btn.textContent = '🆓 Lấy Proxy Free';
    }
}

// Kiểm tra proxy live
async function checkProxies() {
    const btn = document.getElementById('checkProxiesBtn');
    const status = document.getElementById('proxyStatus');
    const textarea = document.getElementById('proxies');
    
    const proxyText = textarea.value.trim();
    if (!proxyText) {
        status.innerHTML = '⚠️ Vui lòng nhập danh sách proxy trước';
        return;
    }
    
    const proxies = proxyText.split('\n').filter(line => line.trim());
    if (proxies.length === 0) {
        status.innerHTML = '⚠️ Không có proxy hợp lệ nào';
        return;
    }
    
    btn.disabled = true;
    btn.textContent = '🔄 Đang kiểm tra...';
    status.innerHTML = `⏳ Đang kiểm tra ${proxies.length} proxy...`;
    
    try {
        const response = await fetch('/api/check-proxies', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ proxies })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const liveProxies = data.liveProxies.map(p => p.proxy).join('\n');
            textarea.value = liveProxies;
            
            status.innerHTML = `✅ Kiểm tra hoàn tất: ${data.liveCount}/${data.totalCount} proxy live`;
            
            if (data.liveCount === 0) {
                status.innerHTML += '<br>⚠️ Không có proxy nào live, vui lòng thử lại';
            }
        } else {
            status.innerHTML = `❌ Lỗi: ${data.error}`;
        }
    } catch (error) {
        status.innerHTML = `❌ Lỗi: ${error.message}`;
    } finally {
        btn.disabled = false;
        btn.textContent = '✅ Kiểm Tra Live';
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('getFreeProxiesBtn').addEventListener('click', getFreeProxies);
    document.getElementById('checkProxiesBtn').addEventListener('click', checkProxies);
});

// Form submission handler
document.getElementById('joinForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const inputMode = document.getElementById('inputMode').value;
    const proxyMode = document.getElementById('proxyMode').value;
    const inviteLink = document.getElementById('inviteLink').value;
    
    // Lấy danh sách tài khoản
    let accounts = [];
    if (inputMode === 'single') {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        if (!email || !password) {
            alert('Vui lòng nhập đầy đủ email và password');
            return;
        }
        accounts = [{ email, password }];
    } else {
        const accountsText = document.getElementById('accounts').value;
        if (!accountsText.trim()) {
            alert('Vui lòng nhập danh sách tài khoản');
            return;
        }
        accounts = accountsText.split('\n').map(line => {
            const [email, password] = line.split(':');
            return { email: email?.trim(), password: password?.trim() };
        }).filter(acc => acc.email && acc.password);
        
        if (accounts.length === 0) {
            alert('Không có tài khoản hợp lệ nào');
            return;
        }
        
        // Giới hạn 5 tài khoản mỗi lần
        if (accounts.length > 5) {
            const confirmMsg = `Bạn đã nhập ${accounts.length} tài khoản. Để đảm bảo tỷ lệ thành công cao, hệ thống sẽ chỉ xử lý 5 tài khoản đầu tiên.\n\nBạn có muốn tiếp tục với 5 tài khoản đầu tiên?`;
            if (!confirm(confirmMsg)) {
                return;
            }
            accounts = accounts.slice(0, 5);
        }
    }
    
    // Lấy danh sách proxy
    let proxies = [];
    if (proxyMode === 'single') {
        const proxyUrl = document.getElementById('proxyUrl').value;
        if (!proxyUrl.trim()) {
            alert('Vui lòng nhập proxy (bắt buộc)');
            return;
        }
        proxies = [proxyUrl.trim()];
    } else if (proxyMode === 'batch') {
        const proxiesText = document.getElementById('proxies').value;
        if (!proxiesText.trim()) {
            alert('Vui lòng nhập danh sách proxy (bắt buộc)');
            return;
        }
        proxies = proxiesText.split('\n').map(line => line.trim()).filter(line => line);
        if (proxies.length === 0) {
            alert('Không có proxy hợp lệ nào');
            return;
        }
    } else {
        alert('Vui lòng chọn chế độ proxy và nhập proxy (bắt buộc)');
        return;
    }
    
    // Kiểm tra số lượng proxy so với số tài khoản
    if (proxies.length < accounts.length) {
        const confirmMsg = `Số lượng proxy (${proxies.length}) ít hơn số tài khoản (${accounts.length}).\nProxy sẽ được sử dụng lặp lại (round-robin).\nBạn có muốn tiếp tục?`;
        if (!confirm(confirmMsg)) {
            return;
        }
    }
    
    const submitBtn = document.getElementById('submitBtn');
    const loading = document.getElementById('loading');
    const result = document.getElementById('result');
    
    // Show loading
    submitBtn.disabled = true;
    loading.style.display = 'block';
    result.style.display = 'none';
    
    // Lưu thời gian bắt đầu
    const startTime = Date.now();
    
    // Hiển thị thông tin delay
    const loadingText = document.getElementById('loadingText');
    const progressInfo = document.getElementById('progressInfo');
    if (accounts.length > 1) {
        const estimatedTime = accounts.length * 5;
        loadingText.textContent = `Đang xử lý ${accounts.length} tài khoản...`;
        progressInfo.innerHTML = `⏱️ Ước tính thời gian: ~${estimatedTime} giây (5s/tài khoản)`;
    } else {
        loadingText.textContent = 'Đang xử lý...';
        progressInfo.innerHTML = '';
    }
    
    try {
        const response = await fetch('/join', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                accounts, 
                proxies, 
                inviteLink,
                inputMode,
                proxyMode
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            result.className = 'result success';
            
            let resultHtml = '';
            
            // Hiển thị thống kê tổng quan
            if (data.results && data.results.length > 1) {
                const successRate = ((data.successCount / data.total) * 100).toFixed(1);
                const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
                const estimatedTime = (data.total * 5).toFixed(0); // Ước tính thời gian với delay 5s
                resultHtml += `
                    <div class="summary-info">
                        <h4>📊 Tổng kết:</h4>
                        <p><strong>Tổng số:</strong> ${data.total}</p>
                        <p><strong>Thành công:</strong> <span style="color: #28a745; font-weight: bold;">${data.successCount}</span></p>
                        <p><strong>Thất bại:</strong> <span style="color: #dc3545; font-weight: bold;">${data.errorCount}</span></p>
                        <p><strong>Tỷ lệ thành công:</strong> <span style="color: ${successRate >= 70 ? '#28a745' : successRate >= 50 ? '#ffc107' : '#dc3545'}; font-weight: bold;">${successRate}%</span></p>
                        <p><strong>Thời gian xử lý:</strong> ${processingTime}s (Ước tính: ~${estimatedTime}s với delay 5s/tài khoản)</p>
                    </div>
                `;
            }
            
            // Hiển thị link conversion nếu có
            if (data.convertedLink) {
                resultHtml += `
                    <div class="conversion-info">
                        <h4>🔄 Link Conversion:</h4>
                        <p><strong>Original:</strong> ${data.originalLink}</p>
                        <p><strong>Converted:</strong> ${data.convertedLink}</p>
                    </div>
                `;
            }
            
            // Hiển thị kết quả từng tài khoản
            if (data.results && data.results.length > 1) {
                resultHtml += '<div class="batch-results">';
                data.results.forEach((result, index) => {
                    const status = result.success ? '✅' : '❌';
                    const statusText = result.success ? 'Thành công' : 'Thất bại';
                    
                    resultHtml += `
                        <div class="account-result ${result.success ? 'success' : 'error'}">
                            <h5>${status} Tài khoản ${index + 1}: ${result.email}</h5>
                            <p><strong>Trạng thái:</strong> ${statusText}</p>
                            ${result.proxy ? `<p><strong>Proxy:</strong> ${result.proxy}</p>` : ''}
                            ${result.sessionid ? `<p><strong>Session ID:</strong> ${result.sessionid}</p>` : ''}
                            ${result.error ? `<p><strong>Lỗi:</strong> ${result.error}</p>` : ''}
                            ${result.errorDetails ? `
                                <div class="error-info">
                                    <h6>❌ Chi tiết lỗi:</h6>
                                    ${result.errorDetails.code ? `<p><strong>Mã lỗi:</strong> ${result.errorDetails.code}</p>` : ''}
                                    ${result.errorDetails.description ? `<p><strong>Mô tả:</strong> ${result.errorDetails.description}</p>` : ''}
                                </div>
                            ` : ''}
                            ${result.response && result.response.data && result.response.data.workspace_info ? `
                                <div class="workspace-info">
                                    <h6>📊 Thông tin Workspace:</h6>
                                    <p><strong>Tên:</strong> ${result.response.data.workspace_info.name}</p>
                                    <p><strong>Vai trò:</strong> ${result.response.data.workspace_info.role}</p>
                                    <p><strong>Người mời:</strong> ${result.response.data.workspace_info.caller_nickname}</p>
                                    <p><strong>Giới hạn thành viên:</strong> <span style="color: #6c757d;">${result.response.data.workspace_info.member_limit || 'Không giới hạn'}</span></p>
                                    <p><strong>Số thành viên hiện tại:</strong> <span style="color: #28a745; font-weight: bold;">${result.response.data.workspace_info.member_cnt || 'N/A'}</span></p>
                                    ${result.response.data.workspace_info.team_vip_end ? `
                                        <p><strong>VIP kết thúc:</strong> <span style="color: #ff6b35; font-weight: bold;">${new Date(result.response.data.workspace_info.team_vip_end * 1000).toLocaleDateString('vi-VN')} ${new Date(result.response.data.workspace_info.team_vip_end * 1000).toLocaleTimeString('vi-VN')}</span></p>
                                    ` : ''}
                                    <p><strong>Khu vực:</strong> ${result.response.data.workspace_info.region || 'N/A'}</p>
                                </div>
                            ` : ''}
                            ${result.response && result.response.ret && !result.success ? `
                                <div class="error-info">
                                    <h6>❌ Chi tiết lỗi:</h6>
                                    <p><strong>Mã lỗi:</strong> ${result.response.ret}</p>
                                    <p><strong>Thông báo:</strong> ${result.response.errmsg || 'Không xác định'}</p>
                                    ${result.response.data && result.response.data.description ? `<p><strong>Mô tả:</strong> ${result.response.data.description}</p>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    `;
                });
                resultHtml += '</div>';
            } else if (data.results && data.results.length === 1) {
                // Hiển thị kết quả đơn lẻ
                const singleResult = data.results[0];
                if (singleResult.success) {
                    resultHtml += `
                        <h3>✅ Thành công!</h3>
                        <p><strong>Email:</strong> ${singleResult.email}</p>
                        <p><strong>Session ID:</strong> ${singleResult.sessionid}</p>
                    `;
                    
                    // Hiển thị thông tin workspace nếu có
                    if (singleResult.response && singleResult.response.data && singleResult.response.data.workspace_info) {
                        const workspace = singleResult.response.data.workspace_info;
                        resultHtml += `
                            <div class="workspace-info">
                                <h4>📊 Thông tin Workspace:</h4>
                                <p><strong>Tên:</strong> ${workspace.name}</p>
                                <p><strong>Vai trò:</strong> ${workspace.role}</p>
                                <p><strong>Người mời:</strong> ${workspace.caller_nickname}</p>
                                <p><strong>Giới hạn thành viên:</strong> <span style="color: #6c757d;">${workspace.member_limit || 'Không giới hạn'}</span></p>
                                <p><strong>Số thành viên hiện tại:</strong> <span style="color: #28a745; font-weight: bold;">${workspace.member_cnt || 'N/A'}</span></p>
                                ${workspace.team_vip_end ? `
                                    <p><strong>VIP kết thúc:</strong> <span style="color: #ff6b35; font-weight: bold;">${new Date(workspace.team_vip_end * 1000).toLocaleDateString('vi-VN')} ${new Date(workspace.team_vip_end * 1000).toLocaleTimeString('vi-VN')}</span></p>
                                ` : ''}
                                <p><strong>Khu vực:</strong> ${workspace.region || 'N/A'}</p>
                            </div>
                        `;
                    } else if (singleResult.response) {
                        // Xử lý lỗi
                        let message = '';
                        if (singleResult.response.ret === '2311' && singleResult.response.errmsg === 'ERR_REPEAT_ADD_WORKSPACE') {
                            message = '⚠️ Bạn đã tham gia workspace này rồi!';
                        } else if (singleResult.response.ret === '2310' && singleResult.response.errmsg === 'ERR_WORKSPACE_NOT_EXIST') {
                            message = '❌ Workspace không tồn tại!';
                        } else if (singleResult.response.ret === '2312' && singleResult.response.errmsg === 'ERR_WORKSPACE_FULL') {
                            message = '❌ Workspace đã đầy!';
                        } else if (singleResult.response.ret === '2313' && singleResult.response.errmsg === 'ERR_INVITE_LINK_EXPIRED') {
                            message = '❌ Link mời đã hết hạn!';
                        } else {
                            message = `❌ Lỗi: ${singleResult.response.errmsg || 'Không xác định'}`;
                        }
                        
                        resultHtml += `
                            <div class="error-info">
                                <h4>${message}</h4>
                            </div>
                        `;
                    }
                } else {
                    resultHtml += `
                        <h3>❌ Thất bại!</h3>
                        <p><strong>Email:</strong> ${singleResult.email}</p>
                        <p><strong>Lỗi:</strong> ${singleResult.error}</p>
                    `;
                }
            }
            
            result.innerHTML = resultHtml;
        } else {
            result.className = 'result error';
            result.innerHTML = `
                <h3>❌ Lỗi!</h3>
                <p>${data.error}</p>
            `;
        }
        
        result.style.display = 'block';
        
    } catch (error) {
        result.className = 'result error';
        result.innerHTML = `
            <h3>❌ Lỗi!</h3>
            <p>${error.message}</p>
        `;
        result.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        loading.style.display = 'none';
    }
});
