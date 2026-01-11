// Supabase 配置
const SUPABASE_URL = 'https://dfbgnrmigltjvlvdfcao.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmYmducm1pZ2x0anZsdmRmY2FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjY4MjksImV4cCI6MjA4MzY0MjgyOX0.mEm3-VwB4NaebrW2u8IQrrJNg7RvZqElCmmwY_Ge-3c';

// 初始化 Supabase 客户端
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 全局数据存储
let rawData = [];
let processedData = {};
let pendingUploadData = [];
let availableDates = []; // 有数据的日期列表
let datePickerInstance = null;
let selectedDateRange = { start: null, end: null };

// 商品数据存储
let productRawData = [];
let productProcessedData = {};
let pendingProductData = [];
let productAvailableDates = [];
let productDatePickerInstance = null;
let productUploadDatePickerInstance = null;
let selectedProductDateRange = { start: null, end: null };
let productUploadDateRange = { start: null, end: null };

// DOM 元素
const fileInput = document.getElementById('fileInput');
const uploadBox = document.getElementById('uploadBox');
const fileInfo = document.getElementById('fileInfo');
const statsOverview = document.getElementById('statsOverview');
const chartsSection = document.getElementById('chartsSection');
const dbStatus = document.getElementById('dbStatus');
const loadingOverlay = document.getElementById('loadingOverlay');

// 图表实例
let charts = {};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    setupTabs();
    setupButtons();
    setupFileUpload();
    setupDragDrop();
    setupProductButtons();
    setupProductFileUpload();
    setupProductDragDrop();
    window.addEventListener('resize', handleResize);

    // 测试数据库连接并加载日期数据
    await testConnection();
    await loadAvailableDates();
    await loadProductAvailableDates();
    initDatePicker();
    initProductDatePicker();
});

// 设置标签页切换
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;

            // 切换按钮状态
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // 切换内容
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tab + 'Tab').classList.add('active');

            // 重新调整图表大小
            setTimeout(handleResize, 100);
        });
    });
}

// 测试数据库连接
async function testConnection() {
    try {
        const { count, error } = await db
            .from('sessions')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;

        dbStatus.classList.add('connected');
        dbStatus.querySelector('.status-text').textContent = `已连接 (${count || 0} 条记录)`;
    } catch (err) {
        console.error('连接失败:', err);
        dbStatus.classList.add('error');
        dbStatus.querySelector('.status-text').textContent = '连接失败';
    }
}

// 加载有数据的日期列表
async function loadAvailableDates() {
    try {
        const { data, error } = await db
            .from('session_dates')
            .select('date, record_count, total_revenue')
            .order('date', { ascending: true });

        if (error) throw error;

        availableDates = data || [];
        console.log('已加载日期数据:', availableDates.length, '天');
    } catch (err) {
        console.error('加载日期失败:', err);
        availableDates = [];
    }
}

// 初始化日期选择器
function initDatePicker() {
    const datesToMark = availableDates.map(d => d.date);

    datePickerInstance = flatpickr('#datePicker', {
        mode: 'range',
        dateFormat: 'Y-m-d',
        locale: 'zh',
        inline: false,
        showMonths: 1,
        defaultDate: getDefaultDateRange(),
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            const dateStr = dayElem.dateObj.toISOString().split('T')[0];
            if (datesToMark.includes(dateStr)) {
                dayElem.classList.add('has-data');
                // 添加提示
                const dateInfo = availableDates.find(d => d.date === dateStr);
                if (dateInfo) {
                    dayElem.title = `${dateInfo.record_count} 条记录，¥${parseFloat(dateInfo.total_revenue).toFixed(0)}`;
                }
            }
        },
        onChange: function(selectedDates, dateStr, instance) {
            handleDateSelection(selectedDates);
        }
    });

    // 如果有数据，默认选中最近有数据的日期范围
    if (availableDates.length > 0) {
        const defaultRange = getDefaultDateRange();
        if (defaultRange.length === 2) {
            datePickerInstance.setDate(defaultRange);
            handleDateSelection(defaultRange.map(d => new Date(d)));
        }
    }
}

// 获取默认日期范围（最近有数据的7天或全部）
function getDefaultDateRange() {
    if (availableDates.length === 0) return [];

    const dates = availableDates.map(d => d.date).sort();
    const lastDate = dates[dates.length - 1];

    // 找最近7天有数据的范围
    const recentDates = dates.slice(-7);
    return [recentDates[0], lastDate];
}

// 处理日期选择
function handleDateSelection(selectedDates) {
    const loadBtn = document.getElementById('loadSelectedBtn');
    const selectedRange = document.getElementById('selectedRange');
    const rangeStats = document.getElementById('rangeStats');

    if (selectedDates.length === 0) {
        selectedDateRange = { start: null, end: null };
        loadBtn.disabled = true;
        selectedRange.textContent = '请选择日期';
        rangeStats.textContent = '';
        return;
    }

    if (selectedDates.length === 1) {
        // 单日选择
        const dateStr = formatDate(selectedDates[0]);
        selectedDateRange = { start: dateStr, end: dateStr };
        selectedRange.textContent = dateStr;
    } else {
        // 范围选择
        const startStr = formatDate(selectedDates[0]);
        const endStr = formatDate(selectedDates[1]);
        selectedDateRange = { start: startStr, end: endStr };
        selectedRange.textContent = `${startStr} 至 ${endStr}`;
    }

    // 计算选中范围内的统计
    const stats = calculateRangeStats(selectedDateRange.start, selectedDateRange.end);
    if (stats.days > 0) {
        rangeStats.textContent = `${stats.days} 天有数据，共 ${stats.records} 条记录，¥${stats.revenue.toFixed(0)}`;
        loadBtn.disabled = false;
    } else {
        rangeStats.textContent = '选中范围内无数据';
        loadBtn.disabled = true;
    }
}

// 计算日期范围内的统计
function calculateRangeStats(startDate, endDate) {
    let days = 0;
    let records = 0;
    let revenue = 0;

    availableDates.forEach(d => {
        if (d.date >= startDate && d.date <= endDate) {
            days++;
            records += d.record_count;
            revenue += parseFloat(d.total_revenue) || 0;
        }
    });

    return { days, records, revenue };
}

// 设置按钮事件
function setupButtons() {
    // 加载选中日期数据
    document.getElementById('loadSelectedBtn').addEventListener('click', loadSelectedData);

    // 加载全部数据
    document.getElementById('loadAllBtn').addEventListener('click', loadAllData);

    // 显示上传面板
    document.getElementById('showUploadBtn').addEventListener('click', () => {
        document.getElementById('uploadSection').classList.remove('hidden');
    });

    // 关闭上传面板
    document.getElementById('closeUploadBtn').addEventListener('click', () => {
        document.getElementById('uploadSection').classList.add('hidden');
    });

    // 上传按钮
    document.getElementById('saveToDbBtn').addEventListener('click', saveToDatabase);
    document.getElementById('previewOnlyBtn').addEventListener('click', previewOnly);
}

// 显示/隐藏加载遮罩
function showLoading(show = true) {
    if (show) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}

// 加载选中日期的数据
async function loadSelectedData() {
    if (!selectedDateRange.start || !selectedDateRange.end) {
        alert('请先选择日期');
        return;
    }

    showLoading(true);

    try {
        const { data, error } = await db
            .from('sessions')
            .select('*')
            .gte('start_time', selectedDateRange.start + 'T00:00:00')
            .lte('start_time', selectedDateRange.end + 'T23:59:59')
            .order('start_time', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            alert('选中日期范围内没有数据');
            showLoading(false);
            return;
        }

        rawData = convertFromDb(data);
        processData();
        renderDashboard();
    } catch (err) {
        alert('加载失败: ' + err.message);
    } finally {
        showLoading(false);
    }
}

// 加载全部数据
async function loadAllData() {
    showLoading(true);

    try {
        const { data, error } = await db
            .from('sessions')
            .select('*')
            .order('start_time', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            alert('数据库中没有数据，请先上传');
            showLoading(false);
            return;
        }

        rawData = convertFromDb(data);
        processData();
        renderDashboard();
    } catch (err) {
        alert('加载失败: ' + err.message);
    } finally {
        showLoading(false);
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

        pendingUploadData = convertExcelToDbFormat(jsonData);
        fileInfo.innerHTML = `📄 <strong>${file.name}</strong> - 解析到 ${pendingUploadData.length} 条记录`;
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
    }).filter(r => r.card_id && r.start_time);
}

// 解析 Excel 日期
function parseExcelDate(value) {
    if (!value) return null;

    if (typeof value === 'number') {
        const date = new Date((value - 25569) * 86400 * 1000);
        return date;
    }

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

        const progress = ((i + 1) / totalBatches) * 100;
        progressFill.style.width = progress + '%';
        progressText.textContent = `上传中... ${i + 1}/${totalBatches} 批次`;
    }

    progressFill.style.width = '100%';
    progressText.textContent = `上传完成！新增 ${uploaded} 条，跳过重复 ${skipped} 条${errors > 0 ? `，失败 ${errors} 条` : ''}`;

    document.getElementById('saveToDbBtn').disabled = false;

    // 刷新日期数据和连接状态
    await testConnection();
    await loadAvailableDates();

    // 刷新日历显示
    if (datePickerInstance) {
        datePickerInstance.destroy();
        initDatePicker();
    }

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

    // 关闭上传面板
    document.getElementById('uploadSection').classList.add('hidden');
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// 处理数据
function processData() {
    rawData.forEach(row => {
        if (row['上机时间'] && !row.startTime) {
            row.startTime = parseExcelDate(row['上机时间']);
        }
        if (row['下机时间'] && !row.endTime) {
            row.endTime = parseExcelDate(row['下机时间']);
        }

        if (row['卡号']) {
            const idCard = String(row['卡号']);
            if (idCard.length >= 14) {
                const birthYear = parseInt(idCard.substring(6, 10));
                row.age = 2025 - birthYear;
            }
        }
    });

    processedData = {
        totalRecords: rawData.length,
        totalRevenue: rawData.reduce((sum, r) => sum + (parseFloat(r['扣除本金']) || 0) + (parseFloat(r['扣除赠送']) || 0), 0),
        totalPrincipal: rawData.reduce((sum, r) => sum + (parseFloat(r['扣除本金']) || 0), 0),
        totalBonus: rawData.reduce((sum, r) => sum + (parseFloat(r['扣除赠送']) || 0), 0),
        dateRange: getDateRange(),
        avgSpend: 0,
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
    statsOverview.classList.remove('hidden');
    chartsSection.classList.remove('hidden');

    document.getElementById('totalRecords').textContent = processedData.totalRecords.toLocaleString();
    document.getElementById('totalRevenue').textContent = '¥' + processedData.totalRevenue.toFixed(2);
    document.getElementById('avgSpend').textContent = '¥' + processedData.avgSpend.toFixed(2);

    if (processedData.dateRange.start && processedData.dateRange.end) {
        document.getElementById('dateRange').textContent =
            `${formatDate(processedData.dateRange.start)} ~ ${formatDate(processedData.dateRange.end)}`;
    }

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

    // 滚动到统计区域
    statsOverview.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== 图表渲染函数 =====

function renderDailyTrendChart() {
    const chartDom = document.getElementById('dailyTrendChart');
    if (charts.dailyTrend) charts.dailyTrend.dispose();
    charts.dailyTrend = echarts.init(chartDom);

    const dates = Object.keys(processedData.byDate).sort();
    const counts = dates.map(d => processedData.byDate[d].count);
    const revenues = dates.map(d => processedData.byDate[d].revenue);

    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: { data: ['上机人次', '营收'], textStyle: { color: '#a0aec0' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
            type: 'category',
            data: dates.map(d => d.substring(5)),
            axisLabel: { color: '#a0aec0', rotate: 45 },
            axisLine: { lineStyle: { color: '#4a5568' } }
        },
        yAxis: [
            { type: 'value', name: '人次', axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { lineStyle: { color: '#2d3748' } } },
            { type: 'value', name: '营收', axisLabel: { color: '#a0aec0', formatter: '¥{value}' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { show: false } }
        ],
        series: [
            { name: '上机人次', type: 'bar', data: counts, itemStyle: { color: '#667eea' } },
            { name: '营收', type: 'line', yAxisIndex: 1, data: revenues, smooth: true, itemStyle: { color: '#48bb78' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(72, 187, 120, 0.3)' }, { offset: 1, color: 'rgba(72, 187, 120, 0)' }] } } }
        ]
    };
    charts.dailyTrend.setOption(option);
}

function renderHourlyChart() {
    const chartDom = document.getElementById('hourlyChart');
    if (charts.hourly) charts.hourly.dispose();
    charts.hourly = echarts.init(chartDom);

    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', formatter: '{b}<br/>上机人次: {c}' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: hours, axisLabel: { color: '#a0aec0', interval: 2 }, axisLine: { lineStyle: { color: '#4a5568' } } },
        yAxis: { type: 'value', axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { lineStyle: { color: '#2d3748' } } },
        series: [{ type: 'bar', data: processedData.byHour, itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#667eea' }, { offset: 1, color: '#764ba2' }] } } }]
    };
    charts.hourly.setOption(option);
}

function renderWeekdayChart() {
    const chartDom = document.getElementById('weekdayChart');
    if (charts.weekday) charts.weekday.dispose();
    charts.weekday = echarts.init(chartDom);

    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis' },
        radar: {
            indicator: weekdays.map(w => ({ name: w, max: Math.max(...processedData.byWeekday) * 1.2 })),
            axisName: { color: '#a0aec0' },
            splitLine: { lineStyle: { color: '#4a5568' } },
            splitArea: { areaStyle: { color: ['transparent', 'rgba(102, 126, 234, 0.05)'] } },
            axisLine: { lineStyle: { color: '#4a5568' } }
        },
        series: [{ type: 'radar', data: [{ value: processedData.byWeekday, name: '上机人次', areaStyle: { color: 'rgba(102, 126, 234, 0.3)' }, lineStyle: { color: '#667eea' }, itemStyle: { color: '#667eea' } }] }]
    };
    charts.weekday.setOption(option);
}

function renderMemberTypeChart() {
    const chartDom = document.getElementById('memberTypeChart');
    if (charts.memberType) charts.memberType.dispose();
    charts.memberType = echarts.init(chartDom);

    const data = Object.entries(processedData.byMemberType).filter(([k]) => k !== '未知').map(([name, d]) => ({ name, value: d.count })).sort((a, b) => b.value - a.value);
    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: '#a0aec0' } },
        series: [{ type: 'pie', radius: ['40%', '70%'], center: ['35%', '50%'], avoidLabelOverlap: false, itemStyle: { borderRadius: 10, borderColor: '#1a202c', borderWidth: 2 }, label: { show: false }, emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } }, data: data, color: ['#667eea', '#48bb78', '#ed8936', '#e53e3e', '#9f7aea', '#38b2ac'] }]
    };
    charts.memberType.setOption(option);
}

function renderAreaChart() {
    const chartDom = document.getElementById('areaChart');
    if (charts.area) charts.area.dispose();
    charts.area = echarts.init(chartDom);

    const data = Object.entries(processedData.byArea).filter(([k]) => k !== '未知').map(([name, d]) => ({ name, value: d.count, revenue: d.revenue })).sort((a, b) => b.value - a.value);
    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', formatter: (p) => `${p.name}<br/>人次: ${p.value}<br/>收入: ¥${p.data.revenue.toFixed(2)}` },
        legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: '#a0aec0' } },
        series: [{ type: 'pie', radius: ['40%', '70%'], center: ['35%', '50%'], roseType: 'radius', itemStyle: { borderRadius: 5 }, label: { show: false }, data: data, color: ['#667eea', '#48bb78', '#ed8936', '#e53e3e', '#9f7aea', '#38b2ac'] }]
    };
    charts.area.setOption(option);
}

function renderAgeChart() {
    const chartDom = document.getElementById('ageChart');
    if (charts.age) charts.age.dispose();
    charts.age = echarts.init(chartDom);

    const labels = Object.keys(processedData.byAge);
    const values = Object.values(processedData.byAge);
    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: labels, axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } } },
        yAxis: { type: 'value', axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { lineStyle: { color: '#2d3748' } } },
        series: [{ type: 'bar', data: values, itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#48bb78' }, { offset: 1, color: '#38a169' }] }, borderRadius: [5, 5, 0, 0] }, label: { show: true, position: 'top', color: '#a0aec0' } }]
    };
    charts.age.setOption(option);
}

function renderPackageChart() {
    const chartDom = document.getElementById('packageChart');
    if (charts.package) charts.package.dispose();
    charts.package = echarts.init(chartDom);

    const typeData = Object.entries(processedData.byPackageType).map(([name, d]) => ({ name, value: d.count }));
    const detailData = Object.entries(processedData.byPackageDetail).map(([name, d]) => ({ name: name.length > 12 ? name.substring(0, 12) + '...' : name, value: d.count })).sort((a, b) => b.value - a.value).slice(0, 8);
    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { orient: 'horizontal', bottom: 0, textStyle: { color: '#a0aec0', fontSize: 10 } },
        series: [
            { name: '上机类型', type: 'pie', radius: [0, '30%'], label: { position: 'inner', fontSize: 12, color: '#fff' }, labelLine: { show: false }, data: typeData, color: ['#667eea', '#48bb78'] },
            { name: '套餐详情', type: 'pie', radius: ['45%', '65%'], label: { show: false }, data: detailData, color: ['#667eea', '#48bb78', '#ed8936', '#e53e3e', '#9f7aea', '#38b2ac', '#f6ad55', '#fc8181'] }
        ]
    };
    charts.package.setOption(option);
}

function renderHeatmapChart() {
    const chartDom = document.getElementById('heatmapChart');
    if (charts.heatmap) charts.heatmap.dispose();
    charts.heatmap = echarts.init(chartDom);

    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const maxValue = Math.max(...processedData.heatmapData.map(d => d[2]));
    const option = {
        backgroundColor: 'transparent',
        tooltip: { position: 'top', formatter: (p) => `${days[p.data[1]]} ${hours[p.data[0]]}<br/>上机人次: ${p.data[2]}` },
        grid: { left: '10%', right: '10%', bottom: '15%', top: '10%' },
        xAxis: { type: 'category', data: hours, splitArea: { show: true }, axisLabel: { color: '#a0aec0', interval: 1 }, axisLine: { lineStyle: { color: '#4a5568' } } },
        yAxis: { type: 'category', data: days, splitArea: { show: true }, axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } } },
        visualMap: { min: 0, max: maxValue || 1, calculable: true, orient: 'horizontal', left: 'center', bottom: '0%', inRange: { color: ['#1a202c', '#2d3748', '#4a5568', '#667eea', '#9f7aea', '#ed64a6'] }, textStyle: { color: '#a0aec0' } },
        series: [{ type: 'heatmap', data: processedData.heatmapData, label: { show: false }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } } }]
    };
    charts.heatmap.setOption(option);
}

function renderPaymentChart() {
    const chartDom = document.getElementById('paymentChart');
    if (charts.payment) charts.payment.dispose();
    charts.payment = echarts.init(chartDom);

    const data = Object.entries(processedData.byPaymentMethod).filter(([k]) => k !== '未知').map(([name, d]) => ({ name, value: d.count })).sort((a, b) => b.value - a.value);
    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value', axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { lineStyle: { color: '#2d3748' } } },
        yAxis: { type: 'category', data: data.map(d => d.name), axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } } },
        series: [{ type: 'bar', data: data.map(d => d.value), itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#667eea' }, { offset: 1, color: '#9f7aea' }] }, borderRadius: [0, 5, 5, 0] }, label: { show: true, position: 'right', color: '#a0aec0' } }]
    };
    charts.payment.setOption(option);
}

function renderRevenueTypeChart() {
    const chartDom = document.getElementById('revenueTypeChart');
    if (charts.revenueType) charts.revenueType.dispose();
    charts.revenueType = echarts.init(chartDom);

    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
        legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: '#a0aec0' } },
        series: [{ type: 'pie', radius: ['50%', '70%'], center: ['40%', '50%'], avoidLabelOverlap: false, itemStyle: { borderRadius: 10, borderColor: '#1a202c', borderWidth: 2 }, label: { show: true, position: 'center', formatter: () => `总收入\n¥${processedData.totalRevenue.toFixed(0)}`, fontSize: 16, color: '#fff' }, emphasis: { label: { show: true, fontSize: 18, fontWeight: 'bold' } }, data: [{ name: '本金', value: Math.round(processedData.totalPrincipal) }, { name: '赠送', value: Math.round(processedData.totalBonus) }], color: ['#48bb78', '#ed8936'] }]
    };
    charts.revenueType.setOption(option);
}

function renderTopUsersChart() {
    const chartDom = document.getElementById('topUsersChart');
    if (charts.topUsers) charts.topUsers.dispose();
    charts.topUsers = echarts.init(chartDom);

    const users = processedData.topUsers.slice().reverse();
    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (params) => { const user = users[params[0].dataIndex]; return `${user.name}<br/>上机次数: ${user.count}<br/>消费总额: ¥${user.revenue.toFixed(2)}`; } },
        grid: { left: '3%', right: '10%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value', axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { lineStyle: { color: '#2d3748' } } },
        yAxis: { type: 'category', data: users.map(u => u.name), axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } } },
        series: [{ name: '上机次数', type: 'bar', data: users.map(u => u.count), itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#667eea' }, { offset: 1, color: '#48bb78' }] }, borderRadius: [0, 5, 5, 0] }, label: { show: true, position: 'right', formatter: '{c}次', color: '#a0aec0' } }]
    };
    charts.topUsers.setOption(option);
}

function handleResize() {
    Object.values(charts).forEach(chart => {
        if (chart && chart.resize) chart.resize();
    });
}

// ===== 商品数据相关函数 =====

// 加载商品有数据的日期列表
async function loadProductAvailableDates() {
    try {
        const { data, error } = await db
            .from('product_dates')
            .select('date, product_count, total_quantity, total_revenue, total_profit')
            .order('date', { ascending: true });

        if (error) throw error;

        productAvailableDates = data || [];
        console.log('已加载商品日期数据:', productAvailableDates.length, '天');
    } catch (err) {
        console.error('加载商品日期失败:', err);
        productAvailableDates = [];
    }
}

// 初始化商品日期选择器
function initProductDatePicker() {
    const datesToMark = productAvailableDates.map(d => d.date);

    productDatePickerInstance = flatpickr('#productDatePicker', {
        mode: 'range',
        dateFormat: 'Y-m-d',
        locale: 'zh',
        inline: false,
        showMonths: 1,
        defaultDate: getProductDefaultDateRange(),
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            const dateStr = dayElem.dateObj.toISOString().split('T')[0];
            if (datesToMark.includes(dateStr)) {
                dayElem.classList.add('has-data');
                const dateInfo = productAvailableDates.find(d => d.date === dateStr);
                if (dateInfo) {
                    dayElem.title = `${dateInfo.product_count} 种商品，${dateInfo.total_quantity} 件，¥${parseFloat(dateInfo.total_revenue).toFixed(0)}`;
                }
            }
        },
        onChange: function(selectedDates, dateStr, instance) {
            handleProductDateSelection(selectedDates);
        }
    });

    if (productAvailableDates.length > 0) {
        const defaultRange = getProductDefaultDateRange();
        if (defaultRange.length === 2) {
            productDatePickerInstance.setDate(defaultRange);
            handleProductDateSelection(defaultRange.map(d => new Date(d)));
        }
    }
}

// 获取商品默认日期范围
function getProductDefaultDateRange() {
    if (productAvailableDates.length === 0) return [];

    const dates = productAvailableDates.map(d => d.date).sort();
    const lastDate = dates[dates.length - 1];
    const recentDates = dates.slice(-7);
    return [recentDates[0], lastDate];
}

// 处理商品日期选择
function handleProductDateSelection(selectedDates) {
    const loadBtn = document.getElementById('loadProductBtn');
    const selectedRange = document.getElementById('productSelectedRange');
    const rangeStats = document.getElementById('productRangeStats');

    if (selectedDates.length === 0) {
        selectedProductDateRange = { start: null, end: null };
        loadBtn.disabled = true;
        selectedRange.textContent = '请选择日期';
        rangeStats.textContent = '';
        return;
    }

    if (selectedDates.length === 1) {
        const dateStr = formatDate(selectedDates[0]);
        selectedProductDateRange = { start: dateStr, end: dateStr };
        selectedRange.textContent = dateStr;
    } else {
        const startStr = formatDate(selectedDates[0]);
        const endStr = formatDate(selectedDates[1]);
        selectedProductDateRange = { start: startStr, end: endStr };
        selectedRange.textContent = `${startStr} 至 ${endStr}`;
    }

    const stats = calculateProductRangeStats(selectedProductDateRange.start, selectedProductDateRange.end);
    if (stats.days > 0) {
        rangeStats.textContent = `${stats.days} 天有数据，${stats.quantity} 件商品，¥${stats.revenue.toFixed(0)}`;
        loadBtn.disabled = false;
    } else {
        rangeStats.textContent = '选中范围内无数据';
        loadBtn.disabled = true;
    }
}

// 计算商品日期范围统计
function calculateProductRangeStats(startDate, endDate) {
    let days = 0;
    let quantity = 0;
    let revenue = 0;

    productAvailableDates.forEach(d => {
        if (d.date >= startDate && d.date <= endDate) {
            days++;
            quantity += d.total_quantity;
            revenue += parseFloat(d.total_revenue) || 0;
        }
    });

    return { days, quantity, revenue };
}

// 设置商品按钮事件
function setupProductButtons() {
    document.getElementById('loadProductBtn').addEventListener('click', loadSelectedProductData);
    document.getElementById('loadAllProductBtn').addEventListener('click', loadAllProductData);

    document.getElementById('showProductUploadBtn').addEventListener('click', () => {
        document.getElementById('productUploadSection').classList.remove('hidden');
        initProductUploadDatePicker();
    });

    document.getElementById('closeProductUploadBtn').addEventListener('click', () => {
        document.getElementById('productUploadSection').classList.add('hidden');
    });

    document.getElementById('saveProductBtn').addEventListener('click', saveProductToDatabase);
    document.getElementById('previewProductBtn').addEventListener('click', previewProductOnly);
}

// 初始化商品上传日期选择器
function initProductUploadDatePicker() {
    if (productUploadDatePickerInstance) {
        productUploadDatePickerInstance.destroy();
    }

    productUploadDatePickerInstance = flatpickr('#productUploadDate', {
        mode: 'range',
        dateFormat: 'Y-m-d',
        locale: 'zh',
        inline: false,
        showMonths: 1,
        onChange: function(selectedDates, dateStr, instance) {
            const saveBtn = document.getElementById('saveProductBtn');
            if (selectedDates.length === 1) {
                const dateStr = formatDate(selectedDates[0]);
                productUploadDateRange = { start: dateStr, end: dateStr };
                saveBtn.disabled = pendingProductData.length === 0;
            } else if (selectedDates.length === 2) {
                productUploadDateRange = {
                    start: formatDate(selectedDates[0]),
                    end: formatDate(selectedDates[1])
                };
                saveBtn.disabled = pendingProductData.length === 0;
            } else {
                productUploadDateRange = { start: null, end: null };
                saveBtn.disabled = true;
            }
        }
    });
}

// 设置商品文件上传
function setupProductFileUpload() {
    const productFileInput = document.getElementById('productFileInput');
    productFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleProductFile(file);
        }
    });
}

// 设置商品拖拽上传
function setupProductDragDrop() {
    const productUploadBox = document.getElementById('productUploadBox');

    productUploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        productUploadBox.classList.add('dragover');
    });

    productUploadBox.addEventListener('dragleave', () => {
        productUploadBox.classList.remove('dragover');
    });

    productUploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        productUploadBox.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) {
            handleProductFile(file);
        }
    });
}

// 处理商品文件
function handleProductFile(file) {
    if (!file.name.match(/\.(xls|xlsx)$/i)) {
        alert('请上传 Excel 文件 (.xls 或 .xlsx)');
        return;
    }

    const fileInfo = document.getElementById('productFileInfo');
    fileInfo.innerHTML = `📄 已选择: <strong>${file.name}</strong> (${formatFileSize(file.size)})`;
    fileInfo.classList.remove('hidden');

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // 跳过第一行（汇总行）和第二行（表头），从第三行开始
        const headers = jsonData[1];
        const dataRows = jsonData.slice(2);

        pendingProductData = dataRows
            .filter(row => row[1]) // 过滤掉没有商品名称的行
            .map(row => ({
                store_name: row[0] || null,
                product_name: row[1] || null,
                category: row[2] || null,
                product_type: row[3] || null,
                quantity: parseInt(row[4]) || 0,
                unit: row[5] || null,
                total_cost: parseFloat(row[7]) || 0,
                total_price: parseFloat(row[8]) || 0,
                total_profit: parseFloat(row[9]) || 0
            }));

        fileInfo.innerHTML = `📄 <strong>${file.name}</strong> - 解析到 ${pendingProductData.length} 条商品记录`;
        document.getElementById('productUploadActions').classList.remove('hidden');

        // 检查是否已选择日期
        const saveBtn = document.getElementById('saveProductBtn');
        saveBtn.disabled = !productUploadDateRange.start;
    };
    reader.readAsArrayBuffer(file);
}

// 聚合相同商品的数据
function aggregateProductData(data) {
    const aggregated = {};

    data.forEach(item => {
        const key = `${item.store_name}|${item.product_name}`;
        if (!aggregated[key]) {
            aggregated[key] = {
                store_name: item.store_name,
                product_name: item.product_name,
                category: item.category,
                product_type: item.product_type,
                quantity: 0,
                unit: item.unit,
                total_cost: 0,
                total_price: 0,
                total_profit: 0
            };
        }
        aggregated[key].quantity += item.quantity || 0;
        aggregated[key].total_cost += item.total_cost || 0;
        aggregated[key].total_price += item.total_price || 0;
        aggregated[key].total_profit += item.total_profit || 0;
    });

    return Object.values(aggregated);
}

// 保存商品到数据库
async function saveProductToDatabase() {
    if (pendingProductData.length === 0) {
        alert('没有可上传的数据');
        return;
    }

    if (!productUploadDateRange.start) {
        alert('请先选择数据对应的日期');
        return;
    }

    const progressDiv = document.getElementById('productUploadProgress');
    const progressFill = document.getElementById('productProgressFill');
    const progressText = document.getElementById('productProgressText');

    progressDiv.classList.remove('hidden');
    document.getElementById('saveProductBtn').disabled = true;

    // 聚合相同商品的数据
    const aggregatedData = aggregateProductData(pendingProductData);
    console.log(`原始 ${pendingProductData.length} 条，聚合后 ${aggregatedData.length} 条`);

    // 生成日期列表
    const dates = generateDateList(productUploadDateRange.start, productUploadDateRange.end);
    progressText.textContent = `准备上传 ${aggregatedData.length} 种商品到 ${dates.length} 天...`;

    let totalUploaded = 0;
    let totalErrors = 0;

    // 对每个日期分别上传数据
    for (let i = 0; i < dates.length; i++) {
        const saleDate = dates[i];

        // 先删除该日期的旧数据（覆盖模式）
        try {
            await db.from('product_sales').delete().eq('sale_date', saleDate);
            // 同时重置 product_dates 中的记录
            await db.from('product_dates').delete().eq('date', saleDate);
        } catch (err) {
            console.error('删除旧数据失败:', err);
        }

        // 为每条记录添加日期
        const dataWithDate = aggregatedData.map(item => ({
            ...item,
            sale_date: saleDate
        }));

        // 分批上传
        const batchSize = 50;
        const totalBatches = Math.ceil(dataWithDate.length / batchSize);

        for (let j = 0; j < totalBatches; j++) {
            const batch = dataWithDate.slice(j * batchSize, (j + 1) * batchSize);

            try {
                const { data, error } = await db
                    .from('product_sales')
                    .insert(batch)
                    .select();

                if (error) {
                    console.error('批次上传错误:', error);
                    totalErrors += batch.length;
                } else {
                    totalUploaded += data ? data.length : 0;
                }
            } catch (err) {
                console.error('上传异常:', err);
                totalErrors += batch.length;
            }
        }

        const progress = ((i + 1) / dates.length) * 100;
        progressFill.style.width = progress + '%';
        progressText.textContent = `上传中... ${i + 1}/${dates.length} 天`;
    }

    progressFill.style.width = '100%';
    progressText.textContent = `上传完成！共上传 ${totalUploaded} 种商品到 ${dates.length} 天${totalErrors > 0 ? `，失败 ${totalErrors} 条` : ''}`;

    document.getElementById('saveProductBtn').disabled = false;

    // 刷新日期数据
    await loadProductAvailableDates();
    if (productDatePickerInstance) {
        productDatePickerInstance.destroy();
        initProductDatePicker();
    }

    setTimeout(() => {
        progressDiv.classList.add('hidden');
        progressFill.style.width = '0%';
    }, 3000);
}

// 生成日期列表
function generateDateList(startDate, endDate) {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(formatDate(new Date(d)));
    }

    return dates;
}

// 仅预览商品数据
function previewProductOnly() {
    if (pendingProductData.length === 0) {
        alert('没有可预览的数据');
        return;
    }

    productRawData = pendingProductData;
    processProductData();
    renderProductDashboard();
    document.getElementById('productUploadSection').classList.add('hidden');
}

// 加载选中日期的商品数据
async function loadSelectedProductData() {
    if (!selectedProductDateRange.start || !selectedProductDateRange.end) {
        alert('请先选择日期');
        return;
    }

    showLoading(true);

    try {
        const { data, error } = await db
            .from('product_sales')
            .select('*')
            .gte('sale_date', selectedProductDateRange.start)
            .lte('sale_date', selectedProductDateRange.end)
            .order('sale_date', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            alert('选中日期范围内没有商品数据');
            showLoading(false);
            return;
        }

        productRawData = data;
        processProductData();
        renderProductDashboard();
    } catch (err) {
        alert('加载失败: ' + err.message);
    } finally {
        showLoading(false);
    }
}

// 加载全部商品数据
async function loadAllProductData() {
    showLoading(true);

    try {
        const { data, error } = await db
            .from('product_sales')
            .select('*')
            .order('sale_date', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            alert('数据库中没有商品数据，请先上传');
            showLoading(false);
            return;
        }

        productRawData = data;
        processProductData();
        renderProductDashboard();
    } catch (err) {
        alert('加载失败: ' + err.message);
    } finally {
        showLoading(false);
    }
}

// 处理商品数据
function processProductData() {
    productProcessedData = {
        totalItems: new Set(productRawData.map(r => r.product_name)).size,
        totalQuantity: productRawData.reduce((sum, r) => sum + (r.quantity || 0), 0),
        totalRevenue: productRawData.reduce((sum, r) => sum + (parseFloat(r.total_price) || 0), 0),
        totalProfit: productRawData.reduce((sum, r) => sum + (parseFloat(r.total_profit) || 0), 0),
        totalCost: productRawData.reduce((sum, r) => sum + (parseFloat(r.total_cost) || 0), 0),
        byDate: groupProductByDate(),
        byCategory: groupProductByCategory(),
        byProduct: groupProductByProduct(),
        profitRateByCategory: calculateProfitRateByCategory()
    };
}

// 按日期分组商品
function groupProductByDate() {
    const groups = {};

    productRawData.forEach(row => {
        const dateStr = row.sale_date;
        if (!groups[dateStr]) {
            groups[dateStr] = { quantity: 0, revenue: 0, profit: 0 };
        }
        groups[dateStr].quantity += row.quantity || 0;
        groups[dateStr].revenue += parseFloat(row.total_price) || 0;
        groups[dateStr].profit += parseFloat(row.total_profit) || 0;
    });

    return groups;
}

// 按分类分组商品
function groupProductByCategory() {
    const groups = {};

    productRawData.forEach(row => {
        const category = row.category || '未分类';
        if (!groups[category]) {
            groups[category] = { quantity: 0, revenue: 0, profit: 0, cost: 0 };
        }
        groups[category].quantity += row.quantity || 0;
        groups[category].revenue += parseFloat(row.total_price) || 0;
        groups[category].profit += parseFloat(row.total_profit) || 0;
        groups[category].cost += parseFloat(row.total_cost) || 0;
    });

    return groups;
}

// 按商品分组
function groupProductByProduct() {
    const groups = {};

    productRawData.forEach(row => {
        const name = row.product_name || '未知商品';
        if (!groups[name]) {
            groups[name] = { quantity: 0, revenue: 0, profit: 0 };
        }
        groups[name].quantity += row.quantity || 0;
        groups[name].revenue += parseFloat(row.total_price) || 0;
        groups[name].profit += parseFloat(row.total_profit) || 0;
    });

    return groups;
}

// 计算各分类利润率
function calculateProfitRateByCategory() {
    const result = [];
    const byCategory = productProcessedData.byCategory || groupProductByCategory();

    Object.entries(byCategory).forEach(([category, data]) => {
        if (data.revenue > 0) {
            result.push({
                category,
                profitRate: (data.profit / data.revenue * 100).toFixed(1),
                profit: data.profit,
                revenue: data.revenue
            });
        }
    });

    return result.sort((a, b) => b.profitRate - a.profitRate);
}

// 渲染商品仪表盘
function renderProductDashboard() {
    document.getElementById('productStatsOverview').classList.remove('hidden');
    document.getElementById('productChartsSection').classList.remove('hidden');

    document.getElementById('productTotalItems').textContent = productProcessedData.totalItems.toLocaleString();
    document.getElementById('productTotalQuantity').textContent = productProcessedData.totalQuantity.toLocaleString();
    document.getElementById('productTotalRevenue').textContent = '¥' + productProcessedData.totalRevenue.toFixed(2);
    document.getElementById('productTotalProfit').textContent = '¥' + productProcessedData.totalProfit.toFixed(2);

    renderProductDailyChart();
    renderProductCategoryChart();
    renderProductCategoryProfitChart();
    renderTopProductsChart();
    renderTopProfitProductsChart();
    renderProfitRateChart();

    document.getElementById('productStatsOverview').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 商品每日趋势图
function renderProductDailyChart() {
    const chartDom = document.getElementById('productDailyChart');
    if (charts.productDaily) charts.productDaily.dispose();
    charts.productDaily = echarts.init(chartDom);

    const dates = Object.keys(productProcessedData.byDate).sort();
    const quantities = dates.map(d => productProcessedData.byDate[d].quantity);
    const revenues = dates.map(d => productProcessedData.byDate[d].revenue);
    const profits = dates.map(d => productProcessedData.byDate[d].profit);

    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: { data: ['销量', '营收', '利润'], textStyle: { color: '#a0aec0' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
            type: 'category',
            data: dates.map(d => d.substring(5)),
            axisLabel: { color: '#a0aec0', rotate: 45 },
            axisLine: { lineStyle: { color: '#4a5568' } }
        },
        yAxis: [
            { type: 'value', name: '销量', axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { lineStyle: { color: '#2d3748' } } },
            { type: 'value', name: '金额', axisLabel: { color: '#a0aec0', formatter: '¥{value}' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { show: false } }
        ],
        series: [
            { name: '销量', type: 'bar', data: quantities, itemStyle: { color: '#667eea' } },
            { name: '营收', type: 'line', yAxisIndex: 1, data: revenues, smooth: true, itemStyle: { color: '#48bb78' } },
            { name: '利润', type: 'line', yAxisIndex: 1, data: profits, smooth: true, itemStyle: { color: '#ed8936' } }
        ]
    };
    charts.productDaily.setOption(option);
}

// 商品分类销量分布
function renderProductCategoryChart() {
    const chartDom = document.getElementById('productCategoryChart');
    if (charts.productCategory) charts.productCategory.dispose();
    charts.productCategory = echarts.init(chartDom);

    const data = Object.entries(productProcessedData.byCategory)
        .map(([name, d]) => ({ name, value: d.quantity }))
        .sort((a, b) => b.value - a.value);

    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', formatter: '{b}: {c} 件 ({d}%)' },
        legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: '#a0aec0' } },
        series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['35%', '50%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 10, borderColor: '#1a202c', borderWidth: 2 },
            label: { show: false },
            emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
            data: data,
            color: ['#667eea', '#48bb78', '#ed8936', '#e53e3e', '#9f7aea', '#38b2ac', '#f6ad55', '#fc8181']
        }]
    };
    charts.productCategory.setOption(option);
}

// 商品分类利润分布
function renderProductCategoryProfitChart() {
    const chartDom = document.getElementById('productCategoryProfitChart');
    if (charts.productCategoryProfit) charts.productCategoryProfit.dispose();
    charts.productCategoryProfit = echarts.init(chartDom);

    const data = Object.entries(productProcessedData.byCategory)
        .map(([name, d]) => ({ name, value: Math.round(d.profit) }))
        .sort((a, b) => b.value - a.value);

    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
        legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: '#a0aec0' } },
        series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['35%', '50%'],
            roseType: 'radius',
            itemStyle: { borderRadius: 5 },
            label: { show: false },
            data: data,
            color: ['#48bb78', '#667eea', '#ed8936', '#e53e3e', '#9f7aea', '#38b2ac', '#f6ad55', '#fc8181']
        }]
    };
    charts.productCategoryProfit.setOption(option);
}

// TOP热销商品
function renderTopProductsChart() {
    const chartDom = document.getElementById('topProductsChart');
    if (charts.topProducts) charts.topProducts.dispose();
    charts.topProducts = echarts.init(chartDom);

    const products = Object.entries(productProcessedData.byProduct)
        .map(([name, d]) => ({ name, quantity: d.quantity, revenue: d.revenue }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 15)
        .reverse();

    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (params) => {
            const p = products[params[0].dataIndex];
            return `${p.name}<br/>销量: ${p.quantity}<br/>营收: ¥${p.revenue.toFixed(2)}`;
        }},
        grid: { left: '3%', right: '10%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value', axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { lineStyle: { color: '#2d3748' } } },
        yAxis: { type: 'category', data: products.map(p => p.name.length > 10 ? p.name.substring(0, 10) + '...' : p.name), axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } } },
        series: [{
            type: 'bar',
            data: products.map(p => p.quantity),
            itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#667eea' }, { offset: 1, color: '#48bb78' }] }, borderRadius: [0, 5, 5, 0] },
            label: { show: true, position: 'right', formatter: '{c}', color: '#a0aec0' }
        }]
    };
    charts.topProducts.setOption(option);
}

// TOP利润商品
function renderTopProfitProductsChart() {
    const chartDom = document.getElementById('topProfitProductsChart');
    if (charts.topProfitProducts) charts.topProfitProducts.dispose();
    charts.topProfitProducts = echarts.init(chartDom);

    const products = Object.entries(productProcessedData.byProduct)
        .map(([name, d]) => ({ name, profit: d.profit, quantity: d.quantity }))
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 15)
        .reverse();

    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (params) => {
            const p = products[params[0].dataIndex];
            return `${p.name}<br/>利润: ¥${p.profit.toFixed(2)}<br/>销量: ${p.quantity}`;
        }},
        grid: { left: '3%', right: '10%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value', axisLabel: { color: '#a0aec0', formatter: '¥{value}' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { lineStyle: { color: '#2d3748' } } },
        yAxis: { type: 'category', data: products.map(p => p.name.length > 10 ? p.name.substring(0, 10) + '...' : p.name), axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } } },
        series: [{
            type: 'bar',
            data: products.map(p => Math.round(p.profit)),
            itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#48bb78' }, { offset: 1, color: '#38a169' }] }, borderRadius: [0, 5, 5, 0] },
            label: { show: true, position: 'right', formatter: '¥{c}', color: '#a0aec0' }
        }]
    };
    charts.topProfitProducts.setOption(option);
}

// 利润率分析
function renderProfitRateChart() {
    const chartDom = document.getElementById('profitRateChart');
    if (charts.profitRate) charts.profitRate.dispose();
    charts.profitRate = echarts.init(chartDom);

    const data = productProcessedData.profitRateByCategory;

    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (params) => {
            const d = data.find(item => item.category === params[0].name);
            return `${d.category}<br/>利润率: ${d.profitRate}%<br/>利润: ¥${d.profit.toFixed(2)}<br/>营收: ¥${d.revenue.toFixed(2)}`;
        }},
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: data.map(d => d.category), axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } } },
        yAxis: { type: 'value', name: '利润率 (%)', axisLabel: { color: '#a0aec0', formatter: '{value}%' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { lineStyle: { color: '#2d3748' } } },
        series: [{
            type: 'bar',
            data: data.map(d => parseFloat(d.profitRate)),
            itemStyle: {
                color: (params) => {
                    const rate = params.value;
                    if (rate >= 50) return '#48bb78';
                    if (rate >= 30) return '#667eea';
                    if (rate >= 20) return '#ed8936';
                    return '#e53e3e';
                },
                borderRadius: [5, 5, 0, 0]
            },
            label: { show: true, position: 'top', formatter: '{c}%', color: '#a0aec0' }
        }]
    };
    charts.profitRate.setOption(option);
}
