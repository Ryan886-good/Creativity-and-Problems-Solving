// ==========================================
// 1. 初始化與頁面切換
// ==========================================
window.onload = function() {
    document.getElementById('intro-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    renderTasks(); // 啟動時渲染空畫面
};

function switchView(viewId) {
    const views = document.querySelectorAll('.page-view');
    views.forEach(view => view.style.display = 'none');
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
// 2. 核心資料管理 (使用陣列)
// ==========================================
let tasks = []; // 存放所有任務的陣列
let taskIdCounter = 1; // 用來給任務獨立 ID
let currentSelectedQuadrantColor = 'dot-not-urgent'; 

// 選擇象限
function selectQuadrant(btnElement, colorClass) {
    const buttons = document.querySelectorAll('.quadrant-btn');
    buttons.forEach(btn => btn.classList.remove('selected'));
    btnElement.classList.add('selected');
    currentSelectedQuadrantColor = colorClass;
}

// ==========================================
// 3. 渲染邏輯 (更新任務列表與時間表)
// ==========================================
function renderTasks() {
    const taskList = document.getElementById('task-list');
    taskList.innerHTML = ''; // 清空畫面
    
    if (tasks.length === 0) {
        taskList.innerHTML = '<p style="color:#888; text-align:center; width:100%;">目前沒有任務，趕快新增吧！</p>';
    }

    // 生成任務卡片
    tasks.forEach(task => {
        const timeDisplay = (task.start && task.end) ? `${task.start} - ${task.end}` : (task.start || '時間未定');
        const chapterText = task.chapter ? task.chapter : '';
        const memoText = task.memo ? '| ' + task.memo : '';

        const taskHTML = `
            <div class="task-card" style="border: 2px solid #8C8C8C;">
                <div class="task-info">
                    <input type="checkbox" class="task-check" onclick="completeTask(${task.id})">
                    <div class="matrix-dot ${task.colorClass}"></div>
                    <div class="task-text">
                        <h3>${task.name}</h3>
                        <p>${chapterText} ${memoText}</p>
                    </div>
                </div>
                <div class="task-time-action">
                    <p>${timeDisplay}</p>
                    <button class="reschedule-btn" onclick="openEditModal(${task.id})">編輯</button>
                </div>
            </div>
        `;
        taskList.insertAdjacentHTML('beforeend', taskHTML);
    });

    renderTimeline(); // 每次更新列表，同步更新時間表
}

// 動態計算並渲染時間表 (假設範圍 8AM 到 6PM，共10小時)
function renderTimeline() {
    const timelineContainer = document.getElementById('timeline-blocks');
    timelineContainer.innerHTML = ''; 

    tasks.forEach(task => {
        if(!task.start || !task.end) return; // 沒有完整時間就不畫

        // 計算分鐘數 (扣除早上 8 點)
        const [sHour, sMin] = task.start.split(':').map(Number);
        const [eHour, eMin] = task.end.split(':').map(Number);
        
        const startTotalMins = (sHour * 60 + sMin) - (8 * 60);
        const endTotalMins = (eHour * 60 + eMin) - (8 * 60);
        
        // 轉換為百分比 (10小時 = 600分鐘 = 100%)
        let leftPercent = (startTotalMins / 600) * 100;
        let widthPercent = ((endTotalMins - startTotalMins) / 600) * 100;
        
        // 確保不會超出邊界
        leftPercent = Math.max(0, Math.min(leftPercent, 100));
        
        // 抓取對應的顏色色碼
        let bgColor = '#F3A01D';
        if(task.colorClass === 'dot-urgent-important') bgColor = '#B26500';
        if(task.colorClass === 'dot-not-urgent') bgColor = '#FDE2B3';
        if(task.colorClass === 'dot-urgent') bgColor = '#F8B84E';

        const blockHTML = `<div class="timeline-block" style="left: ${leftPercent}%; width: ${widthPercent}%; background-color: ${bgColor};"></div>`;
        timelineContainer.insertAdjacentHTML('beforeend', blockHTML);
    });
}

// ==========================================
// 4. 新增、編輯、刪除與完成
// ==========================================
function saveTask() {
    const name = document.getElementById('new-task-name').value;
    const start = document.getElementById('new-task-start').value;
    const end = document.getElementById('new-task-end').value;
    
    if (!name) return showNotification('請填寫事項名稱！', '資料未填齊');
    if (start && end && start >= end) return showNotification('結束時間必須晚於開始時間！', '時間錯誤');

    // 將資料存入陣列
    tasks.push({
        id: taskIdCounter++,
        name: name,
        start: start,
        end: end,
        chapter: document.getElementById('new-task-chapter').value,
        memo: document.getElementById('new-task-memo').value,
        colorClass: currentSelectedQuadrantColor
    });
    
    // 清空表單
    document.getElementById('new-task-name').value = '';
    document.getElementById('new-task-start').value = '';
    document.getElementById('new-task-end').value = '';
    document.getElementById('new-task-chapter').value = '';
    document.getElementById('new-task-memo').value = '';
    
    closeModal('add-modal');
    renderTasks(); // 重新渲染
}

// 打開編輯視窗
let currentEditingId = null;
function openEditModal(id) {
    const task = tasks.find(t => t.id === id);
    if(!task) return;

    currentEditingId = id;
    document.getElementById('edit-modal-title').innerText = `編輯：${task.name}`;
    document.getElementById('edit-task-name').value = task.name;
    document.getElementById('edit-task-start').value = task.start;
    document.getElementById('edit-task-end').value = task.end;
    document.getElementById('edit-task-chapter').value = task.chapter;
    document.getElementById('edit-task-memo').value = task.memo;

    openModal('edit-modal');
}

// 儲存編輯
function confirmEdit() {
    const task = tasks.find(t => t.id === currentEditingId);
    if(!task) return;

    const newName = document.getElementById('edit-task-name').value;
    if(!newName) return showNotification("名稱不能為空喔！", "錯誤");

    task.name = newName;
    task.start = document.getElementById('edit-task-start').value;
    task.end = document.getElementById('edit-task-end').value;
    task.chapter = document.getElementById('edit-task-chapter').value;
    task.memo = document.getElementById('edit-task-memo').value;

    closeModal('edit-modal');
    renderTasks();
}

// 刪除任務
function deleteTask() {
    tasks = tasks.filter(t => t.id !== currentEditingId);
    closeModal('edit-modal');
    renderTasks();
}

// 完成打勾勾 (目前邏輯：完成即從今日任務中移除)
function completeTask(id) {
    setTimeout(() => {
        tasks = tasks.filter(t => t.id !== id);
        renderTasks();
        showNotification('太棒了！你又完成了一項任務 🎉', '任務完成');
    }, 300); // 延遲300毫秒讓使用者看到打勾的動畫
}