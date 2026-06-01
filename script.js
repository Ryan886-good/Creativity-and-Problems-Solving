const MockDatabase = {
    "user_123": { name: "小明", photo: "https://api.dicebear.com/7.x/adventurer/svg?seed=Ming" }
};
let currentUser = { uid: null, name: "", coins: 0, photoDataUrl: "" };
let tasks = [];
let activeTask = null; 

// 時間軸縮放比例 (每天等於多少 pixel)
const PX_PER_DAY = 20;
// 起始位移 (今天在時間軸上的起點)
const TIMELINE_START_OFFSET = 40;

const quadrantColors = {
    "重要且緊急": "var(--q1-red)",
    "重要不緊急": "var(--q2-orange)",
    "不重要且緊急": "var(--q3-green)",
    "不重要不緊急": "var(--q4-blue)"
};

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

// 登入邏輯
document.getElementById('photo-upload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            currentUser.photoDataUrl = e.target.result;
            document.getElementById('upload-preview').innerHTML = `<img src="${currentUser.photoDataUrl}">`;
        }
        reader.readAsDataURL(file);
    }
});

document.getElementById('btn-register').addEventListener('click', () => {
    const name = document.getElementById('username-input').value;
    if (!name || !currentUser.photoDataUrl) return alert('請輸入暱稱並上傳照片！');
    
    currentUser.uid = "user_" + Math.floor(Math.random() * 10000);
    currentUser.name = name;
    MockDatabase[currentUser.uid] = { name: currentUser.name, photo: currentUser.photoDataUrl };
    
    document.getElementById('my-uid-display').innerText = `我的 ID: ${currentUser.uid}`;
    document.getElementById('app-header').classList.remove('hidden');
    switchScreen('screen-tasks');
    
    // 初始化時先畫出時間軸的月份刻度
    renderTimeline();
});

let selectedType = "報告";
let selectedQuadrant = "重要不緊急";

document.getElementById('toggle-btn').addEventListener('click', function() {
    const details = document.getElementById('details-area');
    if (details.style.display === 'block') {
        details.style.display = 'none';
        this.innerText = '▼ 詳細設定';
    } else {
        details.style.display = 'block';
        this.innerText = '▲ 收起設定';
    }
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

// --- 任務飛入時間軸 ---
document.getElementById('submit-btn').addEventListener('click', () => {
    const name = document.getElementById('task-name').value;
    const dateStr = document.getElementById('task-date').value;
    const notesStr = document.getElementById('task-notes').value;
    if (!name || !dateStr) return alert("請填寫名稱與截止日期！");

    const today = new Date();
    today.setHours(0,0,0,0);
    const deadline = new Date(dateStr + 'T00:00:00');
    
    if (deadline < today) return alert("日期必須在今天之後！");

    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // 透過公式決定 X 軸位置
    const leftPos = TIMELINE_START_OFFSET + (diffDays * PX_PER_DAY); 

    const task = {
        id: Date.now(), 
        name: name, 
        dateStr: dateStr, 
        color: quadrantColors[selectedQuadrant],
        type: selectedType, 
        quadrant: selectedQuadrant, 
        notes: notesStr,
        daysLeft: diffDays,
        leftPos: leftPos
    };
    
    tasks.push(task);
    renderTimeline();
    
    document.getElementById('task-name').value = '';
    document.getElementById('task-notes').value = '';
});

// --- 動態生成時間軸、月份與卡牌 ---
function renderTimeline() {
    const track = document.getElementById('timeline-track');
    // 清空舊有內容 (保留軌道的底線)
    track.querySelectorAll('.task-card, .month-marker').forEach(el => el.remove());

    const today = new Date();
    today.setHours(0,0,0,0);

    // 1. 動態畫出未來 6 個月的月份刻度
    for (let i = 0; i < 6; i++) {
        let markerDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
        let diffDays = 0;
        let labelText = `${markerDate.getMonth() + 1}月`;

        // 如果是第一個月(當下月)，標示在起始點，並顯示「今天」
        if (i === 0) {
            diffDays = 0;
            labelText = `今天 (${today.getMonth() + 1}/${today.getDate()})`;
        } else {
            diffDays = (markerDate.getTime() - today.getTime()) / (1000 * 3600 * 24);
        }

        const leftPos = TIMELINE_START_OFFSET + (diffDays * PX_PER_DAY);
        
        const marker = document.createElement('div');
        marker.className = 'month-marker';
        marker.innerText = labelText;
        marker.style.left = `${leftPos}px`;
        track.appendChild(marker);
    }

    // 動態加長軌道寬度 (根據最遠的任務)
    let maxLeftPos = 1200; // 預設至少 1200px 寬
    
    // 2. 統計「同一天」有幾個任務，準備垂直排列
    const dateCounts = {};
    tasks.forEach(task => {
        if (!dateCounts[task.dateStr]) dateCounts[task.dateStr] = 0;
        task.stackIndex = dateCounts[task.dateStr]; // 該日的第幾個任務
        dateCounts[task.dateStr]++;
        
        if (task.leftPos > maxLeftPos) maxLeftPos = task.leftPos + 100;
    });

    track.style.width = `${maxLeftPos}px`;

    // 3. 畫出任務卡牌並計算 Y 軸上下堆疊
    tasks.forEach(task => {
        const totalOnDay = dateCounts[task.dateStr];
        
        // 垂直置中排列公式：基底50%，每一張卡牌間距 18%
        const baseTop = 50;
        const spacing = 18; 
        const topPos = baseTop + (task.stackIndex - (totalOnDay - 1) / 2) * spacing;

        const card = document.createElement('div');
        card.className = 'task-card';
        card.style.background = task.color;
        card.style.left = `${task.leftPos}px`;
        
        track.appendChild(card);

        setTimeout(() => {
            card.style.top = `${topPos}%`;
            card.style.opacity = '1';
        }, 50);

        card.addEventListener('click', () => openPanel(task));
    });
}

// 取得鼓勵/嘲諷語句
function getQuoteByDays(days) {
    if (days <= 1) return "鼠拉！";
    if (days <= 3) return "火燒屁股囉！";
    if (days <= 7) return "有點急囉！";
    if (days <= 14) return "安啦！";
    if (days <= 30) return "不慌張";
    return "輕輕鬆鬆"; 
}

function openPanel(task) {
    activeTask = task;
    document.getElementById('panel-title').innerText = task.name;
    document.getElementById('panel-title').style.borderColor = task.color; 
    document.getElementById('panel-quadrant').innerText = task.quadrant;
    document.getElementById('panel-type').innerText = `#${task.type}`;
    document.getElementById('panel-date').innerText = task.dateStr;
    document.getElementById('panel-days').innerText = task.daysLeft;
    document.getElementById('panel-quote').innerText = getQuoteByDays(task.daysLeft);
    document.getElementById('panel-notes-content').innerText = task.notes ? task.notes : "無";
    document.getElementById('info-panel').style.display = 'block';
}

document.getElementById('close-panel').addEventListener('click', () => {
    document.getElementById('info-panel').style.display = 'none';
});

document.getElementById('task-complete-btn').addEventListener('click', (e) => {
    if (!activeTask) return;
    
    const btnRect = e.target.getBoundingClientRect();
    const coinIcon = document.querySelector('.coin-display').getBoundingClientRect();
    
    const coin = document.createElement('div');
    coin.className = 'flying-coin';
    coin.innerText = '🪙';
    coin.style.left = `${btnRect.left + btnRect.width/2}px`;
    coin.style.top = `${btnRect.top}px`;
    document.body.appendChild(coin);

    setTimeout(() => {
        coin.style.left = `${coinIcon.left}px`;
        coin.style.top = `${coinIcon.top}px`;
        coin.style.transform = 'scale(0.5)';
    }, 50);

    coin.addEventListener('transitionend', () => {
        coin.remove();
        currentUser.coins++;
        document.getElementById('coin-count').innerText = currentUser.coins;
    });

    document.getElementById('info-panel').style.display = 'none';
    tasks = tasks.filter(t => t.id !== activeTask.id);
    renderTimeline();
});

document.getElementById('btn-go-store').addEventListener('click', () => switchScreen('screen-store'));
document.getElementById('btn-back-tasks').addEventListener('click', () => switchScreen('screen-tasks'));

document.getElementById('btn-unlock').addEventListener('click', () => {
    const targetId = document.getElementById('friend-id-input').value;
    if (!targetId) return alert('請輸入朋友 ID！');
    if (currentUser.coins < 2) return alert('硬幣不足！需要 2 枚。');

    const friend = MockDatabase[targetId];
    if (friend) {
        currentUser.coins -= 2;
        document.getElementById('coin-count').innerText = currentUser.coins;
        document.getElementById('unlocked-name').innerText = `這是 ${friend.name} 的醜照！`;
        document.getElementById('unlocked-photo').src = friend.photo;
        document.getElementById('unlock-result').classList.remove('hidden');
    } else {
        alert('找不到這個 ID！');
    }
});