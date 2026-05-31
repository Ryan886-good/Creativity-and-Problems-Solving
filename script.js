// ==========================================
// 1. 初始化與頁面切換 (SPA)
// ==========================================
window.onload = function() {
    // 預設關閉開頭動畫，直接顯示主程式
    document.getElementById('intro-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
};

// 切換頁面視圖
function switchView(viewId) {
    // 將所有 .page-view 隱藏
    const views = document.querySelectorAll('.page-view');
    views.forEach(view => {
        view.style.display = 'none';
    });
    // 顯示指定的視圖
    document.getElementById(viewId).style.display = 'flex';
}

// ==========================================
// 2. 共用 Modal 與 提示系統 (取代 alert)
// ==========================================
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// 全新的客製化提示框
function showNotification(message, title = '系統提示') {
    document.getElementById('notif-title').innerText = title;
    document.getElementById('notif-msg').innerText = message;
    openModal('notification-modal');
}

// ==========================================
// 3. 新增任務邏輯
// ==========================================
let currentSelectedQuadrantColor = 'dot-not-urgent';

function selectQuadrant(btnElement, colorClass) {
    const buttons = document.querySelectorAll('.quadrant-btn');
    buttons.forEach(btn => btn.classList.remove('selected'));
    btnElement.classList.add('selected');
    currentSelectedQuadrantColor = colorClass;
}

function saveTask() {
    const name = document.getElementById('new-task-name').value;
    const time = document.getElementById('new-task-time').value;
    const chapter = document.getElementById('new-task-chapter').value;
    const memo = document.getElementById('new-task-memo').value;
    
    if (!name) {
        showNotification('請填寫事項名稱！', '資料未填齊');
        return;
    }

    let displayTime = '時間未定';
    if(time) {
        const dateObj = new Date(time);
        displayTime = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
    }

    const taskList = document.getElementById('task-list');
    const newTaskHTML = `
        <div class="task-card" style="border: 2px solid #8C8C8C;">
            <div class="task-info">
                <div class="matrix-dot ${currentSelectedQuadrantColor}"></div>
                <div class="task-text">
                    <h3>${name}</h3>
                    <p>${chapter ? chapter : ''} ${memo ? '| '+memo : ''}</p>
                </div>
            </div>
            <div class="task-time-action">
                <p>${displayTime}</p>
                <button class="reschedule-btn" onclick="openEditModal('${name}', '${displayTime}', '${chapter}', '${memo}')">編輯</button>
            </div>
        </div>
    `;
    
    taskList.insertAdjacentHTML('afterbegin', newTaskHTML);
    
    // 清空表單
    document.getElementById('new-task-name').value = '';
    document.getElementById('new-task-time').value = '';
    document.getElementById('new-task-chapter').value = '';
    document.getElementById('new-task-memo').value = '';
    
    closeModal('add-modal');
    showNotification('事項已成功新增！', '成功');
}

// ==========================================
// 4. 編輯/改期任務邏輯 (全新升級)
// ==========================================
let currentEditingTask = '';

// 打開編輯視窗，並帶入原有資料 (Mockup 展示用)
function openEditModal(name, timeStr, chapter, memo) {
    currentEditingTask = name;
    
    // 更改標題
    document.getElementById('edit-modal-title').innerText = `編輯：${name}`;
    
    // 將資料預填入輸入框 (如果有的話)
    document.getElementById('edit-task-name').value = name;
    document.getElementById('edit-task-chapter').value = chapter || '';
    document.getElementById('edit-task-memo').value = memo || '';
    
    // 這裡為了展示簡單，時間框先留空讓使用者重選
    document.getElementById('edit-task-time').value = ''; 

    openModal('edit-modal');
}

function confirmEdit() {
    const newName = document.getElementById('edit-task-name').value;
    
    if(!newName) {
        showNotification("名稱不能為空喔！", "錯誤");
        return;
    }

    closeModal('edit-modal');
    // 使用新的提示窗通知使用者儲存成功
    showNotification(`已成功更新「${newName}」的資料！\n(此為畫面展示，實際需連接資料庫)`, '更新成功');
}