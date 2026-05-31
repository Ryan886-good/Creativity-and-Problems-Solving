// ==========================================
// 1. 頁面切換與提示模組
// ==========================================
window.onload = function() {
    document.getElementById('intro-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    
    // 初始化首頁今日任務
    renderTodayTasks(); 
    
    // 初始化長遠計畫的預設日期
    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('long-task-date').value = todayStr;
    renderLongTimeline();
};

// 點擊 Logo 也可以回首頁
document.querySelector('.logo-header').onclick = function() { switchView('home-view'); };

function switchView(viewId) {
    document.querySelectorAll('.page-view').forEach(view => view.style.display = 'none');
    document.getElementById(viewId).style.display = 'flex';
}

function openModal(modalId) { document.getElementById(modalId).style.display = 'flex'; }
function closeModal(modalId) { document.getElementById(modalId).style.display = 'none'; }
function showNotification(message, title = '系統提示') {
    document.getElementById('notif-title').innerText = title;
    document.getElementById('notif-msg').innerText = message;
    openModal('notification-modal');
}

// ==========================================
// 2. 系統 A：首頁今日任務 (小時制)
// ==========================================
let todayTasks = [];
let todayTaskId = 1;
let currentTodayQuad = 'dot-not-urgent';
let currentEditTodayId = null;

function selectTodayQuadrant(btn, colorClass) {
    document.querySelectorAll('#add-today-modal .quadrant-btn, #edit-today-modal .quadrant-btn').forEach(el => el.classList.remove('selected'));
    btn.classList.add('selected');
    currentTodayQuad = colorClass;
}

function saveTodayTask() {
    const name = document.getElementById('today-task-name').value;
    const start = document.getElementById('today-task-start').value;
    const end = document.getElementById('today-task-end').value;
    
    if (!name) return showNotification('請填寫任務名稱！', '資料未填齊');

    todayTasks.push({
        id: todayTaskId++, name: name, start: start, end: end,
        chapter: document.getElementById('today-task-chapter').value,
        memo: document.getElementById('today-task-memo').value,
        colorClass: currentTodayQuad
    });
    
    // 清空表單
    ['name','start','end','chapter','memo'].forEach(id => document.getElementById('today-task-'+id).value = '');
    closeModal('add-today-modal');
    renderTodayTasks();
}

function renderTodayTasks() {
    const list = document.getElementById('today-task-list');
    list.innerHTML = todayTasks.length === 0 ? '<p style="color:#888; text-align:center;">今日無任務</p>' : '';

    todayTasks.forEach(task => {
        const timeDisplay = (task.start && task.end) ? `${task.start} - ${task.end}` : (task.start || '時間未定');
        const extra = `${task.chapter||''} ${task.memo ? '| '+task.memo : ''}`;
        
        list.insertAdjacentHTML('beforeend', `
            <div class="task-card" style="border: 2px solid #8C8C8C;">
                <div class="task-info">
                    <input type="checkbox" class="task-check" onclick="completeTodayTask(${task.id})">
                    <div class="matrix-dot ${task.colorClass}"></div>
                    <div class="task-text"><h3>${task.name}</h3><p>${extra}</p></div>
                </div>
                <div class="task-time-action">
                    <p>${timeDisplay}</p>
                    <button class="reschedule-btn" onclick="openEditTodayModal(${task.id})">編輯</button>
                </div>
            </div>
        `);
    });
    renderTodayTimeline(); // 同步渲染時間表
}

function renderTodayTimeline() {
    const container = document.getElementById('today-timeline-blocks');
    container.innerHTML = ''; 

    todayTasks.forEach(task => {
        if(!task.start || !task.end) return;
        const [sH, sM] = task.start.split(':').map(Number);
        const [eH, eM] = task.end.split(':').map(Number);
        const startMins = (sH * 60 + sM) - (8 * 60);
        const endMins = (eH * 60 + eM) - (8 * 60);
        
        let leftPercent = Math.max(0, Math.min((startMins / 600) * 100, 100));
        let widthPercent = ((endMins - startMins) / 600) * 100;
        
        let bgColor = '#F3A01D';
        if(task.colorClass === 'dot-urgent-important') bgColor = '#B26500';
        if(task.colorClass === 'dot-not-urgent') bgColor = '#FDE2B3';
        if(task.colorClass === 'dot-urgent') bgColor = '#F8B84E';

        container.insertAdjacentHTML('beforeend', `<div class="timeline-block-today" style="left: ${leftPercent}%; width: ${widthPercent}%; background-color: ${bgColor};"></div>`);
    });
}

function openEditTodayModal(id) {
    const task = todayTasks.find(t => t.id === id);
    if(!task) return;
    currentEditTodayId = id;
    document.getElementById('edit-today-name').value = task.name;
    document.getElementById('edit-today-start').value = task.start;
    document.getElementById('edit-today-end').value = task.end;
    document.getElementById('edit-today-chapter').value = task.chapter;
    document.getElementById('edit-today-memo').value = task.memo;
    openModal('edit-today-modal');
}

function confirmEditToday() {
    const task = todayTasks.find(t => t.id === currentEditTodayId);
    if(!task) return;
    task.name = document.getElementById('edit-today-name').value;
    task.start = document.getElementById('edit-today-start').value;
    task.end = document.getElementById('edit-today-end').value;
    task.chapter = document.getElementById('edit-today-chapter').value;
    task.memo = document.getElementById('edit-today-memo').value;
    closeModal('edit-today-modal');
    renderTodayTasks();
}

function deleteTodayTask() {
    todayTasks = todayTasks.filter(t => t.id !== currentEditTodayId);
    closeModal('edit-today-modal');
    renderTodayTasks();
}

function completeTodayTask(id) {
    setTimeout(() => {
        todayTasks = todayTasks.filter(t => t.id !== id);
        renderTodayTasks();
    }, 300);
}


// ==========================================
// 3. 系統 B：行事曆長遠排程 (月份制 + 防重疊飛入)
// ==========================================
let longTasks = [];
let longTaskId = 1;
let currentLongColor = '#10b981'; 
let currentLongMatrix = '重要不緊急';

const timelineStart = new Date('2026-05-01').getTime();
const timelineEnd = new Date('2026-07-31').getTime();
const totalDuration = timelineEnd - timelineStart;

function selectLongColor(element, color) {
    document.querySelectorAll('.color-circle').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    currentLongColor = color;
}
function selectLongMatrix(element, matrixValue) {
    document.querySelectorAll('.mat-btn').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    currentLongMatrix = matrixValue;
}

function saveAndFly() {
    const name = document.getElementById('long-task-name').value;
    const dateStr = document.getElementById('long-task-date').value;
    
    if (!name || !dateStr) return showNotification('請輸入目標名稱與截止日期！', '資料不完整');

    let leftPercent = ((new Date(dateStr).getTime() - timelineStart) / totalDuration) * 100;
    leftPercent = Math.max(0, Math.min(leftPercent, 90)); // 避免超出右邊

    const newTask = {
        id: longTaskId++, name: name, leftPercent: leftPercent,
        color: currentLongColor, type: document.getElementById('long-task-type').value,
        matrix: currentLongMatrix
    };
    longTasks.push(newTask);
    triggerFlyAnimation(newTask);
}

function triggerFlyAnimation(task) {
    const btn = document.getElementById('btn-fly');
    const flyEl = document.getElementById('fly-element');
    const timelineContainer = document.getElementById('elegant-timeline');

    const btnRect = btn.getBoundingClientRect();
    const timelineRect = timelineContainer.getBoundingClientRect();
    
    const startX = btnRect.left + btnRect.width / 2;
    const startY = btnRect.top + btnRect.height / 2;
    const endX = timelineRect.left + (timelineRect.width * (task.leftPercent / 100));
    const endY = timelineRect.top + 80; // 飛入時間軸上方

    flyEl.style.transition = 'none';
    flyEl.style.transform = `translate(${startX}px, ${startY}px)`;
    flyEl.style.backgroundColor = task.color;
    flyEl.style.boxShadow = `0 0 15px ${task.color}`;
    flyEl.style.opacity = '1';

    void flyEl.offsetWidth; // Force reflow

    flyEl.style.transition = 'all 0.7s cubic-bezier(0.25, 1, 0.5, 1)';
    flyEl.style.transform = `translate(${endX}px, ${endY}px) scale(1.5)`;

    setTimeout(() => {
        flyEl.style.opacity = '0';
        document.getElementById('long-task-name').value = '';
        renderLongTimeline();
    }, 700);
}

function renderLongTimeline() {
    const container = document.getElementById('long-timeline-tasks');
    container.innerHTML = '';

    longTasks.sort((a, b) => a.leftPercent - b.leftPercent); // 依時間(左到右)排序

    const blockWidthPercent = 18; // 預估文字方塊佔用的 %
    let rows = [];

    longTasks.forEach(task => {
        let placedRow = 0;
        let placed = false;

        // 防重疊演算法：尋找可以放的列
        for (let i = 0; i < rows.length; i++) {
            if (rows[i] < task.leftPercent) {
                placedRow = i;
                rows[i] = task.leftPercent + blockWidthPercent;
                placed = true;
                break;
            }
        }
        if (!placed) {
            placedRow = rows.length;
            rows.push(task.leftPercent + blockWidthPercent);
        }

        const bottomOffset = 140 - (placedRow * 32) - 15;

        const block = document.createElement('div');
        block.className = 'timeline-task-block';
        block.style.left = `${task.leftPercent}%`;
        block.style.top = `${bottomOffset}px`;
        block.style.backgroundColor = task.color;
        block.innerText = task.name;
        block.onclick = () => showNotification(`【${task.name}】\n類型：${task.type}\n狀態：${task.matrix}`, '長遠計畫詳情');
        
        container.appendChild(block);
    });
}