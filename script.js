// ==========================================
// 1. 動畫邏輯 (約 6 秒)
// ==========================================
const to = document.getElementById('to');
const p = document.getElementById('p');
const lan = document.getElementById('lan');

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runIntroAnimation() {
    [to, p, lan].forEach(el => el.classList.add('focused'));
    await delay(1500);

    to.classList.add('float-up-red');
    p.classList.add('float-up-red');
    await delay(1500);

    to.classList.remove('float-up-red');
    p.classList.remove('float-up-red');
    to.classList.add('fall-down');
    p.classList.add('fall-down');
    await delay(1200);

    p.classList.remove('fall-down');
    lan.classList.remove('fall-down');
    p.classList.add('float-up-plain');
    lan.classList.add('float-up-plain');
    await delay(1500);

    p.classList.remove('float-up-plain');
    lan.classList.remove('float-up-plain');
    p.classList.add('fall-down');
    lan.classList.add('fall-down');
    await delay(500);

    // 動畫結束，切換至主畫面
    document.getElementById('intro-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
}

// 啟動動畫
window.onload = function() {
    document.getElementById('intro-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
};

// ==========================================
// 2. Modal 彈出視窗開關共用邏輯
// ==========================================
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// ==========================================
// 3. 新增任務邏輯 (包含四象限選擇)
// ==========================================
let currentSelectedQuadrantColor = 'dot-not-urgent'; // 預設顏色

// 點擊四象限按鈕時觸發
function selectQuadrant(btnElement, colorClass) {
    // 移除所有按鈕的選取狀態
    const buttons = document.querySelectorAll('.quadrant-btn');
    buttons.forEach(btn => btn.classList.remove('selected'));
    
    // 為點擊的按鈕加上黑色粗框選取狀態
    btnElement.classList.add('selected');
    
    // 記住對應的圓點顏色
    currentSelectedQuadrantColor = colorClass;
}

// 儲存任務並動態新增到列表
function saveTask() {
    const name = document.getElementById('new-task-name').value;
    const time = document.getElementById('new-task-time').value;
    const chapter = document.getElementById('new-task-chapter').value;
    const memo = document.getElementById('new-task-memo').value;
    
    if (!name) {
        alert('請填寫事項名稱！'); // 這是防呆，不用改 Modal
        return;
    }

    // 將 datetime-local 的格式稍微美化一下 (例如 2026-05-31T19:00 轉為單純時間)
    let displayTime = '時間未定';
    if(time) {
        const dateObj = new Date(time);
        displayTime = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
    }

    const taskList = document.getElementById('task-list');
    
    // 建立新的卡片 HTML，套用選擇的顏色
    const newTaskHTML = `
        <div class="task-card" style="border: 2px solid #8C8C8C;">
            <div class="task-info">
                <div class="matrix-dot ${currentSelectedQuadrantColor}"></div>
                <div class="task-text">
                    <h3>${name}</h3>
                    <p>${chapter ? chapter : '無章節'} ${memo ? '| '+memo : ''}</p>
                </div>
            </div>
            <div class="task-time-action">
                <p>${displayTime}</p>
                <button class="reschedule-btn" onclick="openRescheduleModal('${name}')">改期</button>
            </div>
        </div>
    `;
    
    // 插入到列表最上方
    taskList.insertAdjacentHTML('afterbegin', newTaskHTML);
    
    // 清空表單並關閉 Modal
    document.getElementById('new-task-name').value = '';
    document.getElementById('new-task-time').value = '';
    document.getElementById('new-task-chapter').value = '';
    document.getElementById('new-task-memo').value = '';
    
    const buttons = document.querySelectorAll('.quadrant-btn');
    buttons.forEach(btn => btn.classList.remove('selected'));
    
    closeModal('add-modal');
}

// ==========================================
// 4. 改期 Modal 邏輯
// ==========================================
let currentTaskToReschedule = '';

function openRescheduleModal(taskName) {
    currentTaskToReschedule = taskName;
    document.getElementById('reschedule-title').innerText = `為「${taskName}」改期`;
    document.getElementById('reschedule-time').value = ''; // 清空舊輸入
    openModal('reschedule-modal');
}

function confirmReschedule() {
    const newTime = document.getElementById('reschedule-time').value;
    if(!newTime) {
        alert("請選擇時間！");
        return;
    }
    // 實務上這裡會用 JS 去更新 DOM 的字串，這裡做概念展示
    alert(`已成功將「${currentTaskToReschedule}」時間更新！`);
    closeModal('reschedule-modal');
}

// ==========================================
// 5. 底部導覽列 Modal 邏輯
// ==========================================
function openNavModal(pageName) {
    document.getElementById('nav-page-name').innerText = pageName;
    openModal('nav-modal');
}