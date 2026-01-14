/**
 * Vercel Serverless Function - API 代理
 * 用于绕过浏览器 CORS 限制
 */

const API_CONFIG = {
    baseUrl: 'https://www.yisbar.com',
    loginEndpoint: '/netbar/login/web/code',
    salesEndpoint: '/good/getOrderSalesByPage',
    sessionsEndpoint: '/netbar/admin/netbarOnlineRecord/select',
    rechargesEndpoint: '/netbar/admin/netbarOrder/select',
    account: 'tcdjhmd1',
    password: '147258',
    gid: 80014,
    source: 6
};

export default async function handler(req, res) {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action, token, page = 1, pageSize = 100 } = req.query;

    try {
        if (action === 'login') {
            // 登录获取 Token
            const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.loginEndpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                    'Origin': 'https://admin.yisbar.com',
                    'source': String(API_CONFIG.source)
                },
                body: `account=${API_CONFIG.account}&password=${API_CONFIG.password}&verifycode=`
            });

            const data = await response.json();
            return res.status(200).json(data);

        } else if (action === 'sales') {
            // 获取销售数据
            const { startDate, endDate } = req.query;
            if (!token || (!startDate && !endDate)) {
                return res.status(400).json({ error: 'Missing token or date parameters' });
            }

            const params = new URLSearchParams({
                'gids[0]': API_CONFIG.gid,
                'orderId': '',
                'curPage': page,
                'pageSize': pageSize,
                'beginTime': `${startDate} 00:00:00`,
                'endTime': `${endDate} 23:59:59`
            });

            const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.salesEndpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                    'Origin': 'https://admin.yisbar.com',
                    'source': String(API_CONFIG.source),
                    'token': token
                },
                body: params.toString()
            });

            const data = await response.json();
            return res.status(200).json(data);

        } else if (action === 'sessions') {
            // 获取上机记录数据
            const { startTime, endTime } = req.query;
            if (!token || !startTime || !endTime) {
                return res.status(400).json({ error: 'Missing token or time parameters' });
            }

            const params = new URLSearchParams({
                'gidList[0]': API_CONFIG.gid,
                'pageIndex': page,
                'pageSize': pageSize,
                'starttime': startTime,
                'endtime': endTime
            });

            const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.sessionsEndpoint}?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Origin': 'https://admin.yisbar.com',
                    'source': String(API_CONFIG.source),
                    'token': token
                }
            });

            const data = await response.json();
            return res.status(200).json(data);

        } else if (action === 'recharges') {
            // 获取充值记录数据
            const { startTime, endTime } = req.query;
            if (!token || !startTime || !endTime) {
                return res.status(400).json({ error: 'Missing token or time parameters' });
            }

            const params = new URLSearchParams({
                'timeType': '1',
                'gidList[0]': API_CONFIG.gid,
                'pageIndex': page,
                'pageSize': pageSize,
                'starttime': startTime,
                'endtime': endTime,
                'account': '',
                'membername': '',
                'orderid': ''
            });

            const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.rechargesEndpoint}?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Origin': 'https://admin.yisbar.com',
                    'Referer': 'https://admin.yisbar.com/',
                    'source': String(API_CONFIG.source),
                    'token': token
                }
            });

            const data = await response.json();
            return res.status(200).json(data);

        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }

    } catch (error) {
        console.error('Proxy error:', error);
        return res.status(500).json({ error: error.message });
    }
}
