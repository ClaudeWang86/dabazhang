/**
 * 商品销售数据自动同步脚本
 *
 * 功能：从 yisbar.com API 获取商品销售数据并同步到 Supabase
 *
 * 使用方法（Node.js 环境）：
 *   node sync-products.js [开始日期] [结束日期]
 *   例如: node sync-products.js 2026-01-10 2026-01-11
 *
 * 使用方法（浏览器环境）：
 *   调用 syncProductSales(startDate, endDate) 函数
 */

// API 配置
const API_CONFIG = {
    baseUrl: 'https://www.yisbar.com',
    loginEndpoint: '/netbar/login/web/code',
    salesEndpoint: '/good/getOrderSalesByPage',
    account: 'tcdjhmd1',
    password: '147258',
    gid: 80014,  // 店铺 ID
    source: 6    // Web 端标识
};

// 检测是否使用代理（Vercel 部署时使用）
function useProxy() {
    if (typeof window === 'undefined') return false; // Node.js 环境直接调用
    // 在 Vercel 或非 localhost 环境使用代理
    return !window.location.hostname.includes('localhost') &&
           !window.location.hostname.includes('127.0.0.1');
}

// Supabase 配置 (浏览器环境使用 app.js 中的配置，Node.js 环境使用此处配置)
const SYNC_SUPABASE_URL = 'https://dfbgnrmigltjvlvdfcao.supabase.co';
const SYNC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmYmducm1pZ2x0anZsdmRmY2FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5NDAzMTQsImV4cCI6MjA1MDUxNjMxNH0.v8BLnqv0-RGO7s4qLnR0_k9Jp5qQhNMXeVl_MqrxfHQ';

// 获取 Supabase 配置（优先使用全局变量）
function getSupabaseConfig() {
    if (typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined') {
        return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
    }
    return { url: SYNC_SUPABASE_URL, key: SYNC_SUPABASE_ANON_KEY };
}

/**
 * 登录获取 Token
 */
async function login() {
    console.log('正在登录...');

    let data;

    if (useProxy()) {
        // 使用代理 API
        const response = await fetch('/api/sync-proxy?action=login');
        data = await response.json();
    } else {
        // 直接调用（本地开发或 Node.js）
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
        data = await response.json();
    }

    if (data.state !== 0 || !data.data?.token) {
        throw new Error(`登录失败: ${data.des || '未知错误'}`);
    }

    console.log('登录成功！Token 有效期至:', new Date(data.data.exp * 1000).toLocaleString());
    return data.data.token;
}

/**
 * 获取商品销售数据（单页）
 */
async function fetchSalesPage(token, startDate, endDate, page = 1, pageSize = 100) {
    let data;

    if (useProxy()) {
        // 使用代理 API（Vercel 环境）
        const proxyParams = new URLSearchParams({
            action: 'sales',
            token: token,
            startDate: startDate,
            endDate: endDate,
            page: page,
            pageSize: pageSize
        });
        const response = await fetch(`/api/sync-proxy?${proxyParams.toString()}`);
        data = await response.json();
    } else {
        // 直接调用（本地开发或 Node.js）
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

        data = await response.json();
    }

    if (data.state !== 0) {
        throw new Error(`获取数据失败: ${data.des || '未知错误'}`);
    }

    return data.data;
}

/**
 * 获取所有商品销售数据（自动分页）
 */
async function fetchAllSales(token, startDate, endDate) {
    console.log(`正在获取 ${startDate} 至 ${endDate} 的销售数据...`);

    const allOrders = [];
    let page = 1;
    const pageSize = 100;

    while (true) {
        const result = await fetchSalesPage(token, startDate, endDate, page, pageSize);
        allOrders.push(...result.list);

        console.log(`  已获取 ${allOrders.length}/${result.total} 条订单`);

        if (allOrders.length >= result.total) {
            break;
        }
        page++;
    }

    return allOrders;
}

/**
 * 转换订单数据为商品销售数据
 * 按商品名称聚合，计算总销量、总收入、总利润
 */
function transformOrdersToProducts(orders, saleDate) {
    const productMap = {};

    // 调试：打印第一个订单的原始数据结构
    if (orders.length > 0) {
        console.log('=== API 返回的订单数据示例 ===');
        console.log('订单:', JSON.stringify(orders[0], null, 2));
        if (orders[0].productList?.length > 0) {
            console.log('商品详情:', JSON.stringify(orders[0].productList[0], null, 2));
            const p = orders[0].productList[0];
            console.log('字段分析:');
            console.log('  - productName:', p.productName);
            console.log('  - price (售价):', p.price, '分 =', (p.price || 0) / 100, '元');
            console.log('  - inprice (进价):', p.inprice, '厘 =', (p.inprice || 0) / 1000, '元');
            console.log('  - len (数量):', p.len);
            console.log('  - 其他字段:', Object.keys(p).join(', '));
        }
        console.log('================================');
    }

    orders.forEach(order => {
        // 只处理已完成的订单 (state === 3)
        if (order.state !== 3) return;

        order.productList?.forEach(product => {
            const key = product.productName;

            if (!productMap[key]) {
                productMap[key] = {
                    store_name: '太初电竞',
                    product_name: product.productName,
                    category: getCategoryName(product.cateId),
                    product_type: '商品',
                    quantity: 0,
                    unit: '个',
                    total_cost: 0,
                    total_price: 0,
                    total_profit: 0,
                    sale_date: saleDate
                };
            }

            const qty = product.len || 1;
            const price = (product.price || 0) / 100;  // 分转元
            const cost = (product.inprice || 0) / 1000;  // 厘转元（inprice单位是厘）

            productMap[key].quantity += qty;
            productMap[key].total_price += price * qty;
            productMap[key].total_cost += cost * qty;
        });
    });

    // 计算利润
    Object.values(productMap).forEach(p => {
        p.total_profit = p.total_price - p.total_cost;
        // 保留两位小数
        p.total_price = Math.round(p.total_price * 100) / 100;
        p.total_cost = Math.round(p.total_cost * 100) / 100;
        p.total_profit = Math.round(p.total_profit * 100) / 100;
    });

    return Object.values(productMap);
}

/**
 * 根据分类 ID 获取分类名称
 */
function getCategoryName(cateId) {
    const categories = {
        101: '饮料',
        102: '饮料',
        103: '零食',
        104: '泡面',
        105: '其他'
    };
    return categories[cateId] || '其他';
}

/**
 * 保存数据到 Supabase
 */
async function saveToSupabase(products, saleDate) {
    console.log(`正在保存 ${products.length} 种商品到数据库 (${saleDate})...`);

    // 使用 Supabase REST API
    const config = getSupabaseConfig();
    const supabaseUrl = `${config.url}/rest/v1`;
    const headers = {
        'apikey': config.key,
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    };

    // 1. 删除该日期的旧数据
    await fetch(`${supabaseUrl}/product_sales?sale_date=eq.${saleDate}`, {
        method: 'DELETE',
        headers
    });

    // 2. 删除 product_dates 中的记录
    await fetch(`${supabaseUrl}/product_dates?date=eq.${saleDate}`, {
        method: 'DELETE',
        headers
    });

    // 3. 插入新数据（分批）
    const batchSize = 50;
    let uploaded = 0;

    for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);

        const response = await fetch(`${supabaseUrl}/product_sales`, {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=representation' },
            body: JSON.stringify(batch)
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`批次上传失败:`, error);
        } else {
            uploaded += batch.length;
        }
    }

    console.log(`  已上传 ${uploaded} 种商品`);
    return uploaded;
}

/**
 * 生成日期范围内的所有日期
 */
function generateDateRange(startDate, endDate) {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
    }

    return dates;
}

/**
 * 主同步函数
 */
async function syncProductSales(startDate, endDate) {
    console.log('========================================');
    console.log('商品销售数据同步');
    console.log(`日期范围: ${startDate} 至 ${endDate}`);
    console.log('========================================\n');

    try {
        // 1. 登录
        const token = await login();

        // 2. 生成日期列表
        const dates = generateDateRange(startDate, endDate);
        console.log(`\n将同步 ${dates.length} 天的数据\n`);

        let totalProducts = 0;

        // 3. 逐日同步
        for (const date of dates) {
            console.log(`\n--- 处理 ${date} ---`);

            // 获取当天数据
            const orders = await fetchAllSales(token, date, date);

            if (orders.length === 0) {
                console.log('  当天无订单数据');
                continue;
            }

            // 转换数据
            const products = transformOrdersToProducts(orders, date);
            console.log(`  转换得到 ${products.length} 种商品`);

            // 保存到数据库
            const saved = await saveToSupabase(products, date);
            totalProducts += saved;
        }

        console.log('\n========================================');
        console.log(`同步完成！共上传 ${totalProducts} 种商品`);
        console.log('========================================');

        return { success: true, total: totalProducts };

    } catch (error) {
        console.error('同步失败:', error.message);
        return { success: false, error: error.message };
    }
}

// =====================================================
// 上机数据同步功能
// =====================================================

/**
 * 将日期转换为 Unix 时间戳（北京时间）
 */
function dateToTimestamp(dateStr, isEndOfDay = false) {
    const date = new Date(dateStr + 'T00:00:00+08:00');
    if (isEndOfDay) {
        date.setHours(23, 59, 59, 999);
    }
    return Math.floor(date.getTime() / 1000);
}

/**
 * 将 Unix 时间戳转换为 ISO 日期时间字符串
 */
function timestampToISO(timestamp) {
    if (!timestamp) return null;
    return new Date(timestamp * 1000).toISOString();
}

/**
 * 将秒数转换为时长格式
 */
function formatDuration(seconds) {
    if (!seconds) return null;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}小时${minutes}分钟`;
}

/**
 * 获取上机记录数据（单页）
 */
async function fetchSessionsPage(token, startTime, endTime, page = 1, pageSize = 100) {
    let data;

    if (useProxy()) {
        // 使用代理 API（Vercel 环境）
        const proxyParams = new URLSearchParams({
            action: 'sessions',
            token: token,
            startTime: startTime,
            endTime: endTime,
            page: page,
            pageSize: pageSize
        });
        const response = await fetch(`/api/sync-proxy?${proxyParams.toString()}`);
        data = await response.json();
    } else {
        // 直接调用（本地开发或 Node.js）
        const params = new URLSearchParams({
            'gidList[0]': API_CONFIG.gid,
            'pageIndex': page,
            'pageSize': pageSize,
            'starttime': startTime,
            'endtime': endTime
        });

        const response = await fetch(`${API_CONFIG.baseUrl}/netbar/admin/netbarOnlineRecord/select?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Origin': 'https://admin.yisbar.com',
                'source': String(API_CONFIG.source),
                'token': token
            }
        });

        data = await response.json();
    }

    if (data.state !== 0) {
        throw new Error(`获取上机数据失败: ${data.des || '未知错误'}`);
    }

    return data.data;
}

/**
 * 获取所有上机记录数据（自动分页）
 */
async function fetchAllSessions(token, startTime, endTime) {
    console.log(`正在获取上机数据...`);

    const allRecords = [];
    let page = 1;
    const pageSize = 100;

    while (true) {
        const result = await fetchSessionsPage(token, startTime, endTime, page, pageSize);
        allRecords.push(...result.list);

        console.log(`  已获取 ${allRecords.length}/${result.total} 条记录`);

        if (allRecords.length >= result.total) {
            break;
        }
        page++;
    }

    return allRecords;
}

/**
 * 转换 API 记录为 sessions 表格式
 */
function transformSessionRecords(records) {
    return records
        .filter(r => r.state === 3) // 只处理已完成的记录
        .map(r => ({
            card_type: null,
            card_id: String(r.account || ''),
            name: r.membername || null,
            session_type: null,
            session_detail: r.periodname || null,
            area: r.areaname || null,
            machine: r.machinename || null,
            deposit_deducted: (r.tempbalance || 0) / 100,
            principal_deducted: (r.basebalance || 0) / 100,
            bonus_deducted: (r.awardbalance || 0) / 100,
            bonus_to_balance: 0,
            principal_balance: (r.basereserve || 0) / 100,
            payment_method: getPaymentMethod(r.payway),
            start_time: timestampToISO(r.onlinestarttime),
            end_time: timestampToISO(r.offlinetime),
            duration: formatDuration(r.internettime),
            store: '太初电竞'
        }))
        .filter(r => r.card_id && r.start_time);
}

/**
 * 根据支付方式代码获取名称
 */
function getPaymentMethod(payway) {
    const methods = {
        1: '现金',
        2: '会员卡',
        3: '微信',
        4: '支付宝',
        5: '临时卡',
        6: '储值卡'
    };
    return methods[payway] || '其他';
}

/**
 * 保存上机数据到 Supabase（使用 upsert 去重）
 */
async function saveSessionsToSupabase(sessions, sessionDate) {
    console.log(`正在保存 ${sessions.length} 条上机记录到数据库 (${sessionDate})...`);

    const config = getSupabaseConfig();
    const supabaseUrl = `${config.url}/rest/v1`;
    const headers = {
        'apikey': config.key,
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
    };

    // 分批上传
    const batchSize = 50;
    let uploaded = 0;

    for (let i = 0; i < sessions.length; i += batchSize) {
        const batch = sessions.slice(i, i + batchSize);

        const response = await fetch(`${supabaseUrl}/sessions`, {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=representation,resolution=merge-duplicates' },
            body: JSON.stringify(batch)
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`批次上传失败:`, error);
        } else {
            uploaded += batch.length;
        }
    }

    // 更新 session_dates 表
    const totalRevenue = sessions.reduce((sum, s) =>
        sum + (s.deposit_deducted || 0) + (s.principal_deducted || 0) + (s.bonus_deducted || 0), 0);

    await fetch(`${supabaseUrl}/session_dates`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({
            date: sessionDate,
            record_count: sessions.length,
            total_revenue: Math.round(totalRevenue * 100) / 100
        })
    });

    console.log(`  已上传 ${uploaded} 条记录`);
    return uploaded;
}

/**
 * 主同步函数 - 上机数据
 */
async function syncSessionRecords(startDate, endDate) {
    console.log('========================================');
    console.log('上机数据同步');
    console.log(`日期范围: ${startDate} 至 ${endDate}`);
    console.log('========================================\n');

    try {
        // 1. 登录
        const token = await login();

        // 2. 生成日期列表
        const dates = generateDateRange(startDate, endDate);
        console.log(`\n将同步 ${dates.length} 天的数据\n`);

        let totalRecords = 0;

        // 3. 逐日同步
        for (const date of dates) {
            console.log(`\n--- 处理 ${date} ---`);

            // 计算时间戳
            const startTime = dateToTimestamp(date, false);
            const endTime = dateToTimestamp(date, true);

            // 获取当天数据
            const records = await fetchAllSessions(token, startTime, endTime);

            if (records.length === 0) {
                console.log('  当天无上机数据');
                continue;
            }

            // 转换数据
            const sessions = transformSessionRecords(records);
            console.log(`  转换得到 ${sessions.length} 条有效记录`);

            // 保存到数据库
            const saved = await saveSessionsToSupabase(sessions, date);
            totalRecords += saved;
        }

        console.log('\n========================================');
        console.log(`同步完成！共上传 ${totalRecords} 条上机记录`);
        console.log('========================================');

        return { success: true, total: totalRecords };

    } catch (error) {
        console.error('同步失败:', error.message);
        return { success: false, error: error.message };
    }
}

// =====================================================
// 充值记录同步功能
// =====================================================

/**
 * 获取充值记录数据（单页）
 */
async function fetchRechargesPage(token, startTime, endTime, page = 1, pageSize = 100) {
    let data;

    if (useProxy()) {
        // 使用代理 API（Vercel 环境）
        const proxyParams = new URLSearchParams({
            action: 'recharges',
            token: token,
            startTime: startTime,
            endTime: endTime,
            page: page,
            pageSize: pageSize
        });
        const response = await fetch(`/api/sync-proxy?${proxyParams.toString()}`);
        data = await response.json();
    } else {
        // 直接调用（本地开发或 Node.js）
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

        const response = await fetch(`${API_CONFIG.baseUrl}/netbar/admin/netbarOrder/select?${params.toString()}`, {
            headers: {
                'Accept': 'application/json',
                'Origin': 'https://admin.yisbar.com',
                'Referer': 'https://admin.yisbar.com/',
                'source': String(API_CONFIG.source),
                'token': token
            }
        });
        data = await response.json();
    }

    if (data.state !== 0) {
        throw new Error(`获取充值记录失败: ${data.des || '未知错误'}`);
    }

    return {
        records: data.data?.list || [],
        total: data.data?.total || 0
    };
}

/**
 * 获取所有充值记录（自动分页）
 */
async function fetchAllRecharges(token, startTime, endTime) {
    const pageSize = 100;
    let page = 1;
    let allRecords = [];
    let hasMore = true;

    while (hasMore) {
        const result = await fetchRechargesPage(token, startTime, endTime, page, pageSize);
        allRecords = allRecords.concat(result.records);

        console.log(`  充值记录第 ${page} 页: 获取 ${result.records.length} 条 (总计: ${allRecords.length}/${result.total})`);

        hasMore = allRecords.length < result.total;
        page++;
    }

    return allRecords;
}

/**
 * 转换 API 记录为 recharges 表格式
 */
function transformRechargeRecords(records) {
    // 调试：打印第一条原始记录的所有字段
    if (records.length > 0) {
        console.log('原始充值记录字段:', Object.keys(records[0]));
        console.log('原始充值记录示例:', JSON.stringify(records[0], null, 2));
    }

    const transformed = records
        .map(r => {
            // 尝试多种可能的字段名
            const orderId = r.orderid || r.orderId || r.id || r.orderCode || '';
            const createTime = r.createtime || r.createTime || r.addtime || r.ordertime || r.orderTime;

            return {
                order_id: String(orderId),
                account: String(r.account || r.memberaccount || r.memberAccount || ''),
                member_name: r.membername || r.memberName || r.nickname || null,
                order_fee: (r.orderfee || r.orderFee || r.ordermoney || r.orderMoney || r.money || 0) / 100,
                pay_fee: (r.payfee || r.payFee || r.paymoney || r.payMoney || 0) / 100,
                gift_fee: (r.giftfee || r.giftFee || r.giftmoney || r.giftMoney || r.gift || 0) / 100,
                pay_type: getPayType(r.paytype || r.payType || r.payway || r.payWay),
                pay_channel: getPayChannel(r.paychannel || r.payChannel),
                order_status: r.orderstatus ?? r.orderStatus ?? r.status ?? 1,
                create_time: timestampToISO(createTime),
                pay_time: timestampToISO(r.paytime || r.payTime || r.successtime),
                store: '太初电竞'
            };
        })
        .filter(r => r.order_id);  // 只要有订单号就保留

    console.log(`转换结果: ${records.length} 条原始记录 -> ${transformed.length} 条有效记录`);
    if (transformed.length > 0) {
        console.log('转换后记录示例:', JSON.stringify(transformed[0], null, 2));
    } else if (records.length > 0) {
        console.log('转换失败！原始记录有数据但转换后为空');
    }

    return transformed;
}

/**
 * 根据支付类型代码获取名称
 */
function getPayType(paytype) {
    const types = {
        1: '微信',
        2: '支付宝',
        3: '现金',
        4: '其他'
    };
    return types[paytype] || '其他';
}

/**
 * 根据支付渠道代码获取名称
 */
function getPayChannel(paychannel) {
    const channels = {
        1: '扫码支付',
        2: 'APP支付',
        3: '小程序',
        4: '公众号',
        5: '现金'
    };
    return channels[paychannel] || '其他';
}

/**
 * 保存充值记录到 Supabase（使用 upsert 去重）
 */
async function saveRechargesToSupabase(recharges, rechargeDate) {
    console.log(`正在保存 ${recharges.length} 条充值记录到数据库 (${rechargeDate})...`);

    if (recharges.length === 0) {
        console.log('没有需要保存的充值记录');
        return 0;
    }

    const config = getSupabaseConfig();
    const supabaseUrl = `${config.url}/rest/v1`;
    const headers = {
        'apikey': config.key,
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
    };

    console.log('Supabase URL:', supabaseUrl);

    // 分批上传
    const batchSize = 50;
    let uploaded = 0;

    for (let i = 0; i < recharges.length; i += batchSize) {
        const batch = recharges.slice(i, i + batchSize);
        console.log(`上传批次 ${Math.floor(i / batchSize) + 1}: ${batch.length} 条记录`);

        try {
            const response = await fetch(`${supabaseUrl}/recharges`, {
                method: 'POST',
                headers: { ...headers, 'Prefer': 'return=representation,resolution=merge-duplicates' },
                body: JSON.stringify(batch)
            });

            const responseText = await response.text();

            if (!response.ok) {
                console.error(`批次上传失败 (HTTP ${response.status}):`, responseText);
            } else {
                uploaded += batch.length;
                console.log(`批次上传成功: ${batch.length} 条`);
            }
        } catch (err) {
            console.error('上传请求失败:', err.message);
        }
    }

    // 更新 recharge_dates 表
    const totalAmount = recharges.reduce((sum, r) => sum + (r.order_fee || 0), 0);
    const totalGift = recharges.reduce((sum, r) => sum + (r.gift_fee || 0), 0);

    await fetch(`${supabaseUrl}/recharge_dates`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({
            date: rechargeDate,
            record_count: recharges.length,
            total_amount: Math.round(totalAmount * 100) / 100,
            total_gift: Math.round(totalGift * 100) / 100
        })
    });

    console.log(`  已上传 ${uploaded} 条充值记录`);
    return uploaded;
}

/**
 * 主同步函数 - 充值记录
 */
async function syncRechargeRecords(startDate, endDate) {
    console.log('========================================');
    console.log('充值记录同步');
    console.log(`日期范围: ${startDate} 至 ${endDate}`);
    console.log('========================================\n');

    try {
        // 1. 登录
        const token = await login();

        // 2. 生成日期列表
        const dates = generateDateRange(startDate, endDate);
        console.log(`\n将同步 ${dates.length} 天的数据\n`);

        let totalRecords = 0;

        // 3. 逐日同步
        for (const date of dates) {
            console.log(`\n--- 处理 ${date} ---`);

            // 计算时间戳
            const startTime = dateToTimestamp(date, false);
            const endTime = dateToTimestamp(date, true);

            // 获取当天数据
            const records = await fetchAllRecharges(token, startTime, endTime);

            if (records.length === 0) {
                console.log('  当天无充值记录');
                continue;
            }

            // 转换数据
            const recharges = transformRechargeRecords(records);
            console.log(`  转换得到 ${recharges.length} 条有效记录`);

            // 保存到数据库
            const saved = await saveRechargesToSupabase(recharges, date);
            totalRecords += saved;
        }

        console.log('\n========================================');
        console.log(`同步完成！共上传 ${totalRecords} 条充值记录`);
        console.log('========================================');

        return { success: true, total: totalRecords };

    } catch (error) {
        console.error('同步失败:', error.message);
        return { success: false, error: error.message };
    }
}

// 导出供浏览器使用
if (typeof window !== 'undefined') {
    window.syncProductSales = syncProductSales;
    window.API_CONFIG = API_CONFIG;
    // 导出单独的函数供 UI 调用
    window.login = login;
    window.fetchAllSales = fetchAllSales;
    window.transformOrdersToProducts = transformOrdersToProducts;
    window.saveToSupabase = saveToSupabase;
    window.generateDateRange = generateDateRange;
    // 上机数据同步函数
    window.fetchAllSessions = fetchAllSessions;
    window.transformSessionRecords = transformSessionRecords;
    window.saveSessionsToSupabase = saveSessionsToSupabase;
    window.syncSessionRecords = syncSessionRecords;
    window.dateToTimestamp = dateToTimestamp;
    // 充值记录同步函数
    window.fetchAllRecharges = fetchAllRecharges;
    window.transformRechargeRecords = transformRechargeRecords;
    window.saveRechargesToSupabase = saveRechargesToSupabase;
    window.syncRechargeRecords = syncRechargeRecords;
}

// Node.js 命令行执行
if (typeof process !== 'undefined' && process.argv) {
    const args = process.argv.slice(2);
    if (args.length >= 2) {
        syncProductSales(args[0], args[1]);
    } else if (args.length === 1) {
        // 单日同步
        syncProductSales(args[0], args[0]);
    } else {
        // 默认同步今天
        const today = new Date().toISOString().split('T')[0];
        console.log(`使用方法: node sync-products.js [开始日期] [结束日期]`);
        console.log(`例如: node sync-products.js 2026-01-10 2026-01-11`);
        console.log(`\n默认同步今天 (${today})...`);
        syncProductSales(today, today);
    }
}
