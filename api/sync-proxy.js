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
            // 获取充值记录数据 - 使用与 yisbar 后台相同的过滤参数
            const { startTime, endTime } = req.query;
            if (!token || !startTime || !endTime) {
                return res.status(400).json({ error: 'Missing token or time parameters' });
            }

            // 支付方式列表
            const orderPayWayList = [1, 2, 3, 4];
            // 订单类型列表 (排除不需要的类型)
            const orderTypeList = [29, 30, 3, 32, 33, 34, 35, 36, 37, 31, 22, 26, 1, 2, 4, 10, 12, 16, 17, 18, 19, 23, 24, 25, 27, 28, 38];
            // 订单状态列表: 2=待支付, 3=已完成, 4=全额退款, 9=部分退款
            const orderStateList = [2, 3, 4, 9];

            const params = new URLSearchParams({
                'timeType': '0',
                'gidList[0]': API_CONFIG.gid,
                'pageIndex': page,
                'pageSize': pageSize,
                'starttime': startTime,
                'endtime': endTime,
                'account': '',
                'membername': '',
                'orderid': ''
            });

            // 添加支付方式列表
            orderPayWayList.forEach((way, i) => {
                params.append(`orderPayWayList[${i}]`, way);
            });

            // 添加订单类型列表
            orderTypeList.forEach((type, i) => {
                params.append(`orderTypeList[${i}]`, type);
            });

            // 添加订单状态列表
            orderStateList.forEach((state, i) => {
                params.append(`orderStateList[${i}]`, state);
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

        } else if (action === 'orders') {
            // 获取订单数据（营收/退货）
            const { startTime, endTime, category } = req.query;
            if (!token || !startTime || !endTime || !category) {
                return res.status(400).json({ error: 'Missing token, time or category parameters' });
            }

            // 订单类型配置
            const ORDER_CONFIG = {
                revenue: {
                    orderTypeList: [1, 2, 4, 10, 12, 16, 17, 18, 19, 23, 24, 25, 27, 28, 38],
                    orderStateList: [2, 3, 4, 9],
                    orderPayWayList: [1, 2, 3, 4]
                },
                refund: {
                    orderTypeList: [29, 30, 3, 32, 33, 34, 35, 36, 37, 31, 22, 26],
                    orderStateList: [3],
                    orderPayWayList: [1, 2, 3, 4]
                }
            };

            const config = ORDER_CONFIG[category];
            if (!config) {
                return res.status(400).json({ error: `Invalid category: ${category}` });
            }

            const params = new URLSearchParams({
                'timeType': '0',
                'gidList[0]': API_CONFIG.gid,
                'pageIndex': page,
                'pageSize': pageSize,
                'starttime': startTime,
                'endtime': endTime,
                'account': '',
                'membername': '',
                'orderid': ''
            });

            // 添加支付方式列表
            config.orderPayWayList.forEach((way, i) => {
                params.append(`orderPayWayList[${i}]`, way);
            });

            // 添加订单类型列表
            config.orderTypeList.forEach((type, i) => {
                params.append(`orderTypeList[${i}]`, type);
            });

            // 添加订单状态列表
            config.orderStateList.forEach((state, i) => {
                params.append(`orderStateList[${i}]`, state);
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
