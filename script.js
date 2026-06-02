// --- 模擬資料庫升級：photos 變成物件陣列，包含 id 與敘述 ---
const MockDatabase = {
    "testuser": { 
        password: "123", 
        name: "傳說中的測試員", 
        photos: [
            { id: "p1", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Ming", desc: "剛起床頭髮超亂" },
            { id: "p2", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Bob", desc: "吃到超酸檸檬的瞬間" },
            { id: "p3", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Alice", desc: "不小心跌倒的蠢樣" }
        ] 
    }
};

// 為了讓你方便測試商店，預設給你 1000 滿滿的硬幣！
// 並新增 unlockedPhotos 陣列來記錄已經解鎖的照片 ID
let currentUser = { uid: null, name: "", coins: 1000, unlockedPhotos: [] }; 
let tempPhotoDataUrl = ""; 
let tasks = [];
let activeTask = null; 
let editingTaskId = null; 

const quadrantVarMap = {
    "重要且緊急": "--q1-color", "重要不緊急": "--q2-color",
    "不重要且緊急": "--q3-color", "不重要不緊急": "--q4-color"
};
const PX_PER_DAY = 20;
const TIMELINE_START_OFFSET = 40;

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}
document.querySelectorAll('.back-to-tasks').forEach(btn => {
    btn.addEventListener('click', () => switchScreen('screen-tasks'));
});
document.getElementById('btn-settings').addEventListener('click', () => {
    loadSettings();
    switchScreen('screen-settings');
});

// ==========================================
// 1. 登入與註冊
// ==========================================
let authMode = 'login'; 

document.getElementById('tab-login').addEventListener('click', function() {
    authMode = 'login';
    this.classList.add('active');
    document.getElementById('tab-register').classList.remove('active');
    document.getElementById('auth-title').innerText = '📸 歡迎回來';
    document.getElementById('auth-subtitle').innerText = '輸入帳號密碼進入系統';
    document.getElementById('register-fields').classList.add('hidden');
});

document.getElementById('tab-register').addEventListener('click', function() {
    authMode = 'register';
    this.classList.add('active');
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('auth-title').innerText = '📸 建立ID';
    document.getElementById('auth-subtitle').innerText = '上傳一張醜照，成為別人解鎖的驚喜';
    document.getElementById('register-fields').classList.remove('hidden');
});

document.getElementById('photo-upload').addEventListener('change', function(e) {
    if (e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            tempPhotoDataUrl = e.target.result;
            document.getElementById('upload-preview').innerHTML = `<img src="${tempPhotoDataUrl}">`;
        }
        reader.readAsDataURL(e.target.files[0]);
    }
});

document.getElementById('btn-auth-submit').addEventListener('click', () => {
    const username = document.getElementById('username-input').value;
    const password = document.getElementById('password-input').value;
    
    if (!username || !password) return alert('請輸入帳號與密碼！');

    if (authMode === 'login') {
        const user = MockDatabase[username];
        if (user && user.password === password) {
            loginSuccess(username, user.name);
        } else {
            alert('帳號或密碼錯誤！(測試帳號: testuser / 密碼: 123)');
        }
    } else {
        const nickname = document.getElementById('nickname-input').value;
        const desc = document.getElementById('photo-desc-input').value;
        if (!nickname || !tempPhotoDataUrl || !desc) return alert('請完整填寫暱稱、上傳照片並附上敘述！');
        if (MockDatabase[username]) return alert('此 ID 已被註冊！');
        
        // 建立物件結構
        const newPhotoObj = { id: 'p_' + Date.now(), url: tempPhotoDataUrl, desc: desc };
        MockDatabase[username] = { password: password, name: nickname, photos: [newPhotoObj] };
        
        loginSuccess(username, nickname);
        alert(`註冊成功！請記住你的帳號 ID：${username}`);
    }
});

function loginSuccess(uid, name) {
    currentUser.uid = uid;
    currentUser.name = name;
    // 更新介面上的硬幣數字
    document.getElementById('coin-count').innerText = currentUser.coins;
    document.getElementById('my-uid-display').innerText = `我的 ID: ${currentUser.uid}`;
    document.getElementById('app-header').classList.remove('hidden');
    switchScreen('screen-tasks');
    renderTimeline();
}

// ==========================================
// 2. 任務建立與修改 (維持不變)
// ==========================================
let selectedType = "報告";
let selectedQuadrant = "重要不緊急";

document.getElementById('toggle-btn').addEventListener('click', function() {
    const details = document.getElementById('details-area');
    details.style.display = (details.style.display === 'block') ? 'none' : 'block';
    this.innerText = (details.style.display === 'block') ? '▲ 收起設定' : '▼ 詳細設定';
});

document.querySelectorAll('.type-pill').forEach(el => el.addEventListener('click', function() {
    document.querySelectorAll('.type-pill').forEach(s => s.classList.remove('selected'));
    this.classList.add('selected');
    selectedType = this.innerText;
}));

document.querySelectorAll('.quadrant').forEach(el => el.addEventListener('click', function() {
    document.querySelectorAll('.quadrant').forEach(s => s.classList.remove('selected'));
    this.classList.add('selected');
    selectedQuadrant = this.dataset.quadrant;
}));

document.getElementById('submit-btn').addEventListener('click', () => {
    const name = document.getElementById('task-name').value;
    const dateStr = document.getElementById('task-date').value;
    const notesStr = document.getElementById('task-notes').value;
    if (!name || !dateStr) return alert("請填寫名稱與截止日期！");

    const today = new Date();
    today.setHours(0,0,0,0);
    const deadline = new Date(dateStr + 'T00:00:00');
    if (deadline < today) return alert("日期必須在今天之後！");

    const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    const taskData = { name, dateStr, type: selectedType, quadrant: selectedQuadrant, notes: notesStr, daysLeft: diffDays };

    if (editingTaskId) {
        const index = tasks.findIndex(t => t.id === editingTaskId);
        tasks[index] = { ...tasks[index], ...taskData };
        exitEditMode();
    } else {
        taskData.id = Date.now();
        tasks.push(taskData);
    }
    
    document.getElementById('task-name').value = '';
    document.getElementById('task-notes').value = '';
    renderTimeline();
});

function renderTimeline() {
    const track = document.getElementById('timeline-track');
    const arrowHead = document.getElementById('arrow-head');
    track.querySelectorAll('.task-card, .month-marker').forEach(el => el.remove());

    const today = new Date();
    today.setHours(0,0,0,0);
    let maxDays = 30; 
    tasks.forEach(t => { if(t.daysLeft > maxDays) maxDays = t.daysLeft; });
    const maxMonths = Math.ceil(maxDays / 30) + 1; 

    for (let i = 0; i < maxMonths; i++) {
        let markerDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
        let diffDays = (i === 0) ? 0 : (markerDate.getTime() - today.getTime()) / (1000 * 3600 * 24);
        let labelText = (i === 0) ? `今天 (${today.getMonth() + 1}/${today.getDate()})` : `${markerDate.getMonth() + 1}月`;
        const leftPos = TIMELINE_START_OFFSET + (diffDays * PX_PER_DAY);
        const marker = document.createElement('div');
        marker.className = 'month-marker';
        marker.innerText = labelText;
        marker.style.left = `${leftPos}px`;
        track.appendChild(marker);
    }

    const requiredWidth = TIMELINE_START_OFFSET + (maxMonths * 30 * PX_PER_DAY) + 60;
    track.style.width = `${requiredWidth}px`;
    arrowHead.style.left = `${requiredWidth - 10}px`;

    const dateCounts = {};
    tasks.forEach(task => {
        task.leftPos = TIMELINE_START_OFFSET + (task.daysLeft * PX_PER_DAY);
        if (!dateCounts[task.dateStr]) dateCounts[task.dateStr] = 0;
        task.stackIndex = dateCounts[task.dateStr]; 
        dateCounts[task.dateStr]++;
    });

    tasks.forEach(task => {
        const totalOnDay = dateCounts[task.dateStr];
        const topPos = 50 + (task.stackIndex - (totalOnDay - 1) / 2) * 18;
        const card = document.createElement('div');
        card.className = 'task-card';
        card.style.background = `var(${quadrantVarMap[task.quadrant]})`;
        card.style.left = `${task.leftPos}px`;
        track.appendChild(card);
        setTimeout(() => { card.style.top = `${topPos}%`; card.style.opacity = '1'; }, 50);
        card.addEventListener('click', () => openPanel(task));
    });
}

function getQuoteByDays(days) {
    if (days <= 1) return "鼠拉！"; if (days <= 3) return "火燒屁股囉！";
    if (days <= 7) return "有點急囉！"; if (days <= 14) return "安啦！";
    if (days <= 30) return "不慌張"; return "輕輕鬆鬆"; 
}

function openPanel(task) {
    activeTask = task;
    document.getElementById('panel-title').innerText = task.name;
    document.getElementById('panel-title').style.borderColor = `var(${quadrantVarMap[task.quadrant]})`; 
    document.getElementById('panel-quadrant').innerText = task.quadrant;
    document.getElementById('panel-type').innerText = `#${task.type}`;
    document.getElementById('panel-date').innerText = task.dateStr;
    document.getElementById('panel-days').innerText = task.daysLeft;
    document.getElementById('panel-quote').innerText = getQuoteByDays(task.daysLeft);
    document.getElementById('panel-notes-content').innerText = task.notes ? task.notes : "無";
    document.getElementById('info-panel').style.display = 'block';
}

document.getElementById('close-panel').addEventListener('click', () => { document.getElementById('info-panel').style.display = 'none'; });
document.getElementById('task-delete-btn').addEventListener('click', () => {
    if(confirm('確定要刪除這個任務嗎？')) {
        tasks = tasks.filter(t => t.id !== activeTask.id);
        document.getElementById('info-panel').style.display = 'none';
        renderTimeline();
    }
});
document.getElementById('task-edit-btn').addEventListener('click', () => {
    editingTaskId = activeTask.id;
    document.getElementById('task-name').value = activeTask.name;
    document.getElementById('task-date').value = activeTask.dateStr;
    document.getElementById('task-notes').value = activeTask.notes;
    document.querySelectorAll('.type-pill').forEach(s => s.classList.toggle('selected', s.innerText === activeTask.type));
    document.querySelectorAll('.quadrant').forEach(s => s.classList.toggle('selected', s.dataset.quadrant === activeTask.quadrant));
    selectedType = activeTask.type; selectedQuadrant = activeTask.quadrant;
    document.querySelector('.input-container').classList.add('editing-mode');
    document.getElementById('submit-btn').innerText = '儲存修改';
    document.getElementById('cancel-edit-btn').classList.remove('hidden');
    document.getElementById('details-area').style.display = 'block'; 
    document.getElementById('info-panel').style.display = 'none';
});
document.getElementById('cancel-edit-btn').addEventListener('click', exitEditMode);

function exitEditMode() {
    editingTaskId = null;
    document.querySelector('.input-container').classList.remove('editing-mode');
    document.getElementById('submit-btn').innerText = '確定飛入';
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    document.getElementById('task-name').value = ''; document.getElementById('task-notes').value = '';
}

document.getElementById('task-complete-btn').addEventListener('click', (e) => {
    const btnRect = e.target.getBoundingClientRect();
    const coinIcon = document.querySelector('.coin-display').getBoundingClientRect();
    const coin = document.createElement('div');
    coin.className = 'flying-coin';
    coin.innerText = '🪙';
    coin.style.left = `${btnRect.left + btnRect.width/2}px`;
    coin.style.top = `${btnRect.top}px`;
    document.body.appendChild(coin);
    setTimeout(() => { coin.style.left = `${coinIcon.left}px`; coin.style.top = `${coinIcon.top}px`; coin.style.transform = 'scale(0.5)'; }, 50);
    coin.addEventListener('transitionend', () => {
        coin.remove();
        currentUser.coins++;
        document.getElementById('coin-count').innerText = currentUser.coins;
    });
    document.getElementById('info-panel').style.display = 'none';
    tasks = tasks.filter(t => t.id !== activeTask.id);
    renderTimeline();
});

// ==========================================
// 5. 商店解鎖機制 (九宮格櫥窗)
// ==========================================
const STORE_PRICE = 300; // 每張定價 300
document.getElementById('btn-go-store').addEventListener('click', () => switchScreen('screen-store'));

document.getElementById('btn-search-friend').addEventListener('click', () => {
    const targetId = document.getElementById('friend-id-input').value;
    if (!targetId) return alert('請輸入朋友 ID！');

    const friend = MockDatabase[targetId];
    if (friend && friend.photos && friend.photos.length > 0) {
        document.getElementById('store-gallery').classList.remove('hidden');
        document.getElementById('store-friend-name').innerText = `✨ ${friend.name} 的珍藏相簿`;
        renderStoreGrid(friend.photos);
    } else {
        alert('找不到這個 ID，或是他還沒有上傳任何照片！');
    }
});

function renderStoreGrid(photos) {
    const grid = document.getElementById('store-grid');
    grid.innerHTML = ''; // 清空舊的

    photos.forEach(photoObj => {
        // 檢查當前使用者是否已經買過這張
        const isUnlocked = currentUser.unlockedPhotos.includes(photoObj.id);

        const item = document.createElement('div');
        item.className = 'store-item';
        
        item.innerHTML = `
            <div class="store-item-img-wrap">
                <img src="${photoObj.url}" class="${isUnlocked ? '' : 'blurred'}" alt="photo">
                ${!isUnlocked ? `<div class="buy-overlay">🔒</div>` : ''}
            </div>
            <div class="price">🪙 ${isUnlocked ? '已解鎖' : STORE_PRICE}</div>
            <div class="desc">${photoObj.desc}</div>
        `;

        // 如果還沒解鎖，綁定購買事件
        if (!isUnlocked) {
            item.addEventListener('click', () => buyPhoto(photoObj, item));
        }

        grid.appendChild(item);
    });
}

function buyPhoto(photoObj, itemElement) {
    if (currentUser.coins < STORE_PRICE) {
        return alert(`硬幣不足！需要 ${STORE_PRICE} 枚，你現在只有 ${currentUser.coins} 枚。`);
    }

    if(confirm(`確定要花費 ${STORE_PRICE} 🪙 解鎖這張照片嗎？\n(敘述：${photoObj.desc})`)) {
        // 扣款與紀錄
        currentUser.coins -= STORE_PRICE;
        document.getElementById('coin-count').innerText = currentUser.coins;
        currentUser.unlockedPhotos.push(photoObj.id);

        // 視覺更新 (解開模糊、移除鎖頭、文字變更)
        const img = itemElement.querySelector('img');
        const overlay = itemElement.querySelector('.buy-overlay');
        const priceText = itemElement.querySelector('.price');
        
        img.classList.remove('blurred');
        if(overlay) overlay.remove();
        priceText.innerText = '🪙 已解鎖';

        // 移除點擊事件避免重複購買
        const newItem = itemElement.cloneNode(true);
        itemElement.parentNode.replaceChild(newItem, itemElement);
        
        alert("解鎖成功！快看看他的蠢樣！");
    }
}

// ==========================================
// 6. 設定頁面 (顏色與新增醜照)
// ==========================================
let extraTempDataUrl = "";

function loadSettings() {
    const myPhotos = MockDatabase[currentUser.uid].photos;
    const gallery = document.getElementById('photo-gallery');
    gallery.innerHTML = '';
    myPhotos.forEach(obj => {
        const img = document.createElement('img');
        img.src = obj.url;
        img.className = 'photo-thumb';
        img.title = obj.desc; // 游標移上去可以看到自己寫的敘述
        gallery.appendChild(img);
    });
}

document.getElementById('btn-save-colors').addEventListener('click', () => {
    const root = document.documentElement;
    root.style.setProperty('--q1-color', document.getElementById('color-q1').value);
    root.style.setProperty('--q2-color', document.getElementById('color-q2').value);
    root.style.setProperty('--q3-color', document.getElementById('color-q3').value);
    root.style.setProperty('--q4-color', document.getElementById('color-q4').value);
    alert('顏色儲存成功！時間軸上的卡牌將套用新顏色。');
    renderTimeline(); 
});

document.getElementById('extra-photo-upload').addEventListener('change', function(e) {
    if (e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            extraTempDataUrl = e.target.result;
            document.getElementById('extra-upload-preview').innerHTML = `<img src="${extraTempDataUrl}">`;
        }
        reader.readAsDataURL(e.target.files[0]);
    }
});

document.getElementById('btn-add-extra-photo').addEventListener('click', () => {
    const desc = document.getElementById('extra-photo-desc').value;
    if (!extraTempDataUrl || !desc) return alert("請選擇照片並輸入敘述！");

    const newPhotoObj = {
        id: 'p_' + Date.now(),
        url: extraTempDataUrl,
        desc: desc
    };

    MockDatabase[currentUser.uid].photos.push(newPhotoObj);
    
    // 清空並重新載入圖庫
    extraTempDataUrl = "";
    document.getElementById('extra-upload-preview').innerHTML = "預覽區";
    document.getElementById('extra-photo-desc').value = "";
    loadSettings(); 
    alert('新醜照擴充成功！朋友可以在商店看到它囉。');
});