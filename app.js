// Supabase 配置
const SUPABASE_URL = 'https://dfbgnrmigltjvlvdfcao.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmYmducm1pZ2x0anZsdmRmY2FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjY4MjksImV4cCI6MjA4MzY0MjgyOX0.mEm3-VwB4NaebrW2u8IQrrJNg7RvZqElCmmwY_Ge-3c';

// 初始化 Supabase 客户端
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 全局数据存储
let rawData = [];
let processedData = {};
let pendingUploadData = []; // 待上传的数据

// DOM 元素
const fileInput = document.getElementById('fileInput');
const uploadBox = document.getElementById('uploadBox');
const fileInfo = document.getElementById('fileInfo');
const statsOverview = document.getElementById('statsOverview');
const chartsSection = document.getElementById('chartsSection');
const dbStatus = document.getElementById('dbStatus');
const dbInfo = document.getElementById('dbInfo');

// 图表实例
let charts = {};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    setupTabs();
    setupFileUpload();
    setupDragDrop();
    setupButtons();
    setDefaultDates();
    window.addEventListener('resize', handleResize);

    // 测试数据库连接
    await testConnection();
});

// 测试数据库连接
async function testConnection() {
    try {
        const { count, error } = await db
            .from('sessions')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;

        dbStatus.classList.add('connected');
        dbStatus.querySelector('.status-text').textContent = `已连接 (${count || 0} 条记录)`;

        // 如果有数据，自动加载
        if (count > 0) {
            showDbInfo(`数据库中有 ${count} 条记录，点击"加载全部"查看`, 'success');
        } else {
            showDbInfo('数据库为空，请上传数据', '');
        }
    } catch (err) {
        console.error('连接失败:', err);
        dbStatus.classList.add('error');
        dbStatus.querySelector('.status-text').textContent = '连接失败';
        showDbInfo(`连接错误: ${err.message}`, 'error');
    }
}

// 设置标签页切换
function setupTabs() {
    const tabDatabase = document.getElementById('tabDatabase');
    const tabUpload = document.getElementById('tabUpload');
    const databasePanel = document.getElementById('databasePanel');
    const uploadPanel = document.getElementById('uploadPanel');

    tabDatabase.addEventListener('click', () => {
        tabDatabase.classList.add('active');
        tabUpload.classList.remove('active');
        databasePanel.classList.remove('hidden');
        uploadPanel.classList.add('hidden');
    });

    tabUpload.addEventListener('click', () => {
        tabUpload.classList.add('active');
        tabDatabase.classList.remove('active');
        uploadPanel.classList.remove('hidden');
        databasePanel.classList.add('hidden');
    });
}

// 设置默认日期（最近30天）
function setDefaultDates() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    document.getElementById('startDate').value = formatDateForInput(startDate);
    document.getElementById('endDate').value = formatDateForInput(endDate);
}

function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
}

// 设置按钮事件
function setupButtons() {
    // 加载数据按钮
    document.getElementById('loadDataBtn').addEventListener('click', loadDataByDateRange);
    document.getElementById('loadAllBtn').addEventListener('click', loadAllData);

    // 上传按钮
    document.getElementById('saveToDbBtn').addEventListener('click', saveToDatabase);
    document.getElementById('previewOnlyBtn').addEventListener('click', previewOnly);
}

// 按日期范围加载数据
async function loadDataByDateRange() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!startDate || !endDate) {
        showDbInfo('请选择日期范围', 'error');
        return;
    }

    showDbInfo('正在加载数据...', '');

    try {
        const { data, error } = await db
            .from('sessions')
            .select('*')
            .gte('start_time', startDate + 'T00:00:00')
            .lte('start_time', endDate + 'T23:59:59')
            .order('start_time', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            showDbInfo('该日期范围内没有数据', 'error');
            return;
        }

        rawData = convertFromDb(data);
        showDbInfo(`已加载 ${data.length} 条记录`, 'success');
        processData();
        renderDashboard();
    } catch (err) {
        showDbInfo(`加载失败: ${err.message}`, 'error');
    }
}

// 加载全部数据
async function loadAllData() {
    showDbInfo('正在加载全部数据...', '');

    try {
        const { data, error } = await db
            .from('sessions')
            .select('*')
            .order('start_time', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            showDbInfo('数据库中没有数据，请先上传', 'error');
            return;
        }

        rawData = convertFromDb(data);
        showDbInfo(`已加载全部 ${data.length} 条记录`, 'success');
        processData();
        renderDashboard();
    } catch (err) {
        showDbInfo(`加载失败: ${err.message}`, 'error');
    }
}

// 将数据库记录转换为前端格式
function convertFromDb(dbRecords) {
    return dbRecords.map(r => ({
        '卡类型': r.card_type,
        '卡号': r.card_id,
        '姓名': r.name,
        '上机类型': r.session_type,
        '上机详情': r.session_detail,
        '区域': r.area,
        '机器': r.machine,
        '扣除押金': r.deposit_deducted,
        '扣除本金': r.principal_deducted,
        '扣除赠送': r.bonus_deducted,
        '赠送进余额': r.bonus_to_balance,
        '本金余额': r.principal_balance,
        '结账方式': r.payment_method,
        '上机时间': r.start_time,
        '下机时间': r.end_time,
        '上机时间.1': r.duration,
        '门店': r.store,
        startTime: new Date(r.start_time),
        endTime: r.end_time ? new Date(r.end_time) : null
    }));
}

// 显示数据库信息
function showDbInfo(message, type) {
    dbInfo.textContent = message;
    dbInfo.className = 'db-info';
    if (type) {
        dbInfo.classList.add(type);
    }
}

// 设置文件上传
function setupFileUpload() {
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFile(file);
        }
    });
}

// 设置拖拽上传
function setupDragDrop() {
    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.classList.add('dragover');
    });

    uploadBox.addEventListener('dragleave', () => {
        uploadBox.classList.remove('dragover');
    });

    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) {
            handleFile(file);
        }
    });
}

// 处理文件
function handleFile(file) {
    if (!file.name.match(/\.(xls|xlsx)$/i)) {
        alert('请上传 Excel 文件 (.xls 或 .xlsx)');
        return;
    }

    fileInfo.innerHTML = `📄 已选择: <strong>${file.name}</strong> (${formatFileSize(file.size)})`;
    fileInfo.classList.remove('hidden');

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // 转换数据格式
        pendingUploadData = convertExcelToDbFormat(jsonData);

        fileInfo.innerHTML = `📄 <strong>${file.name}</strong> - 解析到 ${pendingUploadData.length} 条记录`;

        // 显示操作按钮
        document.getElementById('uploadActions').classList.remove('hidden');
    };
    reader.readAsArrayBuffer(file);
}

// 将 Excel 数据转换为数据库格式
function convertExcelToDbFormat(excelData) {
    return excelData.map(row => {
        const startTime = parseExcelDate(row['上机时间']);
        const endTime = parseExcelDate(row['下机时间']);

        return {
            card_type: row['卡类型'] || null,
            card_id: String(row['卡号'] || ''),
            name: row['姓名'] || null,
            session_type: row['上机类型'] || null,
            session_detail: row['上机详情'] || null,
            area: row['区域'] || null,
            machine: row['机器'] || null,
            deposit_deducted: parseFloat(row['扣除押金']) || 0,
            principal_deducted: parseFloat(row['扣除本金']) || 0,
            bonus_deducted: parseFloat(row['扣除赠送']) || 0,
            bonus_to_balance: parseFloat(row['赠送进余额']) || 0,
            principal_balance: parseFloat(row['本金余额']) || 0,
            payment_method: row['结账方式'] || null,
            start_time: startTime ? startTime.toISOString() : null,
            end_time: endTime ? endTime.toISOString() : null,
            duration: row['上机时间.1'] || null,
            store: row['门店'] || null
        };
    }).filter(r => r.card_id && r.start_time); // 过滤无效记录
}

// 解析 Excel 日期
function parseExcelDate(value) {
    if (!value) return null;

    // 如果是 Excel 序列号
    if (typeof value === 'number') {
        const date = new Date((value - 25569) * 86400 * 1000);
        return date;
    }

    // 如果是字符串
    if (typeof value === 'string') {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
            return d;
        }
    }

    return null;
}

// 保存到数据库
async function saveToDatabase() {
    if (pendingUploadData.length === 0) {
        alert('没有可上传的数据');
        return;
    }

    const progressDiv = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    progressDiv.classList.remove('hidden');
    document.getElementById('saveToDbBtn').disabled = true;

    const batchSize = 100;
    const totalBatches = Math.ceil(pendingUploadData.length / batchSize);
    let uploaded = 0;
    let skipped = 0;
    let errors = 0;

    progressText.textContent = `准备上传 ${pendingUploadData.length} 条记录...`;

    for (let i = 0; i < totalBatches; i++) {
        const batch = pendingUploadData.slice(i * batchSize, (i + 1) * batchSize);

        try {
            // 使用 upsert，遇到重复的 card_id + start_time 会跳过
            const { data, error } = await db
                .from('sessions')
                .upsert(batch, {
                    onConflict: 'card_id,start_time',
                    ignoreDuplicates: true
                })
                .select();

            if (error) {
                console.error('批次上传错误:', error);
                errors += batch.length;
            } else {
                uploaded += data ? data.length : 0;
                skipped += batch.length - (data ? data.length : 0);
            }
        } catch (err) {
            console.error('上传异常:', err);
            errors += batch.length;
        }

        // 更新进度
        const progress = ((i + 1) / totalBatches) * 100;
        progressFill.style.width = progress + '%';
        progressText.textContent = `上传中... ${i + 1}/${totalBatches} 批次`;
    }

    // 完成
    progressFill.style.width = '100%';
    progressText.textContent = `上传完成！新增 ${uploaded} 条，跳过重复 ${skipped} 条${errors > 0 ? `，失败 ${errors} 条` : ''}`;

    document.getElementById('saveToDbBtn').disabled = false;

    // 刷新数据库状态
    await testConnection();

    // 3秒后隐藏进度条
    setTimeout(() => {
        progressDiv.classList.add('hidden');
        progressFill.style.width = '0%';
    }, 3000);
}

// 仅预览不保存
function previewOnly() {
    if (pendingUploadData.length === 0) {
        alert('没有可预览的数据');
        return;
    }

    // 将待上传数据转换为前端格式并显示
    rawData = pendingUploadData.map(r => ({
        '卡类型': r.card_type,
        '卡号': r.card_id,
        '姓名': r.name,
        '上机类型': r.session_type,
        '上机详情': r.session_detail,
        '区域': r.area,
        '机器': r.machine,
        '扣除押金': r.deposit_deducted,
        '扣除本金': r.principal_deducted,
        '扣除赠送': r.bonus_deducted,
        '赠送进余额': r.bonus_to_balance,
        '本金余额': r.principal_balance,
        '结账方式': r.payment_method,
        '上机时间': r.start_time,
        '下机时间': r.end_time,
        '上机时间.1': r.duration,
        '门店': r.store,
        startTime: r.start_time ? new Date(r.start_time) : null,
        endTime: r.end_time ? new Date(r.end_time) : null
    }));

    processData();
    renderDashboard();
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// 处理数据
function processData() {
    // 解析日期时间
    rawData.forEach(row => {
        // 处理日期
        if (row['上机时间'] && !row.startTime) {
            row.startTime = parseExcelDate(row['上机时间']);
        }
        if (row['下机时间'] && !row.endTime) {
            row.endTime = parseExcelDate(row['下机时间']);
        }

        // 从身份证提取年龄
        if (row['卡号']) {
            const idCard = String(row['卡号']);
            if (idCard.length >= 14) {
                const birthYear = parseInt(idCard.substring(6, 10));
                row.age = 2025 - birthYear;
            }
        }
    });

    // 计算统计数据
    processedData = {
        totalRecords: rawData.length,
        totalRevenue: rawData.reduce((sum, r) => sum + (parseFloat(r['扣除本金']) || 0) + (parseFloat(r['扣除赠送']) || 0), 0),
        totalPrincipal: rawData.reduce((sum, r) => sum + (parseFloat(r['扣除本金']) || 0), 0),
        totalBonus: rawData.reduce((sum, r) => sum + (parseFloat(r['扣除赠送']) || 0), 0),
        dateRange: getDateRange(),
        avgSpend: 0,

        // 分组统计
        byDate: groupByDate(),
        byHour: groupByHour(),
        byWeekday: groupByWeekday(),
        byMemberType: groupBy('卡类型'),
        byArea: groupBy('区域'),
        byPaymentMethod: groupBy('结账方式'),
        byPackageType: groupBy('上机类型'),
        byPackageDetail: groupBy('上机详情'),
        byAge: groupByAge(),
        heatmapData: generateHeatmapData(),
        topUsers: getTopUsers()
    };

    processedData.avgSpend = processedData.totalRevenue / processedData.totalRecords;
}

// 获取日期范围
function getDateRange() {
    const dates = rawData
        .filter(r => r.startTime)
        .map(r => r.startTime);

    if (dates.length === 0) return { start: null, end: null };

    return {
        start: new Date(Math.min(...dates)),
        end: new Date(Math.max(...dates))
    };
}

// 按日期分组
function groupByDate() {
    const groups = {};

    rawData.forEach(row => {
        if (!row.startTime) return;
        const dateStr = formatDate(row.startTime);

        if (!groups[dateStr]) {
            groups[dateStr] = { count: 0, revenue: 0, principal: 0, bonus: 0 };
        }

        groups[dateStr].count++;
        groups[dateStr].revenue += (parseFloat(row['扣除本金']) || 0) + (parseFloat(row['扣除赠送']) || 0);
        groups[dateStr].principal += parseFloat(row['扣除本金']) || 0;
        groups[dateStr].bonus += parseFloat(row['扣除赠送']) || 0;
    });

    return groups;
}

// 按小时分组
function groupByHour() {
    const hours = Array(24).fill(0);

    rawData.forEach(row => {
        if (row.startTime) {
            const hour = row.startTime.getHours();
            hours[hour]++;
        }
    });

    return hours;
}

// 按星期分组
function groupByWeekday() {
    const weekdays = Array(7).fill(0);

    rawData.forEach(row => {
        if (row.startTime) {
            const day = row.startTime.getDay();
            weekdays[day]++;
        }
    });

    return weekdays;
}

// 通用分组
function groupBy(field) {
    const groups = {};

    rawData.forEach(row => {
        const key = row[field] || '未知';
        if (!groups[key]) {
            groups[key] = { count: 0, revenue: 0 };
        }
        groups[key].count++;
        groups[key].revenue += (parseFloat(row['扣除本金']) || 0) + (parseFloat(row['扣除赠送']) || 0);
    });

    return groups;
}

// 按年龄分组
function groupByAge() {
    const ageGroups = {
        '18岁以下': 0,
        '18-22岁': 0,
        '22-25岁': 0,
        '25-30岁': 0,
        '30-40岁': 0,
        '40岁以上': 0
    };

    rawData.forEach(row => {
        const age = row.age;
        if (!age) return;

        if (age < 18) ageGroups['18岁以下']++;
        else if (age < 22) ageGroups['18-22岁']++;
        else if (age < 25) ageGroups['22-25岁']++;
        else if (age < 30) ageGroups['25-30岁']++;
        else if (age < 40) ageGroups['30-40岁']++;
        else ageGroups['40岁以上']++;
    });

    return ageGroups;
}

// 生成热力图数据
function generateHeatmapData() {
    const data = [];
    const matrix = Array(7).fill(null).map(() => Array(24).fill(0));

    rawData.forEach(row => {
        if (row.startTime) {
            const day = row.startTime.getDay();
            const hour = row.startTime.getHours();
            matrix[day][hour]++;
        }
    });

    for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
            data.push([hour, day, matrix[day][hour]]);
        }
    }

    return data;
}

// 获取高频用户
function getTopUsers() {
    const users = {};

    rawData.forEach(row => {
        const name = row['姓名'];
        if (!name) return;

        if (!users[name]) {
            users[name] = { count: 0, revenue: 0 };
        }
        users[name].count++;
        users[name].revenue += (parseFloat(row['扣除本金']) || 0) + (parseFloat(row['扣除赠送']) || 0);
    });

    return Object.entries(users)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
}

// 格式化日期
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// 渲染仪表盘
function renderDashboard() {
    // 显示统计卡片
    statsOverview.classList.remove('hidden');
    chartsSection.classList.remove('hidden');

    // 更新统计数字
    document.getElementById('totalRecords').textContent = processedData.totalRecords.toLocaleString();
    document.getElementById('totalRevenue').textContent = '¥' + processedData.totalRevenue.toFixed(2);
    document.getElementById('avgSpend').textContent = '¥' + processedData.avgSpend.toFixed(2);

    if (processedData.dateRange.start && processedData.dateRange.end) {
        document.getElementById('dateRange').textContent =
            `${formatDate(processedData.dateRange.start)} ~ ${formatDate(processedData.dateRange.end)}`;
    }

    // 渲染图表
    renderDailyTrendChart();
    renderHourlyChart();
    renderWeekdayChart();
    renderMemberTypeChart();
    renderAreaChart();
    renderAgeChart();
    renderPackageChart();
    renderHeatmapChart();
    renderPaymentChart();
    renderRevenueTypeChart();
    renderTopUsersChart();
}

// 日营收趋势图
function renderDailyTrendChart() {
    const chartDom = document.getElementById('dailyTrendChart');
    if (charts.dailyTrend) charts.dailyTrend.dispose();
    charts.dailyTrend = echarts.init(chartDom);

    const dates = Object.keys(processedData.byDate).sort();
    const counts = dates.map(d => processedData.byDate[d].count);
    const revenues = dates.map(d => processedData.byDate[d].revenue);

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross' }
        },
        legend: {
            data: ['上机人次', '营收'],
            textStyle: { color: '#a0aec0' }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: dates.map(d => d.substring(5)),
            axisLabel: { color: '#a0aec0', rotate: 45 },
            axisLine: { lineStyle: { color: '#4a5568' } }
        },
        yAxis: [
            {
                type: 'value',
                name: '人次',
                axisLabel: { color: '#a0aec0' },
                axisLine: { lineStyle: { color: '#4a5568' } },
                splitLine: { lineStyle: { color: '#2d3748' } }
            },
            {
                type: 'value',
                name: '营收',
                axisLabel: { color: '#a0aec0', formatter: '¥{value}' },
                axisLine: { lineStyle: { color: '#4a5568' } },
                splitLine: { show: false }
            }
        ],
        series: [
            {
                name: '上机人次',
                type: 'bar',
                data: counts,
                itemStyle: { color: '#667eea' }
            },
            {
                name: '营收',
                type: 'line',
                yAxisIndex: 1,
                data: revenues,
                smooth: true,
                itemStyle: { color: '#48bb78' },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(72, 187, 120, 0.3)' },
                            { offset: 1, color: 'rgba(72, 187, 120, 0)' }
                        ]
                    }
                }
            }
        ]
    };

    charts.dailyTrend.setOption(option);
}

// 24小时分布图
function renderHourlyChart() {
    const chartDom = document.getElementById('hourlyChart');
    if (charts.hourly) charts.hourly.dispose();
    charts.hourly = echarts.init(chartDom);

    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            formatter: '{b}<br/>上机人次: {c}'
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: hours,
            axisLabel: {
                color: '#a0aec0',
                interval: 2
            },
            axisLine: { lineStyle: { color: '#4a5568' } }
        },
        yAxis: {
            type: 'value',
            axisLabel: { color: '#a0aec0' },
            axisLine: { lineStyle: { color: '#4a5568' } },
            splitLine: { lineStyle: { color: '#2d3748' } }
        },
        series: [{
            type: 'bar',
            data: processedData.byHour,
            itemStyle: {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: '#667eea' },
                        { offset: 1, color: '#764ba2' }
                    ]
                }
            }
        }]
    };

    charts.hourly.setOption(option);
}

// 星期分布图
function renderWeekdayChart() {
    const chartDom = document.getElementById('weekdayChart');
    if (charts.weekday) charts.weekday.dispose();
    charts.weekday = echarts.init(chartDom);

    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis'
        },
        radar: {
            indicator: weekdays.map(w => ({ name: w, max: Math.max(...processedData.byWeekday) * 1.2 })),
            axisName: { color: '#a0aec0' },
            splitLine: { lineStyle: { color: '#4a5568' } },
            splitArea: { areaStyle: { color: ['transparent', 'rgba(102, 126, 234, 0.05)'] } },
            axisLine: { lineStyle: { color: '#4a5568' } }
        },
        series: [{
            type: 'radar',
            data: [{
                value: processedData.byWeekday,
                name: '上机人次',
                areaStyle: { color: 'rgba(102, 126, 234, 0.3)' },
                lineStyle: { color: '#667eea' },
                itemStyle: { color: '#667eea' }
            }]
        }]
    };

    charts.weekday.setOption(option);
}

// 会员类型分布
function renderMemberTypeChart() {
    const chartDom = document.getElementById('memberTypeChart');
    if (charts.memberType) charts.memberType.dispose();
    charts.memberType = echarts.init(chartDom);

    const data = Object.entries(processedData.byMemberType)
        .filter(([k]) => k !== '未知')
        .map(([name, d]) => ({ name, value: d.count }))
        .sort((a, b) => b.value - a.value);

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} ({d}%)'
        },
        legend: {
            orient: 'vertical',
            right: 10,
            top: 'center',
            textStyle: { color: '#a0aec0' }
        },
        series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['35%', '50%'],
            avoidLabelOverlap: false,
            itemStyle: {
                borderRadius: 10,
                borderColor: '#1a202c',
                borderWidth: 2
            },
            label: { show: false },
            emphasis: {
                label: { show: true, fontSize: 14, fontWeight: 'bold' }
            },
            data: data,
            color: ['#667eea', '#48bb78', '#ed8936', '#e53e3e', '#9f7aea', '#38b2ac']
        }]
    };

    charts.memberType.setOption(option);
}

// 区域分布
function renderAreaChart() {
    const chartDom = document.getElementById('areaChart');
    if (charts.area) charts.area.dispose();
    charts.area = echarts.init(chartDom);

    const data = Object.entries(processedData.byArea)
        .filter(([k]) => k !== '未知')
        .map(([name, d]) => ({ name, value: d.count, revenue: d.revenue }))
        .sort((a, b) => b.value - a.value);

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            formatter: (p) => `${p.name}<br/>人次: ${p.value}<br/>收入: ¥${p.data.revenue.toFixed(2)}`
        },
        legend: {
            orient: 'vertical',
            right: 10,
            top: 'center',
            textStyle: { color: '#a0aec0' }
        },
        series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['35%', '50%'],
            roseType: 'radius',
            itemStyle: {
                borderRadius: 5
            },
            label: { show: false },
            data: data,
            color: ['#667eea', '#48bb78', '#ed8936', '#e53e3e', '#9f7aea', '#38b2ac']
        }]
    };

    charts.area.setOption(option);
}

// 年龄分布
function renderAgeChart() {
    const chartDom = document.getElementById('ageChart');
    if (charts.age) charts.age.dispose();
    charts.age = echarts.init(chartDom);

    const labels = Object.keys(processedData.byAge);
    const values = Object.values(processedData.byAge);

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis'
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: labels,
            axisLabel: { color: '#a0aec0' },
            axisLine: { lineStyle: { color: '#4a5568' } }
        },
        yAxis: {
            type: 'value',
            axisLabel: { color: '#a0aec0' },
            axisLine: { lineStyle: { color: '#4a5568' } },
            splitLine: { lineStyle: { color: '#2d3748' } }
        },
        series: [{
            type: 'bar',
            data: values,
            itemStyle: {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: '#48bb78' },
                        { offset: 1, color: '#38a169' }
                    ]
                },
                borderRadius: [5, 5, 0, 0]
            },
            label: {
                show: true,
                position: 'top',
                color: '#a0aec0'
            }
        }]
    };

    charts.age.setOption(option);
}

// 上机类型与套餐分布
function renderPackageChart() {
    const chartDom = document.getElementById('packageChart');
    if (charts.package) charts.package.dispose();
    charts.package = echarts.init(chartDom);

    // 上机类型数据
    const typeData = Object.entries(processedData.byPackageType)
        .map(([name, d]) => ({ name, value: d.count }));

    // 套餐详情数据（取前8个）
    const detailData = Object.entries(processedData.byPackageDetail)
        .map(([name, d]) => ({ name: name.length > 12 ? name.substring(0, 12) + '...' : name, value: d.count }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} ({d}%)'
        },
        legend: {
            orient: 'horizontal',
            bottom: 0,
            textStyle: { color: '#a0aec0', fontSize: 10 }
        },
        series: [
            {
                name: '上机类型',
                type: 'pie',
                radius: [0, '30%'],
                label: {
                    position: 'inner',
                    fontSize: 12,
                    color: '#fff'
                },
                labelLine: { show: false },
                data: typeData,
                color: ['#667eea', '#48bb78']
            },
            {
                name: '套餐详情',
                type: 'pie',
                radius: ['45%', '65%'],
                label: { show: false },
                data: detailData,
                color: ['#667eea', '#48bb78', '#ed8936', '#e53e3e', '#9f7aea', '#38b2ac', '#f6ad55', '#fc8181']
            }
        ]
    };

    charts.package.setOption(option);
}

// 热力图
function renderHeatmapChart() {
    const chartDom = document.getElementById('heatmapChart');
    if (charts.heatmap) charts.heatmap.dispose();
    charts.heatmap = echarts.init(chartDom);

    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    const maxValue = Math.max(...processedData.heatmapData.map(d => d[2]));

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            position: 'top',
            formatter: (p) => `${days[p.data[1]]} ${hours[p.data[0]]}<br/>上机人次: ${p.data[2]}`
        },
        grid: {
            left: '10%',
            right: '10%',
            bottom: '15%',
            top: '10%'
        },
        xAxis: {
            type: 'category',
            data: hours,
            splitArea: { show: true },
            axisLabel: { color: '#a0aec0', interval: 1 },
            axisLine: { lineStyle: { color: '#4a5568' } }
        },
        yAxis: {
            type: 'category',
            data: days,
            splitArea: { show: true },
            axisLabel: { color: '#a0aec0' },
            axisLine: { lineStyle: { color: '#4a5568' } }
        },
        visualMap: {
            min: 0,
            max: maxValue || 1,
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: '0%',
            inRange: {
                color: ['#1a202c', '#2d3748', '#4a5568', '#667eea', '#9f7aea', '#ed64a6']
            },
            textStyle: { color: '#a0aec0' }
        },
        series: [{
            type: 'heatmap',
            data: processedData.heatmapData,
            label: { show: false },
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }]
    };

    charts.heatmap.setOption(option);
}

// 结账方式分布
function renderPaymentChart() {
    const chartDom = document.getElementById('paymentChart');
    if (charts.payment) charts.payment.dispose();
    charts.payment = echarts.init(chartDom);

    const data = Object.entries(processedData.byPaymentMethod)
        .filter(([k]) => k !== '未知')
        .map(([name, d]) => ({ name, value: d.count }))
        .sort((a, b) => b.value - a.value);

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
        },
        xAxis: {
            type: 'value',
            axisLabel: { color: '#a0aec0' },
            axisLine: { lineStyle: { color: '#4a5568' } },
            splitLine: { lineStyle: { color: '#2d3748' } }
        },
        yAxis: {
            type: 'category',
            data: data.map(d => d.name),
            axisLabel: { color: '#a0aec0' },
            axisLine: { lineStyle: { color: '#4a5568' } }
        },
        series: [{
            type: 'bar',
            data: data.map(d => d.value),
            itemStyle: {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 1, y2: 0,
                    colorStops: [
                        { offset: 0, color: '#667eea' },
                        { offset: 1, color: '#9f7aea' }
                    ]
                },
                borderRadius: [0, 5, 5, 0]
            },
            label: {
                show: true,
                position: 'right',
                color: '#a0aec0'
            }
        }]
    };

    charts.payment.setOption(option);
}

// 收入构成图
function renderRevenueTypeChart() {
    const chartDom = document.getElementById('revenueTypeChart');
    if (charts.revenueType) charts.revenueType.dispose();
    charts.revenueType = echarts.init(chartDom);

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            formatter: '{b}: ¥{c} ({d}%)'
        },
        legend: {
            orient: 'vertical',
            right: 10,
            top: 'center',
            textStyle: { color: '#a0aec0' }
        },
        series: [{
            type: 'pie',
            radius: ['50%', '70%'],
            center: ['40%', '50%'],
            avoidLabelOverlap: false,
            itemStyle: {
                borderRadius: 10,
                borderColor: '#1a202c',
                borderWidth: 2
            },
            label: {
                show: true,
                position: 'center',
                formatter: () => `总收入\n¥${processedData.totalRevenue.toFixed(0)}`,
                fontSize: 16,
                color: '#fff'
            },
            emphasis: {
                label: {
                    show: true,
                    fontSize: 18,
                    fontWeight: 'bold'
                }
            },
            data: [
                { name: '本金', value: Math.round(processedData.totalPrincipal) },
                { name: '赠送', value: Math.round(processedData.totalBonus) }
            ],
            color: ['#48bb78', '#ed8936']
        }]
    };

    charts.revenueType.setOption(option);
}

// TOP用户图
function renderTopUsersChart() {
    const chartDom = document.getElementById('topUsersChart');
    if (charts.topUsers) charts.topUsers.dispose();
    charts.topUsers = echarts.init(chartDom);

    const users = processedData.topUsers.slice().reverse();

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params) => {
                const user = users[params[0].dataIndex];
                return `${user.name}<br/>上机次数: ${user.count}<br/>消费总额: ¥${user.revenue.toFixed(2)}`;
            }
        },
        grid: {
            left: '3%',
            right: '10%',
            bottom: '3%',
            containLabel: true
        },
        xAxis: {
            type: 'value',
            axisLabel: { color: '#a0aec0' },
            axisLine: { lineStyle: { color: '#4a5568' } },
            splitLine: { lineStyle: { color: '#2d3748' } }
        },
        yAxis: {
            type: 'category',
            data: users.map(u => u.name),
            axisLabel: { color: '#a0aec0' },
            axisLine: { lineStyle: { color: '#4a5568' } }
        },
        series: [
            {
                name: '上机次数',
                type: 'bar',
                data: users.map(u => u.count),
                itemStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 1, y2: 0,
                        colorStops: [
                            { offset: 0, color: '#667eea' },
                            { offset: 1, color: '#48bb78' }
                        ]
                    },
                    borderRadius: [0, 5, 5, 0]
                },
                label: {
                    show: true,
                    position: 'right',
                    formatter: '{c}次',
                    color: '#a0aec0'
                }
            }
        ]
    };

    charts.topUsers.setOption(option);
}

// 窗口大小变化处理
function handleResize() {
    Object.values(charts).forEach(chart => {
        if (chart && chart.resize) chart.resize();
    });
}
