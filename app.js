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
let syncDatePickerInstance = null;
let syncDateRange = { start: null, end: null };
let sessionSyncDatePickerInstance = null;
let sessionSyncDateRange = { start: null, end: null };
let unifiedSyncDatePickerInstance = null;
let unifiedSyncDateRange = { start: null, end: null };

// 充值记录数据存储
let rechargeAvailableDates = [];
let rechargeRawData = [];
let rechargeProcessedData = {};

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

// 统一日期范围
let unifiedDateRange = { start: null, end: null };
let unifiedDatePickerInstance = null;

// 座位分布数据
let seatMapDateRange = { start: null, end: null };
let seatUsageData = {};
let seatMapTooltip = null;
let seatMapDisplayMode = 'count'; // 'count' or 'utilization'
let seatMapTotalHours = 0; // 选定日期范围的总小时数

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    setupTabs();
    setupButtons();
    setupFileUpload();
    setupDragDrop();
    setupProductButtons();
    setupProductFileUpload();
    setupProductDragDrop();
    setupSyncButtons();
    setupSessionSyncButtons();
    setupDeleteButtons();
    setupAnalysisSubtabs();
    setupUserModals();
    window.addEventListener('resize', handleResize);

    // 测试数据库连接并加载日期数据
    await testConnection();
    await loadAvailableDates();
    await loadProductAvailableDates();
    await loadRechargeAvailableDates();
    initUnifiedDatePicker();
});

// 设置分析子标签页切换
function setupAnalysisSubtabs() {
    const subtabs = document.querySelectorAll('.analysis-subtab');
    subtabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchAnalysisSubtab(tab.dataset.subtab);
        });
    });

    // 设置sidebar子导航
    setupSidebarSubnav();
}

// 切换分析子标签页
function switchAnalysisSubtab(subtab) {
    // 切换顶部按钮状态
    document.querySelectorAll('.analysis-subtab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.analysis-subtab[data-subtab="${subtab}"]`)?.classList.add('active');

    // 切换sidebar子链接状态
    document.querySelectorAll('.sidebar-sublink').forEach(l => l.classList.remove('active'));
    document.querySelector(`.sidebar-sublink[data-subtab="${subtab}"]`)?.classList.add('active');

    // 切换子内容
    document.querySelectorAll('.analysis-subcontent').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(subtab + 'Subcontent')?.classList.add('active');

    // 如果切换到用户画像，确保渲染图表
    if (subtab === 'userProfile' && rawData.length > 0) {
        renderUserProfile();
    }

    // 如果切换到充值分析，确保渲染图表
    if (subtab === 'recharge' && rechargeRawData.length > 0) {
        renderRechargeAnalysis();
    }

    // 重新调整图表大小
    setTimeout(handleResize, 100);
}

// 设置sidebar子导航点击事件
function setupSidebarSubnav() {
    const sublinks = document.querySelectorAll('.sidebar-sublink');
    sublinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const subtab = link.dataset.subtab;
            switchAnalysisSubtab(subtab);
        });
    });
}

// 显示sidebar子导航
function showSidebarSubnav() {
    document.getElementById('analysisSidebarSubnav')?.classList.remove('hidden');
}

// 隐藏sidebar子导航
function hideSidebarSubnav() {
    document.getElementById('analysisSidebarSubnav')?.classList.add('hidden');
}

// 初始化统一日期选择器
function initUnifiedDatePicker() {
    const datesToMark = availableDates.map(d => d.date);

    unifiedDatePickerInstance = flatpickr('#unifiedDatePicker', {
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
                const dateInfo = availableDates.find(d => d.date === dateStr);
                if (dateInfo) {
                    dayElem.title = `${dateInfo.record_count} 条记录，¥${parseFloat(dateInfo.total_revenue).toFixed(0)}`;
                }
            }
        },
        onChange: function(selectedDates, dateStr, instance) {
            handleUnifiedDateSelection(selectedDates);
        }
    });

    // 如果有数据，默认选中最近有数据的日期范围
    if (availableDates.length > 0) {
        const defaultRange = getDefaultDateRange();
        if (defaultRange.length === 2) {
            unifiedDatePickerInstance.setDate(defaultRange);
            handleUnifiedDateSelection(defaultRange.map(d => new Date(d)));
        }
    }

    // 绑定加载按钮事件（只绑定一次）
    const loadUnifiedBtn = document.getElementById('loadUnifiedDataBtn');
    const loadAllBtn = document.getElementById('loadAllDataBtn');

    if (loadUnifiedBtn && !loadUnifiedBtn._listenerAdded) {
        loadUnifiedBtn.addEventListener('click', loadUnifiedData);
        loadUnifiedBtn._listenerAdded = true;
    }
    if (loadAllBtn && !loadAllBtn._listenerAdded) {
        loadAllBtn.addEventListener('click', loadAllData);
        loadAllBtn._listenerAdded = true;
    }
}

// 处理统一日期选择
function handleUnifiedDateSelection(selectedDates) {
    const loadBtn = document.getElementById('loadUnifiedDataBtn');
    const selectedRange = document.getElementById('unifiedSelectedRange');
    const rangeStats = document.getElementById('unifiedRangeStats');

    if (selectedDates.length === 0) {
        unifiedDateRange = { start: null, end: null };
        if (loadBtn) loadBtn.disabled = true;
        if (selectedRange) selectedRange.textContent = '请选择日期';
        if (rangeStats) rangeStats.textContent = '';
        return;
    }

    if (selectedDates.length === 1) {
        const dateStr = formatDate(selectedDates[0]);
        unifiedDateRange = { start: dateStr, end: dateStr };
        if (selectedRange) selectedRange.textContent = dateStr;
    } else {
        const startStr = formatDate(selectedDates[0]);
        const endStr = formatDate(selectedDates[1]);
        unifiedDateRange = { start: startStr, end: endStr };
        if (selectedRange) selectedRange.textContent = `${startStr} 至 ${endStr}`;
    }

    // 计算选中范围内的统计
    const stats = calculateRangeStats(unifiedDateRange.start, unifiedDateRange.end);
    if (rangeStats) {
        rangeStats.innerHTML = `<span>📊 ${stats.records} 条记录</span><span>💰 ¥${stats.revenue.toFixed(0)}</span>`;
    }

    if (loadBtn) loadBtn.disabled = false;
}

// 加载统一日期范围的所有数据
async function loadUnifiedData() {
    if (!unifiedDateRange.start || !unifiedDateRange.end) {
        alert('请选择日期范围');
        return;
    }

    const loadBtn = document.getElementById('loadUnifiedDataBtn');
    if (loadBtn) {
        loadBtn.disabled = true;
        loadBtn.innerHTML = '<span>⏳</span> 加载中...';
    }

    try {
        // 同步日期范围到其他组件
        selectedDateRange = { ...unifiedDateRange };
        selectedProductDateRange = { ...unifiedDateRange };
        seatMapDateRange = { ...unifiedDateRange };

        // 并行加载所有数据
        await Promise.all([
            loadDataByDateRange(unifiedDateRange.start, unifiedDateRange.end),
            loadProductDataByDateRange(unifiedDateRange.start, unifiedDateRange.end),
            loadSeatMapDataByRange(unifiedDateRange.start, unifiedDateRange.end),
            loadRechargeDataByDateRange(unifiedDateRange.start, unifiedDateRange.end)
        ]);

        // 显示子标签页区域和sidebar子导航
        document.getElementById('analysisSubtabsSection')?.classList.remove('hidden');
        showSidebarSubnav();

        // 处理用户画像数据并重新渲染
        processUserProfileData();

        // 处理充值数据
        processRechargeData();

        // 如果当前在用户画像页面，重新渲染图表
        const userProfileSubcontent = document.getElementById('userProfileSubcontent');
        if (userProfileSubcontent?.classList.contains('active')) {
            renderUserProfile();
        }

        // 如果当前在充值分析页面，重新渲染图表
        const rechargeSubcontent = document.getElementById('rechargeSubcontent');
        if (rechargeSubcontent?.classList.contains('active')) {
            renderRechargeAnalysis();
        }

    } catch (err) {
        console.error('加载数据失败:', err);
        alert('加载数据失败: ' + err.message);
    } finally {
        if (loadBtn) {
            loadBtn.disabled = false;
            loadBtn.innerHTML = '<span>📊</span> 加载选中日期数据';
        }
    }
}

// 加载全部数据
async function loadAllData() {
    const loadBtn = document.getElementById('loadAllDataBtn');
    if (loadBtn) {
        loadBtn.disabled = true;
        loadBtn.innerHTML = '<span>⏳</span> 加载中...';
    }

    try {
        // 加载所有日期的数据
        await Promise.all([
            loadAllSessionData(),
            loadAllProductData(),
            loadAllSeatMapData(),
            loadAllRechargeData()
        ]);

        // 显示子标签页区域和sidebar子导航
        document.getElementById('analysisSubtabsSection')?.classList.remove('hidden');
        showSidebarSubnav();

        // 处理用户画像数据并重新渲染
        processUserProfileData();

        // 处理充值数据
        processRechargeData();

        // 如果当前在用户画像页面，重新渲染图表
        const userProfileSubcontent = document.getElementById('userProfileSubcontent');
        if (userProfileSubcontent?.classList.contains('active')) {
            renderUserProfile();
        }

        // 如果当前在充值分析页面，重新渲染图表
        const rechargeSubcontent = document.getElementById('rechargeSubcontent');
        if (rechargeSubcontent?.classList.contains('active')) {
            renderRechargeAnalysis();
        }

    } catch (err) {
        console.error('加载数据失败:', err);
        alert('加载数据失败: ' + err.message);
    } finally {
        if (loadBtn) {
            loadBtn.disabled = false;
            loadBtn.innerHTML = '<span>📂</span> 加载全部数据';
        }
    }
}

// 按日期范围加载座位分布数据
async function loadSeatMapDataByRange(startDate, endDate) {
    // 确保 tooltip 已创建
    createSeatMapTooltip();

    // 计算选定日期范围的总小时数
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    seatMapTotalHours = daysDiff * 24;

    // 分页获取所有数据（Supabase 默认限制 1000 条）
    const PAGE_SIZE = 1000;
    let allData = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        // 使用 +08:00 时区（北京时间）与存储数据一致
        const { data, error } = await db
            .from('sessions')
            .select('machine, area, start_time, end_time, deposit_deducted, principal_deducted, bonus_deducted')
            .gte('start_time', `${startDate}T00:00:00+08:00`)
            .lte('start_time', `${endDate}T23:59:59+08:00`)
            .range(from, to);

        if (error) throw error;

        allData = allData.concat(data);
        hasMore = data.length === PAGE_SIZE;
        page++;
    }

    console.log(`座位图数据: 共加载 ${allData.length} 条记录`);

    // 处理数据
    processSeatData(allData);

    // 显示结果
    document.getElementById('seatMapStats')?.classList.remove('hidden');
    document.getElementById('seatMapContainer')?.classList.remove('hidden');
    document.getElementById('seatMapModeSwitch')?.classList.remove('hidden');

    // 绑定模式切换事件
    bindModeSwitchEvents();
}

// 加载全部座位分布数据
async function loadAllSeatMapData() {
    if (availableDates.length === 0) {
        return;
    }

    const dates = availableDates.map(d => d.date).sort();
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    await loadSeatMapDataByRange(startDate, endDate);
}

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
    // 旧的单独日期选择按钮已移除，统一使用 loadUnifiedDataBtn
    // 保留上传面板相关按钮

    // 关闭上传面板
    document.getElementById('closeUploadBtn')?.addEventListener('click', () => {
        document.getElementById('uploadSection')?.classList.add('hidden');
    });

    // 上传按钮
    document.getElementById('saveToDbBtn')?.addEventListener('click', saveToDatabase);
    document.getElementById('previewOnlyBtn')?.addEventListener('click', previewOnly);
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
    await loadDataByDateRange(selectedDateRange.start, selectedDateRange.end);
}

// 按日期范围加载上机数据
async function loadDataByDateRange(startDate, endDate) {
    try {
        console.log(`加载上机数据: ${startDate} 至 ${endDate}`);

        // 分页获取所有数据（Supabase 默认限制 1000 条）
        const PAGE_SIZE = 1000;
        let allData = [];
        let page = 0;
        let hasMore = true;

        while (hasMore) {
            const from = page * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            // 使用 +08:00 时区（北京时间）与存储数据一致
            const { data, error } = await db
                .from('sessions')
                .select('*')
                .gte('start_time', startDate + 'T00:00:00+08:00')
                .lte('start_time', endDate + 'T23:59:59+08:00')
                .order('start_time', { ascending: false })
                .range(from, to);

            if (error) throw error;

            allData = allData.concat(data);
            console.log(`第 ${page + 1} 页: 获取 ${data.length} 条记录`);

            // 如果返回的数据少于 PAGE_SIZE，说明没有更多数据了
            hasMore = data.length === PAGE_SIZE;
            page++;
        }

        const data = allData;
        console.log(`查询到 ${data.length} 条上机记录`);

        if (data.length === 0) {
            console.log('选中日期范围内没有上机数据');
            // 即使没有数据也要更新显示
            rawData = [];
            processData();
            processedData.dateRange = {
                start: new Date(startDate),
                end: new Date(endDate)
            };
            renderDashboard();
            return;
        }

        rawData = convertFromDb(data);
        processData();

        // 使用用户选择的日期范围，而不是从数据计算的范围
        processedData.dateRange = {
            start: new Date(startDate),
            end: new Date(endDate)
        };

        renderDashboard();
    } catch (err) {
        console.error('加载上机数据失败:', err);
        throw err;
    }
}

// 加载全部上机数据
async function loadAllSessionData() {
    try {
        // 分页获取所有数据（Supabase 默认限制 1000 条）
        const PAGE_SIZE = 1000;
        let allData = [];
        let page = 0;
        let hasMore = true;

        while (hasMore) {
            const from = page * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            const { data, error } = await db
                .from('sessions')
                .select('*')
                .order('start_time', { ascending: false })
                .range(from, to);

            if (error) throw error;

            allData = allData.concat(data);
            console.log(`加载全部数据 - 第 ${page + 1} 页: 获取 ${data.length} 条记录`);

            hasMore = data.length === PAGE_SIZE;
            page++;
        }

        if (allData.length === 0) {
            console.log('数据库中没有上机数据');
            return;
        }

        console.log(`共加载 ${allData.length} 条上机记录`);
        rawData = convertFromDb(allData);
        processData();
        renderDashboard();
    } catch (err) {
        console.error('加载上机数据失败:', err);
        throw err;
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
    if (unifiedDatePickerInstance) {
        unifiedDatePickerInstance.destroy();
        initUnifiedDatePicker();
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

// ===== 用户画像相关函数 =====

let userProfileData = {};
let allUsersMap = {}; // 存储所有用户详细数据，key为用户ID
let usersBySegment = {}; // 存储按RFM分层的用户列表

// 处理用户画像数据
function processUserProfileData() {
    if (rawData.length === 0) return;

    // 按用户分组统计
    const userStats = {};
    const userRecords = {}; // 存储每个用户的消费记录

    rawData.forEach(row => {
        const userId = row['卡号'];
        const name = row['姓名'];
        if (!userId) return;

        if (!userStats[userId]) {
            userStats[userId] = {
                name: name || '未知',
                cardType: row['卡类型'],
                age: row.age,
                sessions: 0,
                totalSpend: 0,
                principalSpend: 0,
                bonusSpend: 0,
                firstVisit: row.startTime,
                lastVisit: row.startTime,
                hours: {},
                areas: {},
                machines: []
            };
            userRecords[userId] = [];
        }

        userStats[userId].sessions++;
        const principal = parseFloat(row['扣除本金']) || 0;
        const bonus = parseFloat(row['扣除赠送']) || 0;
        userStats[userId].totalSpend += principal + bonus;
        userStats[userId].principalSpend += principal;
        userStats[userId].bonusSpend += bonus;

        // 记录区域偏好
        const area = row['区域'] || '未知';
        userStats[userId].areas[area] = (userStats[userId].areas[area] || 0) + 1;

        // 记录机器
        if (row['机器'] && !userStats[userId].machines.includes(row['机器'])) {
            userStats[userId].machines.push(row['机器']);
        }

        // 保存消费记录
        userRecords[userId].push({
            date: row.startTime ? formatDate(row.startTime) : '-',
            time: row.startTime ? `${row.startTime.getHours()}:${String(row.startTime.getMinutes()).padStart(2, '0')}` : '-',
            area: area,
            machine: row['机器'] || '-',
            spend: (principal + bonus).toFixed(2),
            duration: row['上机时间.1'] || '-'
        });

        if (row.startTime) {
            if (row.startTime < userStats[userId].firstVisit) {
                userStats[userId].firstVisit = row.startTime;
            }
            if (row.startTime > userStats[userId].lastVisit) {
                userStats[userId].lastVisit = row.startTime;
            }

            // 统计活跃时段（按上机时间段计算，而不只是开始时间）
            const startHour = row.startTime.getHours();
            if (row.endTime) {
                // 计算从开始到结束经过的所有小时
                let currentTime = new Date(row.startTime);
                const endTime = new Date(row.endTime);

                while (currentTime < endTime) {
                    const hour = currentTime.getHours();
                    userStats[userId].hours[hour] = (userStats[userId].hours[hour] || 0) + 1;
                    // 移动到下一个小时
                    currentTime.setHours(currentTime.getHours() + 1);
                    currentTime.setMinutes(0);
                    currentTime.setSeconds(0);
                }
            } else {
                // 如果没有结束时间，只统计开始时间
                userStats[userId].hours[startHour] = (userStats[userId].hours[startHour] || 0) + 1;
            }
        }
    });

    // 存储所有用户详细数据和消费记录
    allUsersMap = {};
    Object.entries(userStats).forEach(([id, data]) => {
        allUsersMap[id] = {
            ...data,
            id,
            records: userRecords[id] || []
        };
    });

    const users = Object.entries(userStats).map(([id, data]) => ({
        id,
        ...data
    }));

    // 计算统计数据
    const totalUsers = users.length;
    const totalSessions = rawData.length;
    const totalRevenue = users.reduce((sum, u) => sum + u.totalSpend, 0);

    // 新用户（只来过1次的）
    const newUsers = users.filter(u => u.sessions === 1).length;

    // 复购用户（来过2次以上的）
    const repeatUsers = users.filter(u => u.sessions >= 2).length;
    const repeatRate = totalUsers > 0 ? (repeatUsers / totalUsers * 100) : 0;

    // 人均消费
    const avgSpendPerUser = totalUsers > 0 ? totalRevenue / totalUsers : 0;

    // 会员类型分布
    const memberTypeDistribution = {};
    users.forEach(u => {
        const type = u.cardType || '未知';
        memberTypeDistribution[type] = (memberTypeDistribution[type] || 0) + 1;
    });

    // 年龄分布
    const ageDistribution = {
        '18岁以下': 0,
        '18-22岁': 0,
        '22-25岁': 0,
        '25-30岁': 0,
        '30-40岁': 0,
        '40岁以上': 0,
        '未知': 0
    };
    users.forEach(u => {
        const age = u.age;
        if (!age) ageDistribution['未知']++;
        else if (age < 18) ageDistribution['18岁以下']++;
        else if (age < 22) ageDistribution['18-22岁']++;
        else if (age < 25) ageDistribution['22-25岁']++;
        else if (age < 30) ageDistribution['25-30岁']++;
        else if (age < 40) ageDistribution['30-40岁']++;
        else ageDistribution['40岁以上']++;
    });

    // 消费频次分布
    const frequencyDistribution = {
        '1次': 0,
        '2-3次': 0,
        '4-5次': 0,
        '6-10次': 0,
        '11-20次': 0,
        '20次以上': 0
    };
    users.forEach(u => {
        const sessions = u.sessions;
        if (sessions === 1) frequencyDistribution['1次']++;
        else if (sessions <= 3) frequencyDistribution['2-3次']++;
        else if (sessions <= 5) frequencyDistribution['4-5次']++;
        else if (sessions <= 10) frequencyDistribution['6-10次']++;
        else if (sessions <= 20) frequencyDistribution['11-20次']++;
        else frequencyDistribution['20次以上']++;
    });

    // 消费金额分布
    const spendDistribution = {
        '¥0-50': 0,
        '¥50-100': 0,
        '¥100-200': 0,
        '¥200-500': 0,
        '¥500-1000': 0,
        '¥1000以上': 0
    };
    users.forEach(u => {
        const spend = u.totalSpend;
        if (spend < 50) spendDistribution['¥0-50']++;
        else if (spend < 100) spendDistribution['¥50-100']++;
        else if (spend < 200) spendDistribution['¥100-200']++;
        else if (spend < 500) spendDistribution['¥200-500']++;
        else if (spend < 1000) spendDistribution['¥500-1000']++;
        else spendDistribution['¥1000以上']++;
    });

    // 活跃时段分布（聚合所有用户）
    const activeHours = Array(24).fill(0);
    users.forEach(u => {
        Object.entries(u.hours).forEach(([hour, count]) => {
            activeHours[parseInt(hour)] += count;
        });
    });

    // TOP消费金额用户
    const topSpendUsers = [...users]
        .sort((a, b) => b.totalSpend - a.totalSpend)
        .slice(0, 20);

    // TOP消费频次用户
    const topFreqUsers = [...users]
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 20);

    // 用户价值分层 (简化的RFM模型)
    const rfmSegments = {
        '高价值用户': 0,      // 高频高消费
        '潜力用户': 0,        // 中频中消费
        '新用户': 0,          // 低频低消费但近期活跃
        '流失风险用户': 0,    // 之前高频但近期不活跃
        '普通用户': 0         // 其他
    };

    // 重置分层用户列表
    usersBySegment = {
        '高价值用户': [],
        '潜力用户': [],
        '新用户': [],
        '流失风险用户': [],
        '普通用户': []
    };

    const now = new Date();
    const avgSessions = totalSessions / totalUsers;
    const avgSpend = totalRevenue / totalUsers;

    users.forEach(u => {
        const daysSinceLastVisit = (now - u.lastVisit) / (1000 * 60 * 60 * 24);
        const isRecent = daysSinceLastVisit < 30;
        const isHighFreq = u.sessions > avgSessions * 1.5;
        const isHighSpend = u.totalSpend > avgSpend * 1.5;

        let segment = '普通用户';
        if (isHighFreq && isHighSpend) {
            segment = '高价值用户';
        } else if (u.sessions >= 3 && u.totalSpend >= avgSpend * 0.8) {
            segment = '潜力用户';
        } else if (u.sessions === 1 && isRecent) {
            segment = '新用户';
        } else if (isHighFreq && !isRecent) {
            segment = '流失风险用户';
        }

        rfmSegments[segment]++;
        usersBySegment[segment].push(u);
    });

    userProfileData = {
        totalUsers,
        newUsers,
        repeatRate,
        avgSpendPerUser,
        memberTypeDistribution,
        ageDistribution,
        frequencyDistribution,
        spendDistribution,
        activeHours,
        topSpendUsers,
        topFreqUsers,
        rfmSegments
    };
}

// 渲染用户画像
function renderUserProfile() {
    if (Object.keys(userProfileData).length === 0) {
        processUserProfileData();
    }

    if (Object.keys(userProfileData).length === 0) return;

    // 显示统计卡片和图表区域
    document.getElementById('userProfileStats')?.classList.remove('hidden');
    document.getElementById('userProfileChartsSection')?.classList.remove('hidden');

    // 更新统计卡片
    document.getElementById('userTotalCount').textContent = userProfileData.totalUsers.toLocaleString();
    document.getElementById('userNewCount').textContent = userProfileData.newUsers.toLocaleString();
    document.getElementById('userRepeatRate').textContent = userProfileData.repeatRate.toFixed(1) + '%';
    document.getElementById('userAvgSpend').textContent = '¥' + userProfileData.avgSpendPerUser.toFixed(2);

    // 渲染图表
    renderUserMemberTypeChart();
    renderUserAgeDistChart();
    renderUserFrequencyChart();
    renderUserSpendDistChart();
    renderUserActiveHoursChart();
    renderTopSpendUsersChart();
    renderTopFreqUsersChart();
    renderUserRFMChart();
}

// 会员类型分布图表
function renderUserMemberTypeChart() {
    const chartDom = document.getElementById('userMemberTypeChart');
    if (!chartDom) return;
    if (charts.userMemberType) charts.userMemberType.dispose();
    charts.userMemberType = echarts.init(chartDom);

    const data = Object.entries(userProfileData.memberTypeDistribution)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', formatter: '{b}: {c}人 ({d}%)' },
        legend: { orient: 'vertical', right: '5%', top: 'center', textStyle: { color: '#a0aec0' } },
        series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['35%', '50%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 10, borderColor: '#1a1a2e', borderWidth: 2 },
            label: { show: false },
            labelLine: { show: false },
            data: data
        }]
    };
    charts.userMemberType.setOption(option);
}

// 年龄分布图表
function renderUserAgeDistChart() {
    const chartDom = document.getElementById('userAgeDistChart');
    if (!chartDom) return;
    if (charts.userAgeDist) charts.userAgeDist.dispose();
    charts.userAgeDist = echarts.init(chartDom);

    const labels = Object.keys(userProfileData.ageDistribution).filter(k => k !== '未知');
    const values = labels.map(k => userProfileData.ageDistribution[k]);

    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', formatter: '{b}<br/>用户数: {c}人' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: labels, axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } } },
        yAxis: { type: 'value', axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { lineStyle: { color: '#2d3748' } } },
        series: [{
            type: 'bar',
            data: values,
            itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#ff00aa' }, { offset: 1, color: '#667eea' }] } }
        }]
    };
    charts.userAgeDist.setOption(option);
}

// 消费频次分布图表
function renderUserFrequencyChart() {
    const chartDom = document.getElementById('userFrequencyChart');
    if (!chartDom) return;
    if (charts.userFrequency) charts.userFrequency.dispose();
    charts.userFrequency = echarts.init(chartDom);

    const data = Object.entries(userProfileData.frequencyDistribution)
        .map(([name, value]) => ({ name, value }));

    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', formatter: '{b}: {c}人 ({d}%)' },
        legend: { orient: 'vertical', right: '5%', top: 'center', textStyle: { color: '#a0aec0' } },
        series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['35%', '50%'],
            roseType: 'radius',
            itemStyle: { borderRadius: 5 },
            label: { show: false },
            data: data
        }]
    };
    charts.userFrequency.setOption(option);
}

// 消费金额分布图表
function renderUserSpendDistChart() {
    const chartDom = document.getElementById('userSpendDistChart');
    if (!chartDom) return;
    if (charts.userSpendDist) charts.userSpendDist.dispose();
    charts.userSpendDist = echarts.init(chartDom);

    const labels = Object.keys(userProfileData.spendDistribution);
    const values = labels.map(k => userProfileData.spendDistribution[k]);

    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', formatter: '{b}<br/>用户数: {c}人' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: labels, axisLabel: { color: '#a0aec0', rotate: 30 }, axisLine: { lineStyle: { color: '#4a5568' } } },
        yAxis: { type: 'value', axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { lineStyle: { color: '#2d3748' } } },
        series: [{
            type: 'bar',
            data: values,
            itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#48bb78' }, { offset: 1, color: '#38a169' }] } }
        }]
    };
    charts.userSpendDist.setOption(option);
}

// 活跃时段分布图表
function renderUserActiveHoursChart() {
    const chartDom = document.getElementById('userActiveHoursChart');
    if (!chartDom) return;
    if (charts.userActiveHours) charts.userActiveHours.dispose();
    charts.userActiveHours = echarts.init(chartDom);

    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);

    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', formatter: '{b}<br/>上机人次: {c}' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: hours, axisLabel: { color: '#a0aec0', interval: 2 }, axisLine: { lineStyle: { color: '#4a5568' } } },
        yAxis: { type: 'value', axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { lineStyle: { color: '#2d3748' } } },
        series: [{
            type: 'line',
            data: userProfileData.activeHours,
            smooth: true,
            areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(0, 240, 255, 0.3)' }, { offset: 1, color: 'rgba(0, 240, 255, 0)' }] } },
            itemStyle: { color: '#00f0ff' },
            lineStyle: { color: '#00f0ff', width: 2 }
        }]
    };
    charts.userActiveHours.setOption(option);
}

// TOP消费金额用户图表
function renderTopSpendUsersChart() {
    const chartDom = document.getElementById('topSpendUsersChart');
    if (!chartDom) return;
    if (charts.topSpendUsers) charts.topSpendUsers.dispose();
    charts.topSpendUsers = echarts.init(chartDom);

    const users = userProfileData.topSpendUsers.slice().reverse();

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params) => {
                const user = users[params[0].dataIndex];
                return `${user.name}<br/>消费总额: ¥${user.totalSpend.toFixed(2)}<br/>上机次数: ${user.sessions}次<br/><span style="color: #00f0ff;">点击查看详情</span>`;
            }
        },
        grid: { left: '3%', right: '15%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value', axisLabel: { color: '#a0aec0', formatter: '¥{value}' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { lineStyle: { color: '#2d3748' } } },
        yAxis: { type: 'category', data: users.map(u => u.name), axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } } },
        series: [{
            type: 'bar',
            data: users.map(u => u.totalSpend.toFixed(2)),
            itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#ffd700' }, { offset: 1, color: '#ff8c00' }] }, borderRadius: [0, 5, 5, 0] },
            label: { show: true, position: 'right', formatter: '¥{c}', color: '#a0aec0' }
        }]
    };
    charts.topSpendUsers.setOption(option);

    // 添加点击事件
    charts.topSpendUsers.on('click', (params) => {
        const user = users[params.dataIndex];
        if (user && user.id) {
            showUserDetailModal(user.id);
        }
    });
}

// TOP消费频次用户图表
function renderTopFreqUsersChart() {
    const chartDom = document.getElementById('topFreqUsersChart');
    if (!chartDom) return;
    if (charts.topFreqUsers) charts.topFreqUsers.dispose();
    charts.topFreqUsers = echarts.init(chartDom);

    const users = userProfileData.topFreqUsers.slice().reverse();

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params) => {
                const user = users[params[0].dataIndex];
                return `${user.name}<br/>上机次数: ${user.sessions}次<br/>消费总额: ¥${user.totalSpend.toFixed(2)}<br/><span style="color: #00f0ff;">点击查看详情</span>`;
            }
        },
        grid: { left: '3%', right: '12%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value', axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { lineStyle: { color: '#2d3748' } } },
        yAxis: { type: 'category', data: users.map(u => u.name), axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } } },
        series: [{
            type: 'bar',
            data: users.map(u => u.sessions),
            itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#667eea' }, { offset: 1, color: '#48bb78' }] }, borderRadius: [0, 5, 5, 0] },
            label: { show: true, position: 'right', formatter: '{c}次', color: '#a0aec0' }
        }]
    };
    charts.topFreqUsers.setOption(option);

    // 添加点击事件
    charts.topFreqUsers.on('click', (params) => {
        const user = users[params.dataIndex];
        if (user && user.id) {
            showUserDetailModal(user.id);
        }
    });
}

// 用户价值分层图表
function renderUserRFMChart() {
    const chartDom = document.getElementById('userRFMChart');
    if (!chartDom) return;
    if (charts.userRFM) charts.userRFM.dispose();
    charts.userRFM = echarts.init(chartDom);

    const data = Object.entries(userProfileData.rfmSegments)
        .map(([name, value]) => ({ name, value }))
        .filter(d => d.value > 0);

    const colors = {
        '高价值用户': '#ffd700',
        '潜力用户': '#48bb78',
        '新用户': '#00f0ff',
        '流失风险用户': '#ff4757',
        '普通用户': '#667eea'
    };

    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', formatter: '{b}: {c}人 ({d}%)' },
        legend: { orient: 'horizontal', bottom: '5%', textStyle: { color: '#a0aec0' } },
        series: [{
            type: 'pie',
            radius: ['30%', '60%'],
            center: ['50%', '45%'],
            itemStyle: { borderRadius: 10, borderColor: '#1a1a2e', borderWidth: 2 },
            label: {
                show: true,
                formatter: '{b}\n{c}人',
                color: '#a0aec0'
            },
            labelLine: { lineStyle: { color: '#4a5568' } },
            data: data.map(d => ({
                ...d,
                itemStyle: { color: colors[d.name] || '#667eea' }
            }))
        }]
    };
    charts.userRFM.setOption(option);

    // 添加点击事件 - 更新右侧用户列表
    charts.userRFM.on('click', (params) => {
        if (params.name && usersBySegment[params.name]) {
            updateRFMUserList(params.name, usersBySegment[params.name]);
        }
    });
}

// 更新RFM用户列表面板
function updateRFMUserList(segment, users) {
    const titleEl = document.getElementById('rfmUserListTitle');
    const countEl = document.getElementById('rfmUserCount');
    const listEl = document.getElementById('rfmUserList');

    if (!listEl) return;

    // 更新标题和数量
    if (titleEl) titleEl.textContent = segment;
    if (countEl) countEl.textContent = `${users.length}人`;

    // 按消费金额排序
    const sortedUsers = [...users].sort((a, b) => b.totalSpend - a.totalSpend);

    // 生成用户列表HTML
    listEl.innerHTML = sortedUsers.map((user, index) => `
        <div class="rfm-user-item" onclick="showUserDetailModal('${user.id}')">
            <div class="rfm-user-item-rank">${index + 1}</div>
            <div class="rfm-user-item-info">
                <div class="rfm-user-item-name">${user.name}</div>
                <div class="rfm-user-item-meta">${user.cardType || '未知'} · ${user.sessions}次</div>
            </div>
            <div class="rfm-user-item-value">¥${user.totalSpend.toFixed(0)}</div>
        </div>
    `).join('');
}

// ===== 用户弹窗交互函数 =====

// 显示用户列表弹窗
function showUserListModal(title, users) {
    const modal = document.getElementById('userListModal');
    const modalTitle = document.getElementById('userListModalTitle');
    const modalBody = document.getElementById('userListModalBody');

    if (!modal || !modalBody) return;

    modalTitle.textContent = `${title} (${users.length}人)`;

    // 按消费金额排序
    const sortedUsers = [...users].sort((a, b) => b.totalSpend - a.totalSpend);

    modalBody.innerHTML = sortedUsers.map((user, index) => `
        <div class="user-list-item" onclick="showUserDetailModal('${user.id}')">
            <div class="user-list-item-rank">${index + 1}</div>
            <div class="user-list-item-info">
                <div class="user-list-item-name">${user.name}</div>
                <div class="user-list-item-meta">${user.cardType || '未知'} · ${user.sessions}次消费</div>
            </div>
            <div class="user-list-item-value">¥${user.totalSpend.toFixed(2)}</div>
        </div>
    `).join('');

    modal.classList.remove('hidden');
}

// 关闭用户列表弹窗
function closeUserListModal() {
    document.getElementById('userListModal')?.classList.add('hidden');
}

// 显示用户详情弹窗
function showUserDetailModal(userId) {
    const user = allUsersMap[userId];
    if (!user) return;

    const modal = document.getElementById('userDetailModal');
    const modalTitle = document.getElementById('userDetailModalTitle');
    const basicInfo = document.getElementById('userBasicInfo');
    const spendStats = document.getElementById('userSpendStats');
    const userRecords = document.getElementById('userRecords');

    if (!modal) return;

    modalTitle.textContent = user.name;

    // 获取最常去的区域
    const favoriteArea = Object.entries(user.areas || {})
        .sort((a, b) => b[1] - a[1])[0];

    // 获取最活跃的时段
    const favoriteHour = Object.entries(user.hours || {})
        .sort((a, b) => b[1] - a[1])[0];

    // 基本信息
    basicInfo.innerHTML = `
        <div class="user-detail-item">
            <span class="user-detail-label">会员类型</span>
            <span class="user-detail-value">${user.cardType || '未知'}</span>
        </div>
        <div class="user-detail-item">
            <span class="user-detail-label">年龄</span>
            <span class="user-detail-value">${user.age ? user.age + '岁' : '未知'}</span>
        </div>
        <div class="user-detail-item">
            <span class="user-detail-label">首次消费</span>
            <span class="user-detail-value">${user.firstVisit ? formatDate(user.firstVisit) : '-'}</span>
        </div>
        <div class="user-detail-item">
            <span class="user-detail-label">最近消费</span>
            <span class="user-detail-value">${user.lastVisit ? formatDate(user.lastVisit) : '-'}</span>
        </div>
    `;

    // 消费统计
    const avgPerVisit = user.sessions > 0 ? user.totalSpend / user.sessions : 0;
    spendStats.innerHTML = `
        <div class="user-stat-card">
            <div class="user-stat-value">${user.sessions}</div>
            <div class="user-stat-label">消费次数</div>
        </div>
        <div class="user-stat-card">
            <div class="user-stat-value">¥${user.totalSpend.toFixed(0)}</div>
            <div class="user-stat-label">总消费</div>
        </div>
        <div class="user-stat-card">
            <div class="user-stat-value">¥${avgPerVisit.toFixed(0)}</div>
            <div class="user-stat-label">次均消费</div>
        </div>
        <div class="user-stat-card">
            <div class="user-stat-value">${user.machines?.length || 0}</div>
            <div class="user-stat-label">使用机器数</div>
        </div>
    `;

    // 消费记录
    const records = user.records || [];
    const recentRecords = records.slice(0, 10); // 只显示最近10条

    userRecords.innerHTML = `
        <div class="user-record-item">
            <span>日期</span>
            <span>区域/机器</span>
            <span>时长</span>
            <span>消费</span>
        </div>
        ${recentRecords.map(r => `
            <div class="user-record-item">
                <span>${r.date}</span>
                <span>${r.area}/${r.machine}</span>
                <span>${r.duration}</span>
                <span>¥${r.spend}</span>
            </div>
        `).join('')}
        ${records.length > 10 ? `<div style="text-align: center; color: var(--text-muted); padding: 10px;">还有 ${records.length - 10} 条记录...</div>` : ''}
    `;

    modal.classList.remove('hidden');

    // 延迟渲染图表（确保modal已显示）
    setTimeout(() => {
        renderUserHourPreferenceChart(user);
        renderUserAreaPreferenceChart(user);
    }, 100);
}

// 渲染用户上机时间偏好图表
function renderUserHourPreferenceChart(user) {
    const chartDom = document.getElementById('userHourPreferenceChart');
    if (!chartDom) return;

    if (charts.userHourPreference) charts.userHourPreference.dispose();
    charts.userHourPreference = echarts.init(chartDom);

    // 生成24小时数据
    const hourData = Array(24).fill(0);
    Object.entries(user.hours || {}).forEach(([hour, count]) => {
        hourData[parseInt(hour)] = count;
    });

    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            formatter: '{b}<br/>上机次数: {c}次'
        },
        grid: { left: '8%', right: '5%', top: '15%', bottom: '15%' },
        xAxis: {
            type: 'category',
            data: hours,
            axisLabel: { color: '#a0aec0', fontSize: 10, interval: 3 },
            axisLine: { lineStyle: { color: '#4a5568' } }
        },
        yAxis: {
            type: 'value',
            axisLabel: { color: '#a0aec0', fontSize: 10 },
            axisLine: { lineStyle: { color: '#4a5568' } },
            splitLine: { lineStyle: { color: '#2d3748' } }
        },
        series: [{
            type: 'line',
            data: hourData,
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(0, 240, 255, 0.3)' },
                        { offset: 1, color: 'rgba(0, 240, 255, 0)' }
                    ]
                }
            },
            itemStyle: { color: '#00f0ff' },
            lineStyle: { color: '#00f0ff', width: 2 }
        }]
    };

    charts.userHourPreference.setOption(option);
}

// 渲染用户区域偏好图表
function renderUserAreaPreferenceChart(user) {
    const chartDom = document.getElementById('userAreaPreferenceChart');
    if (!chartDom) return;

    if (charts.userAreaPreference) charts.userAreaPreference.dispose();
    charts.userAreaPreference = echarts.init(chartDom);

    const areaData = Object.entries(user.areas || {})
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    if (areaData.length === 0) {
        chartDom.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);">暂无区域数据</div>';
        return;
    }

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c}次 ({d}%)'
        },
        series: [{
            type: 'pie',
            radius: ['35%', '65%'],
            center: ['50%', '50%'],
            avoidLabelOverlap: true,
            itemStyle: {
                borderRadius: 6,
                borderColor: '#1a1a2e',
                borderWidth: 2
            },
            label: {
                show: true,
                formatter: '{b}\n{c}次',
                fontSize: 10,
                color: '#a0aec0'
            },
            labelLine: {
                lineStyle: { color: '#4a5568' }
            },
            data: areaData.map((d, i) => ({
                ...d,
                itemStyle: {
                    color: ['#00f0ff', '#ff00aa', '#667eea', '#48bb78', '#ffd700'][i % 5]
                }
            }))
        }]
    };

    charts.userAreaPreference.setOption(option);
}

// 关闭用户详情弹窗
function closeUserDetailModal() {
    document.getElementById('userDetailModal')?.classList.add('hidden');
}

// 初始化用户弹窗事件
function setupUserModals() {
    // 关闭按钮事件
    document.getElementById('closeUserListModal')?.addEventListener('click', closeUserListModal);
    document.getElementById('closeUserDetailModal')?.addEventListener('click', closeUserDetailModal);

    // 点击遮罩层关闭
    document.getElementById('userListModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'userListModal') closeUserListModal();
    });
    document.getElementById('userDetailModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'userDetailModal') closeUserDetailModal();
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
    // 旧的单独日期选择按钮已移除，统一使用 loadUnifiedDataBtn
    // 保留上传面板相关按钮

    document.getElementById('closeProductUploadBtn')?.addEventListener('click', () => {
        document.getElementById('productUploadSection')?.classList.add('hidden');
    });

    document.getElementById('saveProductBtn')?.addEventListener('click', saveProductToDatabase);
    document.getElementById('previewProductBtn')?.addEventListener('click', previewProductOnly);
}

// 设置同步按钮事件（同步页面的按钮事件）
function setupSyncButtons() {
    // 这些按钮在 setupSessionSyncButtons 中统一设置
    document.getElementById('clearProductDataBtn')?.addEventListener('click', clearAllProductData);
}

// 清空全部商品数据
async function clearAllProductData() {
    if (!confirm('确定要清空全部商品数据吗？此操作不可恢复！')) {
        return;
    }

    addSyncLog('正在清空商品数据...', 'info');

    try {
        // 删除 product_sales 表中的所有数据
        const { error: salesError } = await db
            .from('product_sales')
            .delete()
            .gte('id', 0); // 删除所有记录

        if (salesError) throw salesError;

        // 删除 product_dates 表中的所有数据
        const { error: datesError } = await db
            .from('product_dates')
            .delete()
            .gte('date', '1970-01-01'); // 删除所有记录

        if (datesError) throw datesError;

        addSyncLog('商品数据已清空！', 'success');

        // 刷新日期数据
        await loadProductAvailableDates();

        // 同时刷新同步面板的日期选择器
        if (syncDatePickerInstance) {
            syncDatePickerInstance.destroy();
            initSyncDatePicker();
        }

    } catch (error) {
        addSyncLog(`清空数据失败: ${error.message}`, 'error');
    }
}

// 初始化同步日期选择器（使用两个独立的日期输入框）
function initSyncDatePicker() {
    initProductSyncDatePicker();
}

// 初始化商品同步日期选择器
function initProductSyncDatePicker() {
    // 默认选择最近 7 天
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);

    // 已有数据的日期列表
    const datesToMark = productAvailableDates.map(d => d.date);

    // 开始日期选择器
    flatpickr('#productSyncStartDate', {
        dateFormat: 'Y-m-d',
        locale: 'zh',
        defaultDate: weekAgo,
        maxDate: today,
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            const dateStr = dayElem.dateObj.toISOString().split('T')[0];
            if (datesToMark.includes(dateStr)) {
                dayElem.classList.add('has-data');
                dayElem.title = '已有数据';
            }
        },
        onChange: function(selectedDates) {
            if (selectedDates.length > 0) {
                syncDateRange.start = formatDate(selectedDates[0]);
                updateProductSyncButtonState();
            }
        }
    });

    // 结束日期选择器
    flatpickr('#productSyncEndDate', {
        dateFormat: 'Y-m-d',
        locale: 'zh',
        defaultDate: today,
        maxDate: today,
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            const dateStr = dayElem.dateObj.toISOString().split('T')[0];
            if (datesToMark.includes(dateStr)) {
                dayElem.classList.add('has-data');
                dayElem.title = '已有数据';
            }
        },
        onChange: function(selectedDates) {
            if (selectedDates.length > 0) {
                syncDateRange.end = formatDate(selectedDates[0]);
                updateProductSyncButtonState();
            }
        }
    });

    // 设置默认值
    syncDateRange = {
        start: formatDate(weekAgo),
        end: formatDate(today)
    };
    updateProductSyncButtonState();

    // 初始化删除日期选择器
    initProductDeleteDatePickers();

    // 绑定删除按钮事件（确保 DOM 元素可用时绑定）
    setupProductDeleteButtons();
}

// 设置商品删除按钮事件
function setupProductDeleteButtons() {
    console.log('setupProductDeleteButtons called');
    const rangeBtn = document.getElementById('deleteProductRangeBtn');
    const allBtn = document.getElementById('deleteAllProductBtn');

    console.log('Product delete buttons:', { rangeBtn: !!rangeBtn, allBtn: !!allBtn });

    if (rangeBtn && !rangeBtn._listenerAdded) {
        rangeBtn.addEventListener('click', deleteProductDataByRange);
        rangeBtn._listenerAdded = true;
        console.log('Product range delete listener added');
    }
    if (allBtn && !allBtn._listenerAdded) {
        allBtn.addEventListener('click', deleteAllProductData);
        allBtn._listenerAdded = true;
        console.log('Product all delete listener added');
    }
}

// 更新商品同步按钮状态
function updateProductSyncButtonState() {
    const startBtn = document.getElementById('startProductSyncBtn');
    if (startBtn) {
        startBtn.disabled = !(syncDateRange.start && syncDateRange.end);
    }
}

// 添加同步日志
function addSyncLog(message, type = 'info') {
    const logDiv = document.getElementById('syncLog');
    // 日志元素不存在时只输出到控制台
    console.log(`[Sync ${type}] ${message}`);
    if (!logDiv) return;

    logDiv.classList.remove('hidden');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
}

// 清空同步日志
function clearSyncLog() {
    const logDiv = document.getElementById('syncLog');
    if (!logDiv) return;
    logDiv.innerHTML = '';
    logDiv.classList.add('hidden');
}

// 检查某个日期是否已有数据
function hasDataForDate(date) {
    return productAvailableDates.some(d => d.date === date);
}

// 开始 API 同步
async function startApiSync() {
    if (!syncDateRange.start || !syncDateRange.end) {
        alert('请先选择同步日期范围');
        return;
    }

    const startBtn = document.getElementById('startProductSyncBtn');
    const progressDiv = document.getElementById('productSyncProgress');
    const progressFill = document.getElementById('productSyncProgressFill');
    const progressText = document.getElementById('productSyncProgressText');
    const resultDiv = document.getElementById('productSyncResult');

    startBtn.disabled = true;
    progressDiv.classList.remove('hidden');
    resultDiv.classList.add('hidden');

    addSyncLog(`开始同步 ${syncDateRange.start} 至 ${syncDateRange.end} 的数据`, 'info');

    try {
        // 1. 生成日期列表
        const allDates = generateDateRange(syncDateRange.start, syncDateRange.end);

        // 2. 过滤出没有数据的日期
        const datesToSync = allDates.filter(date => !hasDataForDate(date));
        const skippedDates = allDates.length - datesToSync.length;

        if (skippedDates > 0) {
            addSyncLog(`跳过 ${skippedDates} 天（已有数据）`, 'info');
        }

        if (datesToSync.length === 0) {
            progressFill.style.width = '100%';
            progressText.textContent = '无需同步';
            resultDiv.classList.remove('hidden');
            resultDiv.className = 'sync-result success';
            resultDiv.innerHTML = `
                <h3>无需同步</h3>
                <p>所选日期范围内的数据都已存在</p>
            `;
            startBtn.disabled = false;
            return;
        }

        addSyncLog(`需要同步 ${datesToSync.length} 天的数据`, 'info');

        // 3. 登录获取 Token
        addSyncLog('正在登录...', 'info');
        progressText.textContent = '正在登录...';
        progressFill.style.width = '10%';

        const token = await login();
        addSyncLog('登录成功！', 'success');

        let totalProducts = 0;
        let syncedDays = 0;

        // 4. 逐日同步（只同步没有数据的日期）
        for (let i = 0; i < datesToSync.length; i++) {
            const date = datesToSync[i];
            addSyncLog(`处理 ${date}...`, 'info');
            progressText.textContent = `同步中... ${i + 1}/${datesToSync.length} 天`;
            progressFill.style.width = `${10 + (i / datesToSync.length) * 80}%`;

            // 获取当天数据
            const orders = await fetchAllSales(token, date, date);

            if (orders.length === 0) {
                addSyncLog(`${date}: 无订单数据`, 'info');
                continue;
            }

            // 转换数据
            const products = transformOrdersToProducts(orders, date);
            addSyncLog(`${date}: 获取到 ${orders.length} 个订单，${products.length} 种商品`, 'info');

            // 保存到数据库
            const saved = await saveToSupabase(products, date);
            totalProducts += saved;
            syncedDays++;
            addSyncLog(`${date}: 已保存 ${saved} 种商品`, 'success');
        }

        progressFill.style.width = '100%';
        progressText.textContent = '同步完成！';

        // 显示结果
        resultDiv.classList.remove('hidden');
        resultDiv.className = 'sync-result success';
        resultDiv.innerHTML = `
            <h3>同步成功</h3>
            <div class="stat-highlight">${totalProducts} 种商品</div>
            <p>共同步 ${syncedDays} 天数据</p>
            <p>${syncDateRange.start} 至 ${syncDateRange.end}</p>
        `;

        // 刷新商品日期数据
        await loadProductAvailableDates();

    } catch (error) {
        progressText.textContent = '同步失败';
        resultDiv.classList.remove('hidden');
        resultDiv.className = 'sync-result error';
        resultDiv.innerHTML = `
            <h3>同步失败</h3>
            <p>${error.message}</p>
        `;
    } finally {
        startBtn.disabled = false;
    }
}

// =====================================================
// 上机数据 API 同步功能
// =====================================================

// 设置上机同步按钮事件
function setupSessionSyncButtons() {
    document.getElementById('startSessionSyncBtn')?.addEventListener('click', startSessionApiSync);
    document.getElementById('startProductSyncBtn')?.addEventListener('click', startApiSync);
    document.getElementById('clearSessionDataBtn')?.addEventListener('click', clearAllSessionData);
}

// 清空全部上机数据
async function clearAllSessionData() {
    if (!confirm('确定要清空全部上机数据吗？此操作不可恢复！')) {
        return;
    }

    addSessionSyncLog('正在清空上机数据...', 'info');

    try {
        // 删除 sessions 表中的所有数据
        const { error: sessionsError } = await db
            .from('sessions')
            .delete()
            .gte('id', 0);

        if (sessionsError) throw sessionsError;

        // 删除 session_dates 表中的所有数据
        const { error: datesError } = await db
            .from('session_dates')
            .delete()
            .gte('date', '1970-01-01');

        if (datesError) throw datesError;

        addSessionSyncLog('上机数据已清空！', 'success');

        // 刷新日期数据
        await loadAvailableDates();
        if (unifiedDatePickerInstance) {
            unifiedDatePickerInstance.destroy();
            initUnifiedDatePicker();
        }

        // 刷新同步面板的日期选择器
        if (sessionSyncDatePickerInstance) {
            sessionSyncDatePickerInstance.destroy();
            initSessionSyncDatePicker();
        }

    } catch (error) {
        addSessionSyncLog(`清空数据失败: ${error.message}`, 'error');
    }
}

// 初始化上机同步日期选择器（使用两个独立的日期输入框）
function initSessionSyncDatePicker() {
    // 默认选择最近 7 天
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);

    // 已有数据的日期列表
    const datesToMark = availableDates.map(d => d.date);

    // 开始日期选择器
    flatpickr('#sessionSyncStartDate', {
        dateFormat: 'Y-m-d',
        locale: 'zh',
        defaultDate: weekAgo,
        maxDate: today,
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            const dateStr = dayElem.dateObj.toISOString().split('T')[0];
            if (datesToMark.includes(dateStr)) {
                dayElem.classList.add('has-data');
                dayElem.title = '已有数据';
            }
        },
        onChange: function(selectedDates) {
            if (selectedDates.length > 0) {
                sessionSyncDateRange.start = formatDate(selectedDates[0]);
                updateSessionSyncButtonState();
            }
        }
    });

    // 结束日期选择器
    flatpickr('#sessionSyncEndDate', {
        dateFormat: 'Y-m-d',
        locale: 'zh',
        defaultDate: today,
        maxDate: today,
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            const dateStr = dayElem.dateObj.toISOString().split('T')[0];
            if (datesToMark.includes(dateStr)) {
                dayElem.classList.add('has-data');
                dayElem.title = '已有数据';
            }
        },
        onChange: function(selectedDates) {
            if (selectedDates.length > 0) {
                sessionSyncDateRange.end = formatDate(selectedDates[0]);
                updateSessionSyncButtonState();
            }
        }
    });

    // 设置默认值
    sessionSyncDateRange = {
        start: formatDate(weekAgo),
        end: formatDate(today)
    };
    updateSessionSyncButtonState();

    // 初始化删除日期选择器
    initSessionDeleteDatePickers();

    // 绑定删除按钮事件（确保 DOM 元素可用时绑定）
    setupSessionDeleteButtons();
}

// 设置上机删除按钮事件
function setupSessionDeleteButtons() {
    console.log('setupSessionDeleteButtons called');
    const rangeBtn = document.getElementById('deleteSessionRangeBtn');
    const allBtn = document.getElementById('deleteAllSessionBtn');

    console.log('Session delete buttons:', { rangeBtn: !!rangeBtn, allBtn: !!allBtn });

    if (rangeBtn && !rangeBtn._listenerAdded) {
        rangeBtn.addEventListener('click', deleteSessionDataByRange);
        rangeBtn._listenerAdded = true;
        console.log('Session range delete listener added');
    }
    if (allBtn && !allBtn._listenerAdded) {
        allBtn.addEventListener('click', deleteAllSessionData);
        allBtn._listenerAdded = true;
        console.log('Session all delete listener added');
    }
}

// 更新上机同步按钮状态
function updateSessionSyncButtonState() {
    const startBtn = document.getElementById('startSessionSyncBtn');
    if (startBtn) {
        startBtn.disabled = !(sessionSyncDateRange.start && sessionSyncDateRange.end);
    }
}

// 添加上机同步日志
function addSessionSyncLog(message, type = 'info') {
    const logDiv = document.getElementById('sessionSyncLog');
    // 日志元素不存在时只输出到控制台
    console.log(`[SessionSync ${type}] ${message}`);
    if (!logDiv) return;

    logDiv.classList.remove('hidden');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
}

// 清空上机同步日志
function clearSessionSyncLog() {
    const logDiv = document.getElementById('sessionSyncLog');
    if (!logDiv) return;
    logDiv.innerHTML = '';
    logDiv.classList.add('hidden');
}

// 检查某个日期是否已有上机数据
function hasSessionDataForDate(date) {
    return availableDates.some(d => d.date === date);
}

// 检查某个日期是否已有充值数据
function hasRechargeDataForDate(date) {
    return rechargeAvailableDates.some(d => d.date === date);
}

// 加载充值记录日期数据
async function loadRechargeAvailableDates() {
    try {
        const { data, error } = await db
            .from('recharge_dates')
            .select('date, record_count, total_amount, total_gift')
            .order('date', { ascending: true });

        if (error) throw error;

        rechargeAvailableDates = data || [];
        console.log('已加载充值日期数据:', rechargeAvailableDates.length, '天');
    } catch (err) {
        console.error('加载充值日期失败:', err);
        rechargeAvailableDates = [];
    }
}

// 按日期范围加载充值数据
async function loadRechargeDataByDateRange(startDate, endDate) {
    try {
        console.log(`加载充值数据: ${startDate} 至 ${endDate}`);

        // 分页获取所有数据
        const PAGE_SIZE = 1000;
        let allData = [];
        let page = 0;
        let hasMore = true;

        while (hasMore) {
            const from = page * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            const { data, error } = await db
                .from('recharges')
                .select('*')
                .gte('create_time', startDate + 'T00:00:00')
                .lte('create_time', endDate + 'T23:59:59')
                .order('create_time', { ascending: false })
                .range(from, to);

            if (error) throw error;

            allData = allData.concat(data);
            hasMore = data.length === PAGE_SIZE;
            page++;
        }

        console.log(`查询到 ${allData.length} 条充值记录`);
        rechargeRawData = allData;

        if (allData.length > 0) {
            processRechargeData();
        }
    } catch (err) {
        console.error('加载充值数据失败:', err);
        rechargeRawData = [];
    }
}

// 加载全部充值数据
async function loadAllRechargeData() {
    try {
        const PAGE_SIZE = 1000;
        let allData = [];
        let page = 0;
        let hasMore = true;

        while (hasMore) {
            const from = page * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            const { data, error } = await db
                .from('recharges')
                .select('*')
                .order('create_time', { ascending: false })
                .range(from, to);

            if (error) throw error;

            allData = allData.concat(data);
            hasMore = data.length === PAGE_SIZE;
            page++;
        }

        console.log(`共加载 ${allData.length} 条充值记录`);
        rechargeRawData = allData;

        if (allData.length > 0) {
            processRechargeData();
        }
    } catch (err) {
        console.error('加载充值数据失败:', err);
        rechargeRawData = [];
    }
}

// 充值支付方式映射 (orderway)
function getPayTypeName(payType) {
    const type = Number(payType);
    const types = {
        1: '支付宝',
        2: '微信支付',
        3: '现金支付',
        4: '线下支付',
        5: '卡券兑换',
        6: '员工调整'
    };
    return types[type] || '其他';
}

// 充值订单类型映射 (ordertype + order_subtype)
function getOrderTypeName(orderType, orderSubtype) {
    // 转换为数字（数据库可能返回字符串）
    const type = Number(orderType);
    const subtype = Number(orderSubtype);

    // 如果有 order_subtype，优先按抖音/美团卡券分类
    if (subtype === 1) return '美团卡券';
    if (subtype === 3) return '抖音卡券';

    const types = {
        1: '账户充值',
        2: '第三方余额导入',
        4: '购买商品',
        5: '临卡押金充值',
        6: '押金找零',
        7: '变更网费余额',
        8: '账户充值退款',
        9: '商品退款'
    };
    return types[type] || '其他';
}

// 处理充值数据
function processRechargeData() {
    if (rechargeRawData.length === 0) {
        rechargeProcessedData = {};
        return;
    }

    // pay_channel=30 是押金操作，不计入充值收入
    const isDepositOperation = (r) => {
        const pc = Number(r.pay_channel);
        return pc === 30;
    };

    // 计算订单的实际金额（订单金额 - 退款金额，押金操作不计入）
    const getNetAmount = (r) => {
        if (isDepositOperation(r)) return 0;  // 押金操作不计入收入
        const orderFee = parseFloat(r.order_fee) || 0;
        const refundFee = parseFloat(r.refund_fee) || 0;
        return orderFee - refundFee;
    };

    // 过滤掉押金操作的记录用于统计
    const revenueRecords = rechargeRawData.filter(r => !isDepositOperation(r));

    // 基础统计（使用 Math.round 避免浮点数精度问题）
    const totalAmount = Math.round(revenueRecords.reduce((sum, r) => sum + getNetAmount(r), 0) * 100) / 100;
    // 退款总额
    const totalRefund = Math.round(revenueRecords.reduce((sum, r) => sum + (parseFloat(r.refund_fee) || 0), 0) * 100) / 100;
    const totalGift = Math.round(rechargeRawData.reduce((sum, r) => sum + (parseFloat(r.gift_fee) || 0), 0) * 100) / 100;
    const uniqueUsers = new Set(rechargeRawData.map(r => r.account)).size;

    // 调试：检查数据中的 pay_channel 和 order_subtype 值
    const payChannelValues = {};
    const orderSubtypeValues = {};
    rechargeRawData.forEach(r => {
        const pc = r.pay_channel ?? 'null';
        const os = r.order_subtype ?? 'null';
        payChannelValues[pc] = (payChannelValues[pc] || 0) + 1;
        orderSubtypeValues[os] = (orderSubtypeValues[os] || 0) + 1;
    });
    console.log('数据库 pay_channel 值统计:', payChannelValues);
    console.log('数据库 order_subtype 值统计:', orderSubtypeValues);

    // 按订单类型统计（区分抖音/美团卡券）
    const byChannel = {};
    rechargeRawData.forEach(r => {
        const channel = getOrderTypeName(r.pay_channel, r.order_subtype);
        if (!byChannel[channel]) {
            byChannel[channel] = { count: 0, amount: 0 };
        }
        byChannel[channel].count++;
        byChannel[channel].amount += getNetAmount(r);
    });
    // 四舍五入到分
    Object.values(byChannel).forEach(v => v.amount = Math.round(v.amount * 100) / 100);
    console.log('处理后的 byChannel:', byChannel);

    // 按支付方式统计
    const byType = {};
    rechargeRawData.forEach(r => {
        const type = getPayTypeName(r.pay_type);
        if (!byType[type]) {
            byType[type] = { count: 0, amount: 0 };
        }
        byType[type].count++;
        byType[type].amount += getNetAmount(r);
    });
    // 四舍五入到分
    Object.values(byType).forEach(v => v.amount = Math.round(v.amount * 100) / 100);

    // 按日期统计
    const byDate = {};
    rechargeRawData.forEach(r => {
        if (r.create_time) {
            const date = r.create_time.split('T')[0];
            if (!byDate[date]) {
                byDate[date] = { count: 0, amount: 0, gift: 0, refund: 0 };
            }
            byDate[date].count++;
            byDate[date].amount += getNetAmount(r);
            byDate[date].gift += parseFloat(r.gift_fee) || 0;
            byDate[date].refund += parseFloat(r.refund_fee) || 0;
        }
    });
    // 四舍五入到分
    Object.values(byDate).forEach(v => {
        v.amount = Math.round(v.amount * 100) / 100;
        v.gift = Math.round(v.gift * 100) / 100;
        v.refund = Math.round(v.refund * 100) / 100;
    });

    // 按小时统计
    const byHour = Array(24).fill(0).map(() => ({ count: 0, amount: 0 }));
    rechargeRawData.forEach(r => {
        if (r.create_time) {
            const hour = new Date(r.create_time).getHours();
            byHour[hour].count++;
            byHour[hour].amount += getNetAmount(r);
        }
    });
    // 四舍五入到分
    byHour.forEach(v => v.amount = Math.round(v.amount * 100) / 100);

    // 按金额区间统计（排除退款订单）
    const amountRanges = {
        '0-50': { count: 0, amount: 0 },
        '50-100': { count: 0, amount: 0 },
        '100-200': { count: 0, amount: 0 },
        '200-500': { count: 0, amount: 0 },
        '500-1000': { count: 0, amount: 0 },
        '1000+': { count: 0, amount: 0 }
    };
    rechargeRawData.forEach(r => {
        const orderFee = parseFloat(r.order_fee) || 0;
        // 按订单金额分类区间
        let range;
        if (orderFee < 50) range = '0-50';
        else if (orderFee < 100) range = '50-100';
        else if (orderFee < 200) range = '100-200';
        else if (orderFee < 500) range = '200-500';
        else if (orderFee < 1000) range = '500-1000';
        else range = '1000+';
        amountRanges[range].count++;
        amountRanges[range].amount += getNetAmount(r);
    });
    // 四舍五入到分
    Object.values(amountRanges).forEach(v => v.amount = Math.round(v.amount * 100) / 100);

    // 用户充值排行
    const userStats = {};
    rechargeRawData.forEach(r => {
        const account = r.account || '未知';
        if (!userStats[account]) {
            userStats[account] = { name: r.member_name || account, count: 0, amount: 0 };
        }
        userStats[account].count++;
        userStats[account].amount += getNetAmount(r);
    });
    // 四舍五入到分
    Object.values(userStats).forEach(v => v.amount = Math.round(v.amount * 100) / 100);
    const topUsers = Object.values(userStats)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

    rechargeProcessedData = {
        totalAmount,
        totalRefund,
        totalGift,
        count: rechargeRawData.length,
        uniqueUsers,
        byChannel,
        byType,
        byDate,
        byHour,
        amountRanges,
        topUsers
    };
}

// 渲染充值分析
function renderRechargeAnalysis() {
    if (!rechargeProcessedData.count) {
        return;
    }

    // 更新统计卡片
    document.getElementById('rechargeTotalAmount').textContent = `¥${rechargeProcessedData.totalAmount.toFixed(2)}`;
    document.getElementById('rechargeTotalGift').textContent = `¥${rechargeProcessedData.totalGift.toFixed(2)}`;
    document.getElementById('rechargeCount').textContent = rechargeProcessedData.count;
    document.getElementById('rechargeUserCount').textContent = rechargeProcessedData.uniqueUsers;

    // 渲染图表
    renderRechargeDailyChart();
    renderRechargeTypeChart();
    renderRechargeChannelChart();
    renderRechargeAmountDistChart();
    renderRechargeHourlyChart();
    renderRechargeTopUsersChart();
}

// 每日充值趋势图
function renderRechargeDailyChart() {
    const chartDom = document.getElementById('rechargeDailyChart');
    if (!chartDom) return;

    if (charts.rechargeDaily) charts.rechargeDaily.dispose();
    charts.rechargeDaily = echarts.init(chartDom);

    const dates = Object.keys(rechargeProcessedData.byDate).sort();
    const amounts = dates.map(d => rechargeProcessedData.byDate[d].amount);
    const counts = dates.map(d => rechargeProcessedData.byDate[d].count);

    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: { data: ['充值金额', '充值笔数'], textStyle: { color: '#a0aec0' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: dates, axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } } },
        yAxis: [
            { type: 'value', name: '金额', axisLabel: { color: '#a0aec0', formatter: '¥{value}' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { lineStyle: { color: '#2d3748' } } },
            { type: 'value', name: '笔数', axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { show: false } }
        ],
        series: [
            { name: '充值金额', type: 'bar', data: amounts, itemStyle: { color: '#48bb78' } },
            { name: '充值笔数', type: 'line', yAxisIndex: 1, data: counts, smooth: true, itemStyle: { color: '#667eea' } }
        ]
    };
    charts.rechargeDaily.setOption(option);
}

// 订单类型分布图
function renderRechargeChannelChart() {
    const chartDom = document.getElementById('rechargeChannelChart');
    if (!chartDom) return;

    if (charts.rechargeChannel) charts.rechargeChannel.dispose();
    charts.rechargeChannel = echarts.init(chartDom);

    const data = Object.entries(rechargeProcessedData.byChannel).map(([name, stats]) => ({
        name,
        value: stats.amount
    }));

    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
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
            color: ['#667eea', '#48bb78', '#ed8936', '#e53e3e', '#9f7aea', '#38b2ac']
        }]
    };
    charts.rechargeChannel.setOption(option);
}

// 支付方式分布图
function renderRechargeTypeChart() {
    const chartDom = document.getElementById('rechargeTypeChart');
    if (!chartDom) return;

    if (charts.rechargeType) charts.rechargeType.dispose();
    charts.rechargeType = echarts.init(chartDom);

    const data = Object.entries(rechargeProcessedData.byType).map(([name, stats]) => ({
        name,
        value: stats.amount
    }));

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
            color: ['#00f0ff', '#ff00aa', '#667eea', '#48bb78', '#ffd700']
        }]
    };
    charts.rechargeType.setOption(option);
}

// 充值金额分布图
function renderRechargeAmountDistChart() {
    const chartDom = document.getElementById('rechargeAmountDistChart');
    if (!chartDom) return;

    if (charts.rechargeAmountDist) charts.rechargeAmountDist.dispose();
    charts.rechargeAmountDist = echarts.init(chartDom);

    const ranges = Object.keys(rechargeProcessedData.amountRanges);
    const counts = ranges.map(r => rechargeProcessedData.amountRanges[r].count);

    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: ranges, axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } } },
        yAxis: { type: 'value', axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { lineStyle: { color: '#2d3748' } } },
        series: [{
            type: 'bar',
            data: counts,
            itemStyle: {
                color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#ffd700' }, { offset: 1, color: '#ff8c00' }] },
                borderRadius: [5, 5, 0, 0]
            },
            label: { show: true, position: 'top', color: '#a0aec0' }
        }]
    };
    charts.rechargeAmountDist.setOption(option);
}

// 充值时段分布图
function renderRechargeHourlyChart() {
    const chartDom = document.getElementById('rechargeHourlyChart');
    if (!chartDom) return;

    if (charts.rechargeHourly) charts.rechargeHourly.dispose();
    charts.rechargeHourly = echarts.init(chartDom);

    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const amounts = rechargeProcessedData.byHour.map(h => h.amount);

    const option = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', formatter: (params) => `${params[0].name}<br/>充值金额: ¥${params[0].value.toFixed(2)}` },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: hours, axisLabel: { color: '#a0aec0', interval: 2 }, axisLine: { lineStyle: { color: '#4a5568' } } },
        yAxis: { type: 'value', axisLabel: { color: '#a0aec0', formatter: '¥{value}' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { lineStyle: { color: '#2d3748' } } },
        series: [{
            type: 'line',
            data: amounts,
            smooth: true,
            areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(102, 126, 234, 0.5)' }, { offset: 1, color: 'rgba(102, 126, 234, 0)' }] } },
            lineStyle: { color: '#667eea', width: 2 },
            itemStyle: { color: '#667eea' }
        }]
    };
    charts.rechargeHourly.setOption(option);
}

// 充值 TOP 用户图
function renderRechargeTopUsersChart() {
    const chartDom = document.getElementById('rechargeTopUsersChart');
    if (!chartDom) return;

    if (charts.rechargeTopUsers) charts.rechargeTopUsers.dispose();
    charts.rechargeTopUsers = echarts.init(chartDom);

    const users = rechargeProcessedData.topUsers;

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params) => `${params[0].name}<br/>充值金额: ¥${params[0].value.toFixed(2)}<br/>充值次数: ${users[params[0].dataIndex].count}次`
        },
        grid: { left: '3%', right: '12%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value', axisLabel: { color: '#a0aec0', formatter: '¥{value}' }, axisLine: { lineStyle: { color: '#4a5568' } }, splitLine: { lineStyle: { color: '#2d3748' } } },
        yAxis: { type: 'category', data: users.map(u => u.name), axisLabel: { color: '#a0aec0' }, axisLine: { lineStyle: { color: '#4a5568' } } },
        series: [{
            type: 'bar',
            data: users.map(u => u.amount),
            itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#48bb78' }, { offset: 1, color: '#38a169' }] }, borderRadius: [0, 5, 5, 0] },
            label: { show: true, position: 'right', formatter: '¥{c}', color: '#a0aec0' }
        }]
    };
    charts.rechargeTopUsers.setOption(option);
}

// 开始上机 API 同步
async function startSessionApiSync() {
    if (!sessionSyncDateRange.start || !sessionSyncDateRange.end) {
        alert('请先选择同步日期范围');
        return;
    }

    const startBtn = document.getElementById('startSessionSyncBtn');
    const progressDiv = document.getElementById('sessionSyncProgress');
    const progressFill = document.getElementById('sessionSyncProgressFill');
    const progressText = document.getElementById('sessionSyncProgressText');
    const resultDiv = document.getElementById('sessionSyncResult');

    startBtn.disabled = true;
    progressDiv.classList.remove('hidden');
    resultDiv.classList.add('hidden');

    addSessionSyncLog(`开始同步 ${sessionSyncDateRange.start} 至 ${sessionSyncDateRange.end} 的上机数据`, 'info');

    try {
        // 1. 生成日期列表
        const allDates = generateDateRange(sessionSyncDateRange.start, sessionSyncDateRange.end);

        // 2. 过滤出没有数据的日期
        const datesToSync = allDates.filter(date => !hasSessionDataForDate(date));
        const skippedDates = allDates.length - datesToSync.length;

        if (skippedDates > 0) {
            addSessionSyncLog(`跳过 ${skippedDates} 天（已有数据）`, 'info');
        }

        if (datesToSync.length === 0) {
            progressFill.style.width = '100%';
            progressText.textContent = '无需同步';
            resultDiv.classList.remove('hidden');
            resultDiv.className = 'sync-result success';
            resultDiv.innerHTML = `
                <h3>无需同步</h3>
                <p>所选日期范围内的数据都已存在</p>
            `;
            startBtn.disabled = false;
            return;
        }

        addSessionSyncLog(`需要同步 ${datesToSync.length} 天的数据`, 'info');

        // 3. 登录获取 Token
        addSessionSyncLog('正在登录...', 'info');
        progressText.textContent = '正在登录...';
        progressFill.style.width = '10%';

        const token = await login();
        addSessionSyncLog('登录成功！', 'success');

        let totalRecords = 0;
        let syncedDays = 0;

        // 4. 逐日同步（只同步没有数据的日期）
        for (let i = 0; i < datesToSync.length; i++) {
            const date = datesToSync[i];
            addSessionSyncLog(`处理 ${date}...`, 'info');
            progressText.textContent = `同步中... ${i + 1}/${datesToSync.length} 天`;
            progressFill.style.width = `${10 + (i / datesToSync.length) * 80}%`;

            // 计算时间戳
            const startTime = dateToTimestamp(date, false);
            const endTime = dateToTimestamp(date, true);

            // 获取当天数据
            const records = await fetchAllSessions(token, startTime, endTime);

            if (records.length === 0) {
                addSessionSyncLog(`${date}: 无上机数据`, 'info');
                continue;
            }

            // 转换数据
            const sessions = transformSessionRecords(records);
            addSessionSyncLog(`${date}: 获取到 ${records.length} 条记录，${sessions.length} 条有效`, 'info');

            // 保存到数据库
            const saved = await saveSessionsToSupabase(sessions, date);
            totalRecords += saved;
            syncedDays++;
            addSessionSyncLog(`${date}: 已保存 ${saved} 条记录`, 'success');
        }

        progressFill.style.width = '100%';
        progressText.textContent = '同步完成！';

        // 显示结果
        resultDiv.classList.remove('hidden');
        resultDiv.className = 'sync-result success';
        resultDiv.innerHTML = `
            <h3>同步成功</h3>
            <div class="stat-highlight">${totalRecords} 条记录</div>
            <p>共同步 ${syncedDays} 天数据</p>
            <p>${sessionSyncDateRange.start} 至 ${sessionSyncDateRange.end}</p>
        `;

        // 刷新日期数据
        await loadAvailableDates();
        if (unifiedDatePickerInstance) {
            unifiedDatePickerInstance.destroy();
            initUnifiedDatePicker();
        }

    } catch (error) {
        progressText.textContent = '同步失败';
        resultDiv.classList.remove('hidden');
        resultDiv.className = 'sync-result error';
        resultDiv.innerHTML = `
            <h3>同步失败</h3>
            <p>${error.message}</p>
        `;
    } finally {
        startBtn.disabled = false;
    }
}

// =====================================================
// 统一数据同步功能
// =====================================================

// 初始化统一同步日期选择器
function initUnifiedSyncDatePicker() {
    // 默认选择最近 7 天，但最新日期为昨天
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(yesterday);
    weekAgo.setDate(weekAgo.getDate() - 6);

    // 合并上机数据、商品数据和充值数据的已有日期
    const sessionDates = availableDates.map(d => d.date);
    const productDates = productAvailableDates.map(d => d.date);
    const rechargeDates = rechargeAvailableDates.map(d => d.date);
    const allDatesToMark = [...new Set([...sessionDates, ...productDates, ...rechargeDates])];

    // 开始日期选择器
    flatpickr('#unifiedSyncStartDate', {
        dateFormat: 'Y-m-d',
        locale: 'zh',
        defaultDate: weekAgo,
        maxDate: yesterday,
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            const dateStr = dayElem.dateObj.toISOString().split('T')[0];
            if (allDatesToMark.includes(dateStr)) {
                dayElem.classList.add('has-data');
                dayElem.title = '已有数据';
            }
        },
        onChange: function(selectedDates) {
            if (selectedDates.length > 0) {
                unifiedSyncDateRange.start = formatDate(selectedDates[0]);
                updateUnifiedSyncButtonState();
            }
        }
    });

    // 结束日期选择器
    flatpickr('#unifiedSyncEndDate', {
        dateFormat: 'Y-m-d',
        locale: 'zh',
        defaultDate: yesterday,
        maxDate: yesterday,
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            const dateStr = dayElem.dateObj.toISOString().split('T')[0];
            if (allDatesToMark.includes(dateStr)) {
                dayElem.classList.add('has-data');
                dayElem.title = '已有数据';
            }
        },
        onChange: function(selectedDates) {
            if (selectedDates.length > 0) {
                unifiedSyncDateRange.end = formatDate(selectedDates[0]);
                updateUnifiedSyncButtonState();
            }
        }
    });

    // 设置默认值
    unifiedSyncDateRange = {
        start: formatDate(weekAgo),
        end: formatDate(yesterday)
    };
    updateUnifiedSyncButtonState();

    // 初始化删除日期选择器
    initSessionDeleteDatePickers();
    initProductDeleteDatePickers();
    initRechargeDeleteDatePickers();

    // 绑定删除按钮事件
    setupSessionDeleteButtons();
    setupProductDeleteButtons();
    setupRechargeDeleteButtons();

    // 绑定统一同步按钮事件
    const syncBtn = document.getElementById('startUnifiedSyncBtn');
    if (syncBtn && !syncBtn._listenerAdded) {
        syncBtn.addEventListener('click', startUnifiedApiSync);
        syncBtn._listenerAdded = true;
    }
}

// 更新统一同步按钮状态
function updateUnifiedSyncButtonState() {
    const startBtn = document.getElementById('startUnifiedSyncBtn');
    if (startBtn) {
        startBtn.disabled = !(unifiedSyncDateRange.start && unifiedSyncDateRange.end);
    }
}

// 开始统一 API 同步（上机数据 → 商品销售 → 充值记录）
async function startUnifiedApiSync() {
    if (!unifiedSyncDateRange.start || !unifiedSyncDateRange.end) {
        alert('请先选择同步日期范围');
        return;
    }

    const startBtn = document.getElementById('startUnifiedSyncBtn');
    const progressDiv = document.getElementById('unifiedSyncProgress');
    const resultDiv = document.getElementById('unifiedSyncResult');

    const sessionStep = document.getElementById('sessionSyncStep');
    const sessionStatus = document.getElementById('sessionSyncStatus');
    const sessionProgressFill = document.getElementById('sessionSyncProgressFill');
    const sessionProgressText = document.getElementById('sessionSyncProgressText');

    const productStep = document.getElementById('productSyncStep');
    const productStatus = document.getElementById('productSyncStatus');
    const productProgressFill = document.getElementById('productSyncProgressFill');
    const productProgressText = document.getElementById('productSyncProgressText');

    const rechargeStep = document.getElementById('rechargeSyncStep');
    const rechargeStatus = document.getElementById('rechargeSyncStatus');
    const rechargeProgressFill = document.getElementById('rechargeSyncProgressFill');
    const rechargeProgressText = document.getElementById('rechargeSyncProgressText');

    startBtn.disabled = true;
    progressDiv.classList.remove('hidden');
    resultDiv.classList.add('hidden');

    // 重置状态
    sessionStep.className = 'sync-step';
    productStep.className = 'sync-step';
    if (rechargeStep) rechargeStep.className = 'sync-step';
    sessionProgressFill.style.width = '0%';
    productProgressFill.style.width = '0%';
    if (rechargeProgressFill) rechargeProgressFill.style.width = '0%';
    sessionProgressText.textContent = '';
    productProgressText.textContent = '';
    if (rechargeProgressText) rechargeProgressText.textContent = '';
    sessionStatus.textContent = '等待中';
    productStatus.textContent = '等待中';
    if (rechargeStatus) rechargeStatus.textContent = '等待中';

    let sessionResult = { success: false, records: 0, days: 0 };
    let productResult = { success: false, records: 0, days: 0 };
    let rechargeResult = { success: false, records: 0, days: 0 };

    try {
        // ========== 第一阶段：同步上机数据 ==========
        sessionStep.className = 'sync-step active';
        sessionStatus.textContent = '同步中';

        const allDates = generateDateRange(unifiedSyncDateRange.start, unifiedSyncDateRange.end);
        const sessionDatesToSync = allDates.filter(date => !hasSessionDataForDate(date));

        if (sessionDatesToSync.length === 0) {
            sessionProgressFill.style.width = '100%';
            sessionProgressText.textContent = '所有日期已有数据，跳过';
            sessionStatus.textContent = '已跳过';
            sessionStep.className = 'sync-step completed';
            sessionResult.success = true;
        } else {
            sessionProgressText.textContent = '正在登录...';
            const token = await login();

            let totalRecords = 0;
            let syncedDays = 0;

            for (let i = 0; i < sessionDatesToSync.length; i++) {
                const date = sessionDatesToSync[i];
                sessionProgressText.textContent = `同步 ${date}... (${i + 1}/${sessionDatesToSync.length})`;
                sessionProgressFill.style.width = `${((i + 1) / sessionDatesToSync.length) * 100}%`;

                const startTime = dateToTimestamp(date, false);
                const endTime = dateToTimestamp(date, true);
                const records = await fetchAllSessions(token, startTime, endTime);

                if (records.length > 0) {
                    const sessions = transformSessionRecords(records);
                    const saved = await saveSessionsToSupabase(sessions, date);
                    totalRecords += saved;
                    syncedDays++;
                }
            }

            sessionProgressFill.style.width = '100%';
            sessionProgressText.textContent = `完成: ${totalRecords} 条记录, ${syncedDays} 天`;
            sessionStatus.textContent = '完成';
            sessionStep.className = 'sync-step completed';
            sessionResult = { success: true, records: totalRecords, days: syncedDays };
        }

        // ========== 第二阶段：同步商品销售数据 ==========
        productStep.className = 'sync-step active';
        productStatus.textContent = '同步中';

        const productDatesToSync = allDates.filter(date => !hasDataForDate(date));

        if (productDatesToSync.length === 0) {
            productProgressFill.style.width = '100%';
            productProgressText.textContent = '所有日期已有数据，跳过';
            productStatus.textContent = '已跳过';
            productStep.className = 'sync-step completed';
            productResult.success = true;
        } else {
            productProgressText.textContent = '正在登录...';
            const token = await loginForProducts();

            let totalProducts = 0;
            let syncedDays = 0;

            for (let i = 0; i < productDatesToSync.length; i++) {
                const date = productDatesToSync[i];
                productProgressText.textContent = `同步 ${date}... (${i + 1}/${productDatesToSync.length})`;
                productProgressFill.style.width = `${((i + 1) / productDatesToSync.length) * 100}%`;

                const orders = await fetchAllSales(token, date, date);

                if (orders.length > 0) {
                    const products = transformOrdersToProducts(orders, date);
                    const saved = await saveToSupabase(products, date);
                    totalProducts += saved;
                    syncedDays++;
                }
            }

            productProgressFill.style.width = '100%';
            productProgressText.textContent = `完成: ${totalProducts} 条记录, ${syncedDays} 天`;
            productStatus.textContent = '完成';
            productStep.className = 'sync-step completed';
            productResult = { success: true, records: totalProducts, days: syncedDays };
        }

        // ========== 第三阶段：同步充值记录 ==========
        if (rechargeStep) {
            rechargeStep.className = 'sync-step active';
            rechargeStatus.textContent = '同步中';

            const rechargeDatesToSync = allDates.filter(date => !hasRechargeDataForDate(date));

            if (rechargeDatesToSync.length === 0) {
                rechargeProgressFill.style.width = '100%';
                rechargeProgressText.textContent = '所有日期已有数据，跳过';
                rechargeStatus.textContent = '已跳过';
                rechargeStep.className = 'sync-step completed';
                rechargeResult.success = true;
            } else {
                rechargeProgressText.textContent = '正在登录...';
                const token = await login();

                let totalRecharges = 0;
                let syncedDays = 0;

                for (let i = 0; i < rechargeDatesToSync.length; i++) {
                    const date = rechargeDatesToSync[i];
                    rechargeProgressText.textContent = `同步 ${date}... (${i + 1}/${rechargeDatesToSync.length})`;
                    rechargeProgressFill.style.width = `${((i + 1) / rechargeDatesToSync.length) * 100}%`;

                    const startTime = dateToTimestamp(date, false);
                    const endTime = dateToTimestamp(date, true);
                    const records = await fetchAllRecharges(token, startTime, endTime);

                    if (records.length > 0) {
                        const recharges = transformRechargeRecords(records);
                        const saved = await saveRechargesToSupabase(recharges, date);
                        totalRecharges += saved;
                        syncedDays++;
                    }
                }

                rechargeProgressFill.style.width = '100%';
                rechargeProgressText.textContent = `完成: ${totalRecharges} 条记录, ${syncedDays} 天`;
                rechargeStatus.textContent = '完成';
                rechargeStep.className = 'sync-step completed';
                rechargeResult = { success: true, records: totalRecharges, days: syncedDays };
            }
        }

        // 显示结果
        resultDiv.classList.remove('hidden');
        resultDiv.className = 'sync-result success';
        resultDiv.innerHTML = `
            <h3>同步完成</h3>
            <p>日期范围: ${unifiedSyncDateRange.start} 至 ${unifiedSyncDateRange.end}</p>
            <p>上机数据: ${sessionResult.records} 条记录 (${sessionResult.days} 天)</p>
            <p>商品销售: ${productResult.records} 条记录 (${productResult.days} 天)</p>
            <p>充值记录: ${rechargeResult.records} 条记录 (${rechargeResult.days} 天)</p>
        `;

        // 刷新日期数据
        await Promise.all([loadAvailableDates(), loadProductAvailableDates(), loadRechargeAvailableDates()]);
        if (unifiedDatePickerInstance) {
            unifiedDatePickerInstance.destroy();
            initUnifiedDatePicker();
        }

    } catch (error) {
        console.error('同步失败:', error);

        // 标记当前步骤为错误
        if (sessionStep.classList.contains('active')) {
            sessionStep.className = 'sync-step error';
            sessionStatus.textContent = '失败';
            sessionProgressText.textContent = error.message;
        } else if (productStep.classList.contains('active')) {
            productStep.className = 'sync-step error';
            productStatus.textContent = '失败';
            productProgressText.textContent = error.message;
        } else if (rechargeStep && rechargeStep.classList.contains('active')) {
            rechargeStep.className = 'sync-step error';
            rechargeStatus.textContent = '失败';
            rechargeProgressText.textContent = error.message;
        }

        resultDiv.classList.remove('hidden');
        resultDiv.className = 'sync-result error';
        resultDiv.innerHTML = `
            <h3>同步失败</h3>
            <p>${error.message}</p>
        `;
    } finally {
        startBtn.disabled = false;
    }
}

// 商品同步登录（使用 sync-products.js 中的 login 函数）
async function loginForProducts() {
    // 直接使用 sync-products.js 中的 login 函数
    return await login();
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
    await loadProductDataByDateRange(selectedProductDateRange.start, selectedProductDateRange.end);
}

// 按日期范围加载商品数据
async function loadProductDataByDateRange(startDate, endDate) {
    try {
        const { data, error } = await db
            .from('product_sales')
            .select('*')
            .gte('sale_date', startDate)
            .lte('sale_date', endDate)
            .order('sale_date', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            console.log('选中日期范围内没有商品数据');
            return;
        }

        productRawData = data;
        processProductData();
        renderProductDashboard();
    } catch (err) {
        console.error('加载商品数据失败:', err);
        throw err;
    }
}

// 加载全部商品数据
async function loadAllProductData() {
    try {
        const { data, error } = await db
            .from('product_sales')
            .select('*')
            .order('sale_date', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            console.log('数据库中没有商品数据');
            return;
        }

        productRawData = data;
        processProductData();
        renderProductDashboard();
    } catch (err) {
        console.error('加载商品数据失败:', err);
        throw err;
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

// =====================================================
// 数据删除功能
// =====================================================

// 删除日期范围状态
let sessionDeleteDateRange = { start: null, end: null };
let productDeleteDateRange = { start: null, end: null };
let rechargeDeleteDateRange = { start: null, end: null };

// 初始化上机数据删除日期选择器
function initSessionDeleteDatePickers() {
    const startInput = document.getElementById('sessionDeleteStartDate');
    const endInput = document.getElementById('sessionDeleteEndDate');
    const deleteBtn = document.getElementById('deleteSessionRangeBtn');

    if (!startInput || !endInput) return;

    // 获取有数据的日期列表
    const datesToMark = availableDates.map(d => d.date);

    flatpickr(startInput, {
        dateFormat: 'Y-m-d',
        locale: 'zh',
        maxDate: 'today',
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            const dateStr = dayElem.dateObj.toISOString().split('T')[0];
            if (datesToMark.includes(dateStr)) {
                dayElem.classList.add('has-data');
                const dateInfo = availableDates.find(d => d.date === dateStr);
                if (dateInfo) {
                    dayElem.title = `${dateInfo.record_count} 条记录，¥${parseFloat(dateInfo.total_revenue).toFixed(0)}`;
                }
            }
        },
        onChange: (selectedDates, dateStr) => {
            sessionDeleteDateRange.start = dateStr;
            updateSessionDeleteButtonState();
        }
    });

    flatpickr(endInput, {
        dateFormat: 'Y-m-d',
        locale: 'zh',
        maxDate: 'today',
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            const dateStr = dayElem.dateObj.toISOString().split('T')[0];
            if (datesToMark.includes(dateStr)) {
                dayElem.classList.add('has-data');
                const dateInfo = availableDates.find(d => d.date === dateStr);
                if (dateInfo) {
                    dayElem.title = `${dateInfo.record_count} 条记录，¥${parseFloat(dateInfo.total_revenue).toFixed(0)}`;
                }
            }
        },
        onChange: (selectedDates, dateStr) => {
            sessionDeleteDateRange.end = dateStr;
            updateSessionDeleteButtonState();
        }
    });
}

// 更新上机删除按钮状态
function updateSessionDeleteButtonState() {
    const deleteBtn = document.getElementById('deleteSessionRangeBtn');
    if (deleteBtn) {
        deleteBtn.disabled = !(sessionDeleteDateRange.start && sessionDeleteDateRange.end);
    }
}

// 初始化商品数据删除日期选择器
function initProductDeleteDatePickers() {
    const startInput = document.getElementById('productDeleteStartDate');
    const endInput = document.getElementById('productDeleteEndDate');
    const deleteBtn = document.getElementById('deleteProductRangeBtn');

    if (!startInput || !endInput) return;

    // 获取有数据的日期列表
    const datesToMark = productAvailableDates.map(d => d.date);

    flatpickr(startInput, {
        dateFormat: 'Y-m-d',
        locale: 'zh',
        maxDate: 'today',
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
        onChange: (selectedDates, dateStr) => {
            productDeleteDateRange.start = dateStr;
            updateProductDeleteButtonState();
        }
    });

    flatpickr(endInput, {
        dateFormat: 'Y-m-d',
        locale: 'zh',
        maxDate: 'today',
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
        onChange: (selectedDates, dateStr) => {
            productDeleteDateRange.end = dateStr;
            updateProductDeleteButtonState();
        }
    });
}

// 更新商品删除按钮状态
function updateProductDeleteButtonState() {
    const deleteBtn = document.getElementById('deleteProductRangeBtn');
    if (deleteBtn) {
        deleteBtn.disabled = !(productDeleteDateRange.start && productDeleteDateRange.end);
    }
}

// 删除指定日期范围的上机数据
async function deleteSessionDataByRange() {
    console.log('deleteSessionDataByRange called', sessionDeleteDateRange);

    if (!sessionDeleteDateRange.start || !sessionDeleteDateRange.end) {
        alert('请选择要删除的日期范围');
        return;
    }

    const confirmMsg = `确定要删除 ${sessionDeleteDateRange.start} 至 ${sessionDeleteDateRange.end} 的上机数据吗？\n\n此操作不可撤销！`;
    if (!confirm(confirmMsg)) return;

    const deleteBtn = document.getElementById('deleteSessionRangeBtn');
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<span>删除中...</span>';

    try {
        // 使用 Supabase REST API 删除
        const config = getSupabaseConfig();
        const supabaseUrl = `${config.url}/rest/v1`;
        const headers = {
            'apikey': config.key,
            'Authorization': `Bearer ${config.key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };

        const startDate = sessionDeleteDateRange.start;
        const endDate = sessionDeleteDateRange.end;

        // 删除 sessions 表中的数据 (使用 and 语法)
        const sessionsUrl = `${supabaseUrl}/sessions?and=(start_time.gte.${startDate}T00:00:00Z,start_time.lte.${endDate}T23:59:59Z)`;
        console.log('Delete sessions URL:', sessionsUrl);

        const sessionsResponse = await fetch(sessionsUrl, { method: 'DELETE', headers });
        const sessionsText = await sessionsResponse.text();
        console.log('Sessions delete response:', sessionsResponse.status, sessionsText);

        // 删除 session_dates 表中的数据
        const datesUrl = `${supabaseUrl}/session_dates?and=(date.gte.${startDate},date.lte.${endDate})`;
        console.log('Delete session_dates URL:', datesUrl);

        const datesResponse = await fetch(datesUrl, { method: 'DELETE', headers });
        console.log('Dates delete response:', datesResponse.status);

        if (sessionsResponse.ok && datesResponse.ok) {
            alert(`成功删除 ${startDate} 至 ${endDate} 的上机数据`);
            // 重新加载可用日期
            loadAvailableDates();
            // 重新初始化删除日期选择器
            initSessionDeleteDatePickers();
        } else {
            throw new Error(`删除失败: sessions=${sessionsResponse.status}, dates=${datesResponse.status}`);
        }
    } catch (err) {
        alert('删除失败: ' + err.message);
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            <span>删除选定日期数据</span>
        `;
        updateSessionDeleteButtonState();
    }
}

// 删除所有上机数据
async function deleteAllSessionData() {
    const confirmMsg = '确定要删除所有上机数据吗？\n\n⚠️ 此操作将清空数据库中的所有上机记录，不可撤销！\n\n请输入 "DELETE" 确认：';
    const input = prompt(confirmMsg);
    if (input !== 'DELETE') {
        alert('操作已取消');
        return;
    }

    const deleteBtn = document.getElementById('deleteAllSessionBtn');
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<span>删除中...</span>';

    try {
        const config = getSupabaseConfig();
        const supabaseUrl = `${config.url}/rest/v1`;
        const headers = {
            'apikey': config.key,
            'Authorization': `Bearer ${config.key}`,
            'Content-Type': 'application/json'
        };

        // 删除所有 sessions 数据
        await fetch(`${supabaseUrl}/sessions?id=gt.0`, { method: 'DELETE', headers });

        // 删除所有 session_dates 数据
        await fetch(`${supabaseUrl}/session_dates?date=gt.2000-01-01`, { method: 'DELETE', headers });

        alert('已删除所有上机数据');
        loadAvailableDates();
    } catch (err) {
        alert('删除失败: ' + err.message);
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <span>删除所有上机数据</span>
        `;
    }
}

// 删除指定日期范围的商品数据
async function deleteProductDataByRange() {
    console.log('deleteProductDataByRange called', productDeleteDateRange);

    if (!productDeleteDateRange.start || !productDeleteDateRange.end) {
        alert('请选择要删除的日期范围');
        return;
    }

    const confirmMsg = `确定要删除 ${productDeleteDateRange.start} 至 ${productDeleteDateRange.end} 的商品销售数据吗？\n\n此操作不可撤销！`;
    if (!confirm(confirmMsg)) return;

    const deleteBtn = document.getElementById('deleteProductRangeBtn');
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<span>删除中...</span>';

    try {
        const config = getSupabaseConfig();
        const supabaseUrl = `${config.url}/rest/v1`;
        const headers = {
            'apikey': config.key,
            'Authorization': `Bearer ${config.key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };

        // 删除 product_sales 表中的数据
        // 使用 or 条件来实现范围查询 (sale_date >= start AND sale_date <= end)
        // PostgREST 要求对同一列的多个条件使用 and() 语法
        const startDate = productDeleteDateRange.start;
        const endDate = productDeleteDateRange.end;

        // 构建正确的 URL - 使用 and 语法
        const salesUrl = `${supabaseUrl}/product_sales?and=(sale_date.gte.${startDate},sale_date.lte.${endDate})`;
        console.log('Delete product_sales URL:', salesUrl);

        const response = await fetch(salesUrl, { method: 'DELETE', headers });
        const responseText = await response.text();
        console.log('Delete response:', response.status, responseText);

        if (!response.ok) {
            throw new Error(`删除商品数据失败: ${response.status} - ${responseText}`);
        }

        // 删除 product_dates 表中的数据
        const datesUrl = `${supabaseUrl}/product_dates?and=(date.gte.${startDate},date.lte.${endDate})`;
        console.log('Delete product_dates URL:', datesUrl);

        const datesResponse = await fetch(datesUrl, { method: 'DELETE', headers });
        console.log('Delete dates response:', datesResponse.status);

        alert(`成功删除 ${productDeleteDateRange.start} 至 ${productDeleteDateRange.end} 的商品数据`);
        // 重新加载可用日期
        loadProductAvailableDates();
        // 重新初始化删除日期选择器
        initProductDeleteDatePickers();
    } catch (err) {
        alert('删除失败: ' + err.message);
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            <span>删除选定日期数据</span>
        `;
        updateProductDeleteButtonState();
    }
}

// 删除所有商品数据
async function deleteAllProductData() {
    const confirmMsg = '确定要删除所有商品销售数据吗？\n\n⚠️ 此操作将清空数据库中的所有商品销售记录，不可撤销！\n\n请输入 "DELETE" 确认：';
    const input = prompt(confirmMsg);
    if (input !== 'DELETE') {
        alert('操作已取消');
        return;
    }

    const deleteBtn = document.getElementById('deleteAllProductBtn');
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<span>删除中...</span>';

    try {
        const config = getSupabaseConfig();
        const supabaseUrl = `${config.url}/rest/v1`;
        const headers = {
            'apikey': config.key,
            'Authorization': `Bearer ${config.key}`,
            'Content-Type': 'application/json'
        };

        // 删除所有 product_sales 数据
        await fetch(`${supabaseUrl}/product_sales?id=gt.0`, { method: 'DELETE', headers });

        // 删除所有 product_dates 数据
        await fetch(`${supabaseUrl}/product_dates?date=gt.2000-01-01`, { method: 'DELETE', headers });

        alert('已删除所有商品数据');
        loadProductAvailableDates();
    } catch (err) {
        alert('删除失败: ' + err.message);
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <span>删除所有商品数据</span>
        `;
    }
}

// =====================================================
// 充值数据删除功能
// =====================================================

// 初始化充值数据删除日期选择器
function initRechargeDeleteDatePickers() {
    const startInput = document.getElementById('rechargeDeleteStartDate');
    const endInput = document.getElementById('rechargeDeleteEndDate');
    const deleteBtn = document.getElementById('deleteRechargeRangeBtn');

    if (!startInput || !endInput) return;

    // 获取有数据的日期列表
    const datesToMark = rechargeAvailableDates.map(d => d.date);

    flatpickr(startInput, {
        dateFormat: 'Y-m-d',
        locale: 'zh',
        maxDate: 'today',
        enable: datesToMark,
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            const dateStr = dayElem.dateObj.toISOString().split('T')[0];
            if (datesToMark.includes(dateStr)) {
                dayElem.classList.add('has-data');
            }
        },
        onChange: (selectedDates, dateStr) => {
            rechargeDeleteDateRange.start = dateStr;
            updateRechargeDeleteButtonState();
        }
    });

    flatpickr(endInput, {
        dateFormat: 'Y-m-d',
        locale: 'zh',
        maxDate: 'today',
        enable: datesToMark,
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            const dateStr = dayElem.dateObj.toISOString().split('T')[0];
            if (datesToMark.includes(dateStr)) {
                dayElem.classList.add('has-data');
            }
        },
        onChange: (selectedDates, dateStr) => {
            rechargeDeleteDateRange.end = dateStr;
            updateRechargeDeleteButtonState();
        }
    });
}

// 更新充值删除按钮状态
function updateRechargeDeleteButtonState() {
    const deleteBtn = document.getElementById('deleteRechargeRangeBtn');
    if (deleteBtn) {
        deleteBtn.disabled = !(rechargeDeleteDateRange.start && rechargeDeleteDateRange.end);
    }
}

// 设置充值删除按钮事件
function setupRechargeDeleteButtons() {
    const rangeBtn = document.getElementById('deleteRechargeRangeBtn');
    const allBtn = document.getElementById('deleteAllRechargeBtn');

    if (rangeBtn && !rangeBtn._listenerAdded) {
        rangeBtn.addEventListener('click', deleteRechargeDataByRange);
        rangeBtn._listenerAdded = true;
    }
    if (allBtn && !allBtn._listenerAdded) {
        allBtn.addEventListener('click', deleteAllRechargeData);
        allBtn._listenerAdded = true;
    }
}

// 删除指定日期范围的充值数据
async function deleteRechargeDataByRange() {
    if (!rechargeDeleteDateRange.start || !rechargeDeleteDateRange.end) {
        alert('请选择要删除的日期范围');
        return;
    }

    const confirmMsg = `确定要删除 ${rechargeDeleteDateRange.start} 至 ${rechargeDeleteDateRange.end} 的充值数据吗？\n\n此操作不可撤销！`;
    if (!confirm(confirmMsg)) return;

    const deleteBtn = document.getElementById('deleteRechargeRangeBtn');
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<span>删除中...</span>';

    try {
        const config = getSupabaseConfig();
        const supabaseUrl = `${config.url}/rest/v1`;
        const headers = {
            'apikey': config.key,
            'Authorization': `Bearer ${config.key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        };

        // 删除 recharges 表中的数据
        const startTime = `${rechargeDeleteDateRange.start}T00:00:00+08:00`;
        const endTime = `${rechargeDeleteDateRange.end}T23:59:59+08:00`;
        await fetch(`${supabaseUrl}/recharges?create_time=gte.${encodeURIComponent(startTime)}&create_time=lte.${encodeURIComponent(endTime)}`, {
            method: 'DELETE',
            headers
        });

        // 删除 recharge_dates 表中的数据
        await fetch(`${supabaseUrl}/recharge_dates?date=gte.${rechargeDeleteDateRange.start}&date=lte.${rechargeDeleteDateRange.end}`, {
            method: 'DELETE',
            headers
        });

        alert(`已删除 ${rechargeDeleteDateRange.start} 至 ${rechargeDeleteDateRange.end} 的充值数据`);
        loadRechargeAvailableDates();
    } catch (err) {
        alert('删除失败: ' + err.message);
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            <span>删除</span>
        `;
    }
}

// 删除所有充值数据
async function deleteAllRechargeData() {
    const confirmMsg = '确定要删除所有充值数据吗？\n\n⚠️ 此操作将清空数据库中的所有充值记录，不可撤销！\n\n请输入 "DELETE" 确认：';
    const input = prompt(confirmMsg);
    if (input !== 'DELETE') {
        alert('操作已取消');
        return;
    }

    const deleteBtn = document.getElementById('deleteAllRechargeBtn');
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<span>删除中...</span>';

    try {
        const config = getSupabaseConfig();
        const supabaseUrl = `${config.url}/rest/v1`;
        const headers = {
            'apikey': config.key,
            'Authorization': `Bearer ${config.key}`,
            'Content-Type': 'application/json'
        };

        // 删除所有 recharges 数据
        await fetch(`${supabaseUrl}/recharges?order_id=neq.null`, { method: 'DELETE', headers });

        // 删除所有 recharge_dates 数据
        await fetch(`${supabaseUrl}/recharge_dates?date=gt.2000-01-01`, { method: 'DELETE', headers });

        alert('已删除所有充值数据');
        loadRechargeAvailableDates();
    } catch (err) {
        alert('删除失败: ' + err.message);
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <span>删除所有充值数据</span>
        `;
    }
}

// 获取 Supabase 配置（与 sync-products.js 一致）
function getSupabaseConfig() {
    if (typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined') {
        return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
    }
    return {
        url: 'https://dfbgnrmigltjvlvdfcao.supabase.co',
        key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmYmducm1pZ2x0anZsdmRmY2FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5NDAzMTQsImV4cCI6MjA1MDUxNjMxNH0.v8BLnqv0-RGO7s4qLnR0_k9Jp5qQhNMXeVl_MqrxfHQ'
    };
}

// 设置删除按钮事件
function setupDeleteButtons() {
    // 上机数据删除
    document.getElementById('deleteSessionRangeBtn')?.addEventListener('click', deleteSessionDataByRange);
    document.getElementById('deleteAllSessionBtn')?.addEventListener('click', deleteAllSessionData);

    // 商品数据删除
    document.getElementById('deleteProductRangeBtn')?.addEventListener('click', deleteProductDataByRange);
    document.getElementById('deleteAllProductBtn')?.addEventListener('click', deleteAllProductData);

    // 充值数据删除
    document.getElementById('deleteRechargeRangeBtn')?.addEventListener('click', deleteRechargeDataByRange);
    document.getElementById('deleteAllRechargeBtn')?.addEventListener('click', deleteAllRechargeData);
}

// =====================================================
// SEAT MAP FUNCTIONALITY
// =====================================================
// 座位分布变量已在文件顶部声明

// 座位区域映射
const SEAT_ZONES = {
    // 大厅 1-20
    '01': 'dating', '02': 'dating', '03': 'dating', '04': 'dating', '05': 'dating',
    '06': 'dating', '07': 'dating', '08': 'dating', '09': 'dating', '10': 'dating',
    '11': 'dating', '12': 'dating', '13': 'dating', '14': 'dating', '15': 'dating',
    '16': 'dating', '17': 'dating', '18': 'dating', '19': 'dating', '20': 'dating',
    // 单人包 21-33
    '21': 'danren', '22': 'danren', '23': 'danren', '24': 'danren', '25': 'danren',
    '26': 'danren', '27': 'danren', '28': 'danren', '29': 'danren', '30': 'danren',
    '31': 'danren', '32': 'danren', '33': 'danren',
    // 蚂蚁双人包 34-41
    '34': 'mayi', '35': 'mayi', '36': 'mayi', '37': 'mayi',
    '38': 'mayi', '39': 'mayi', '40': 'mayi', '41': 'mayi',
    // 卓威双人包 42-53
    '42': 'zhuwei2', '43': 'zhuwei2', '44': 'zhuwei2', '45': 'zhuwei2',
    '46': 'zhuwei2', '47': 'zhuwei2', '48': 'zhuwei2', '49': 'zhuwei2',
    '50': 'zhuwei2', '51': 'zhuwei2', '52': 'zhuwei2', '53': 'zhuwei2',
    // 卓威三人包 54-56
    '54': 'zhuwei3', '55': 'zhuwei3', '56': 'zhuwei3',
    // 卓威五人包 57-61
    '57': 'zhuwei5', '58': 'zhuwei5', '59': 'zhuwei5', '60': 'zhuwei5', '61': 'zhuwei5'
};

const ZONE_NAMES = {
    'dating': '大厅',
    'danren': '单人包',
    'mayi': '蚂蚁双人包',
    'zhuwei2': '卓威双人包',
    'zhuwei3': '卓威三人包',
    'zhuwei5': '卓威五人包'
};

// 初始化座位分布日期选择器
function initSeatMapDatePicker() {
    const startInput = document.getElementById('seatMapStartDate');
    const endInput = document.getElementById('seatMapEndDate');
    const loadBtn = document.getElementById('loadSeatMapBtn');

    if (!startInput || !endInput) return;

    // 获取有数据的日期列表
    const datesToMark = availableDates.map(d => d.date);

    const commonConfig = {
        locale: 'zh',
        dateFormat: 'Y-m-d',
        maxDate: 'today',
        disableMobile: true,
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            const dateStr = dayElem.dateObj.toISOString().split('T')[0];
            if (datesToMark.includes(dateStr)) {
                dayElem.classList.add('has-data');
                // 添加提示
                const dateInfo = availableDates.find(d => d.date === dateStr);
                if (dateInfo) {
                    dayElem.title = `${dateInfo.record_count} 条记录`;
                }
            }
        }
    };

    flatpickr(startInput, {
        ...commonConfig,
        onChange: (selectedDates) => {
            if (selectedDates.length > 0) {
                seatMapDateRange.start = formatDate(selectedDates[0]);
            }
            updateSeatMapLoadButton();
        }
    });

    flatpickr(endInput, {
        ...commonConfig,
        onChange: (selectedDates) => {
            if (selectedDates.length > 0) {
                seatMapDateRange.end = formatDate(selectedDates[0]);
            }
            updateSeatMapLoadButton();
        }
    });

    // 加载按钮事件
    loadBtn?.addEventListener('click', loadSeatMapData);

    // 创建 tooltip 元素
    createSeatMapTooltip();
}

function updateSeatMapLoadButton() {
    const loadBtn = document.getElementById('loadSeatMapBtn');
    if (loadBtn) {
        loadBtn.disabled = !(seatMapDateRange.start && seatMapDateRange.end);
    }
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 创建 tooltip 元素
function createSeatMapTooltip() {
    if (seatMapTooltip) return;
    seatMapTooltip = document.createElement('div');
    seatMapTooltip.className = 'seat-tooltip';
    seatMapTooltip.style.display = 'none';
    document.body.appendChild(seatMapTooltip);
}

// 加载座位使用数据
async function loadSeatMapData() {
    if (!seatMapDateRange.start || !seatMapDateRange.end) {
        alert('请选择日期范围');
        return;
    }

    const loadBtn = document.getElementById('loadSeatMapBtn');
    loadBtn.disabled = true;
    loadBtn.innerHTML = '<span>加载中...</span>';

    try {
        // 计算选定日期范围的总小时数
        const startDate = new Date(seatMapDateRange.start);
        const endDate = new Date(seatMapDateRange.end);
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        seatMapTotalHours = daysDiff * 24; // 每天24小时

        // 分页获取所有数据（Supabase 默认限制 1000 条）
        const PAGE_SIZE = 1000;
        let allData = [];
        let page = 0;
        let hasMore = true;

        while (hasMore) {
            const from = page * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            // 使用 +08:00 时区（北京时间）与存储数据一致
            const { data, error } = await db
                .from('sessions')
                .select('machine, area, start_time, end_time, deposit_deducted, principal_deducted, bonus_deducted')
                .gte('start_time', `${seatMapDateRange.start}T00:00:00+08:00`)
                .lte('start_time', `${seatMapDateRange.end}T23:59:59+08:00`)
                .range(from, to);

            if (error) throw error;

            allData = allData.concat(data);
            hasMore = data.length === PAGE_SIZE;
            page++;
        }

        console.log(`座位图数据: 共加载 ${allData.length} 条记录`);

        // 处理数据
        processSeatData(allData);

        // 显示结果
        document.getElementById('seatMapStats')?.classList.remove('hidden');
        document.getElementById('seatMapContainer')?.classList.remove('hidden');
        document.getElementById('seatMapModeSwitch')?.classList.remove('hidden');

        // 绑定模式切换事件
        bindModeSwitchEvents();

    } catch (err) {
        console.error('加载座位数据失败:', err);
        alert('加载数据失败: ' + err.message);
    } finally {
        loadBtn.disabled = false;
        loadBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <span>查询上座情况</span>
        `;
    }
}

// 处理座位数据
function processSeatData(records) {
    seatUsageData = {};

    // 统计每个座位的使用次数、收入和时长
    records.forEach(r => {
        // 从 machine 字段提取座位号（如 "TC01" -> "01"）
        let seatNum = extractSeatNumber(r.machine);
        if (!seatNum) return;

        if (!seatUsageData[seatNum]) {
            seatUsageData[seatNum] = {
                count: 0,
                revenue: 0,
                totalHours: 0, // 总使用时长（小时）
                area: r.area || ZONE_NAMES[SEAT_ZONES[seatNum]] || '未知'
            };
        }

        seatUsageData[seatNum].count++;
        seatUsageData[seatNum].revenue +=
            (r.deposit_deducted || 0) + (r.principal_deducted || 0) + (r.bonus_deducted || 0);

        // 计算使用时长
        if (r.start_time && r.end_time) {
            const start = new Date(r.start_time);
            const end = new Date(r.end_time);
            const hours = (end - start) / (1000 * 60 * 60);
            if (hours > 0 && hours < 48) { // 排除异常数据
                seatUsageData[seatNum].totalHours += hours;
            }
        }
    });

    // 计算每个座位的利用率
    for (const seatNum in seatUsageData) {
        const data = seatUsageData[seatNum];
        data.utilization = seatMapTotalHours > 0 ? (data.totalHours / seatMapTotalHours * 100) : 0;
    }

    // 更新统计卡片
    updateSeatMapStats(records);

    // 更新座位图
    updateSeatMapDisplay();

    // 更新排行榜
    updateSeatRanking();

    // 绑定座位点击和悬停事件
    bindSeatEvents();
}

// 从机器名提取座位号
function extractSeatNumber(machine) {
    if (!machine) return null;

    // 尝试匹配各种格式: TC01, 01, 1, 太初01 等
    const match = machine.match(/(\d{1,2})$/);
    if (match) {
        return match[1].padStart(2, '0');
    }
    return null;
}

// 更新统计卡片
function updateSeatMapStats(records) {
    const totalSessions = records.length;
    const usedSeats = Object.keys(seatUsageData).length;

    // 找最热门座位
    let hotSeat = '-';
    let maxCount = 0;
    for (const [seat, data] of Object.entries(seatUsageData)) {
        if (data.count > maxCount) {
            maxCount = data.count;
            hotSeat = seat;
        }
    }

    const avgUsage = usedSeats > 0 ? (totalSessions / usedSeats).toFixed(1) : 0;

    document.getElementById('seatMapTotalSessions').textContent = totalSessions.toLocaleString();
    document.getElementById('seatMapUsedSeats').textContent = `${usedSeats} / 61`;
    document.getElementById('seatMapHotSeat').textContent = hotSeat !== '-' ? `${hotSeat}号 (${maxCount}次)` : '-';
    document.getElementById('seatMapAvgUsage').textContent = avgUsage;
}

// 更新座位图显示
function updateSeatMapDisplay() {
    const seats = document.querySelectorAll('#seatMapFloorPlan .seat');

    // 根据模式选择数据
    const isUtilizationMode = seatMapDisplayMode === 'utilization';
    const values = Object.values(seatUsageData)
        .map(d => isUtilizationMode ? d.utilization : d.count)
        .filter(v => v > 0)
        .sort((a, b) => a - b);

    // 计算分位数
    const q25 = values[Math.floor(values.length * 0.25)] || (isUtilizationMode ? 5 : 1);
    const q50 = values[Math.floor(values.length * 0.5)] || (isUtilizationMode ? 15 : 2);
    const q75 = values[Math.floor(values.length * 0.75)] || (isUtilizationMode ? 30 : 5);

    seats.forEach(seat => {
        const seatNum = seat.dataset.seat;
        const data = seatUsageData[seatNum];

        // 清除之前的状态
        seat.classList.remove('usage-low', 'usage-medium', 'usage-high', 'usage-very-high');
        const existingBadge = seat.querySelector('.usage-badge');
        if (existingBadge) existingBadge.remove();

        if (data && data.count > 0) {
            const value = isUtilizationMode ? data.utilization : data.count;

            // 添加使用量等级
            if (value <= q25) {
                seat.classList.add('usage-low');
            } else if (value <= q50) {
                seat.classList.add('usage-medium');
            } else if (value <= q75) {
                seat.classList.add('usage-high');
            } else {
                seat.classList.add('usage-very-high');
            }

            // 添加徽章
            const badge = document.createElement('span');
            badge.className = 'usage-badge';
            badge.textContent = isUtilizationMode ? `${value.toFixed(0)}%` : data.count;
            seat.appendChild(badge);
        }
    });
}

// 更新座位排行榜
function updateSeatRanking() {
    const rankingList = document.getElementById('rankingList');
    if (!rankingList) return;

    const isUtilizationMode = seatMapDisplayMode === 'utilization';

    // 排序
    const sorted = Object.entries(seatUsageData)
        .map(([seat, data]) => ({ seat, ...data }))
        .sort((a, b) => isUtilizationMode ? b.utilization - a.utilization : b.count - a.count)
        .slice(0, 20);

    if (sorted.length === 0) {
        rankingList.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">暂无数据</div>';
        return;
    }

    rankingList.innerHTML = sorted.map((item, index) => {
        let posClass = 'normal';
        if (index === 0) posClass = 'gold';
        else if (index === 1) posClass = 'silver';
        else if (index === 2) posClass = 'bronze';

        const zoneName = ZONE_NAMES[SEAT_ZONES[item.seat]] || '未知';
        const displayValue = isUtilizationMode
            ? `${item.utilization.toFixed(1)}%`
            : `${item.count}次`;

        return `
            <div class="ranking-item" data-seat="${item.seat}">
                <div class="ranking-position ${posClass}">${index + 1}</div>
                <div class="ranking-seat">${item.seat}号<span>${zoneName}</span></div>
                <div class="ranking-count">${displayValue}</div>
            </div>
        `;
    }).join('');

    // 绑定排行榜点击事件
    rankingList.querySelectorAll('.ranking-item').forEach(item => {
        item.addEventListener('click', () => {
            const seatNum = item.dataset.seat;
            showSeatDetail(seatNum);
        });
    });
}

// 绑定座位事件
function bindSeatEvents() {
    const seats = document.querySelectorAll('#seatMapFloorPlan .seat');

    seats.forEach(seat => {
        // 鼠标悬停
        seat.addEventListener('mouseenter', (e) => {
            const seatNum = seat.dataset.seat;
            showSeatTooltip(e, seatNum);
        });

        seat.addEventListener('mousemove', (e) => {
            if (seatMapTooltip && seatMapTooltip.style.display !== 'none') {
                seatMapTooltip.style.left = (e.clientX + 15) + 'px';
                seatMapTooltip.style.top = (e.clientY + 15) + 'px';
            }
        });

        seat.addEventListener('mouseleave', () => {
            hideSeatTooltip();
        });

        // 点击显示详情
        seat.addEventListener('click', () => {
            const seatNum = seat.dataset.seat;
            showSeatDetail(seatNum);
        });
    });
}

// 显示座位 tooltip
function showSeatTooltip(e, seatNum) {
    if (!seatMapTooltip) return;

    const data = seatUsageData[seatNum];
    const zoneName = ZONE_NAMES[SEAT_ZONES[seatNum]] || '未知';

    let content = `
        <div class="seat-tooltip-title">${seatNum}号座位</div>
        <div class="seat-tooltip-row">
            <span class="seat-tooltip-label">区域</span>
            <span class="seat-tooltip-value">${zoneName}</span>
        </div>
    `;

    if (data && data.count > 0) {
        content += `
            <div class="seat-tooltip-row">
                <span class="seat-tooltip-label">使用次数</span>
                <span class="seat-tooltip-value">${data.count}次</span>
            </div>
            <div class="seat-tooltip-row">
                <span class="seat-tooltip-label">总使用时长</span>
                <span class="seat-tooltip-value">${data.totalHours.toFixed(1)}小时</span>
            </div>
            <div class="seat-tooltip-row">
                <span class="seat-tooltip-label">利用率</span>
                <span class="seat-tooltip-value">${data.utilization.toFixed(1)}%</span>
            </div>
            <div class="seat-tooltip-row">
                <span class="seat-tooltip-label">总收入</span>
                <span class="seat-tooltip-value">¥${data.revenue.toFixed(2)}</span>
            </div>
        `;
    } else {
        content += `
            <div class="seat-tooltip-row">
                <span class="seat-tooltip-label">状态</span>
                <span class="seat-tooltip-value">无使用记录</span>
            </div>
        `;
    }

    seatMapTooltip.innerHTML = content;
    seatMapTooltip.style.display = 'block';
    seatMapTooltip.style.left = (e.clientX + 15) + 'px';
    seatMapTooltip.style.top = (e.clientY + 15) + 'px';
}

// 隐藏 tooltip
function hideSeatTooltip() {
    if (seatMapTooltip) {
        seatMapTooltip.style.display = 'none';
    }
}

// 显示座位详情面板
function showSeatDetail(seatNum) {
    const panel = document.getElementById('seatDetailPanel');
    const content = document.getElementById('seatDetailContent');

    if (!panel || !content) return;

    const data = seatUsageData[seatNum];
    const zoneName = ZONE_NAMES[SEAT_ZONES[seatNum]] || '未知';

    let html = `
        <div class="seat-detail-item">
            <span class="seat-detail-label">座位号</span>
            <span class="seat-detail-value highlight">${seatNum}</span>
        </div>
        <div class="seat-detail-item">
            <span class="seat-detail-label">所属区域</span>
            <span class="seat-detail-value">${zoneName}</span>
        </div>
    `;

    if (data && data.count > 0) {
        const avgRevenue = data.revenue / data.count;
        const avgDuration = data.totalHours / data.count;
        html += `
            <div class="seat-detail-item">
                <span class="seat-detail-label">使用次数</span>
                <span class="seat-detail-value highlight">${data.count} 次</span>
            </div>
            <div class="seat-detail-item">
                <span class="seat-detail-label">总使用时长</span>
                <span class="seat-detail-value">${data.totalHours.toFixed(1)} 小时</span>
            </div>
            <div class="seat-detail-item">
                <span class="seat-detail-label">利用率</span>
                <span class="seat-detail-value highlight">${data.utilization.toFixed(1)}%</span>
            </div>
            <div class="seat-detail-item">
                <span class="seat-detail-label">平均每次时长</span>
                <span class="seat-detail-value">${avgDuration.toFixed(1)} 小时</span>
            </div>
            <div class="seat-detail-item">
                <span class="seat-detail-label">总收入</span>
                <span class="seat-detail-value">¥${data.revenue.toFixed(2)}</span>
            </div>
            <div class="seat-detail-item">
                <span class="seat-detail-label">平均每次消费</span>
                <span class="seat-detail-value">¥${avgRevenue.toFixed(2)}</span>
            </div>
        `;
    } else {
        html += `
            <div class="seat-detail-item">
                <span class="seat-detail-label">状态</span>
                <span class="seat-detail-value">该日期范围内无使用记录</span>
            </div>
        `;
    }

    content.innerHTML = html;
    panel.classList.remove('hidden');
}

// 绑定模式切换事件
function bindModeSwitchEvents() {
    const modeTabs = document.querySelectorAll('#seatMapModeSwitch .mode-tab');

    modeTabs.forEach(tab => {
        // 移除旧事件再添加新事件（防止重复绑定）
        tab.replaceWith(tab.cloneNode(true));
    });

    // 重新获取元素并绑定事件
    document.querySelectorAll('#seatMapModeSwitch .mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const mode = tab.dataset.mode;
            if (mode === seatMapDisplayMode) return;

            // 更新模式
            seatMapDisplayMode = mode;

            // 更新 tab 样式
            document.querySelectorAll('#seatMapModeSwitch .mode-tab').forEach(t => {
                t.classList.remove('active');
            });
            tab.classList.add('active');

            // 更新显示
            updateSeatMapDisplay();
            updateSeatRanking();
        });
    });
}

// 在页面加载时初始化座位图
// 座位分布功能已整合到统一数据分析页面
