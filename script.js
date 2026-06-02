// ==========================================
// 1. 初始化 Firebase 與雲端服務
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBsb1vYPgbTSsL6W0LqBoEeaNyET2GHYRo",
  authDomain: "uglyphototaskmanager.firebaseapp.com",
  projectId: "uglyphototaskmanager",
  storageBucket: "uglyphototaskmanager.firebasestorage.app",
  messagingSenderId: "54659205691",
  appId: "1:54659205691:web:50402b5e81fe07a536aa1e"
};

// 啟動雲端連線
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// ==========================================
// 2. 全域變數與介面切換
// ==========================================
let currentUser = { uid: null, name: "", coins: 1000, unlockedPhotos: [] }; 
let tempPhotoDataUrl = ""; 
let extraTempDataUrl = "";
let tasks = [];
let activeTask = null; 
let editingTaskId = null; 
let authMode = 'login'; // 預設為登入模式
const STORE_PRICE = 300; 

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
// 3. 登入與註冊 (全雲端化)
// ==========================================
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

document.getElementById('btn-auth-submit').addEventListener('click', async () => {
    const username = document.getElementById('username-input').value.trim();
    const password = document.getElementById('password-input').value;
    
    if (!username || !password) return alert('請輸入帳號與密碼！');

    const userDocRef = doc(db, "users", username); 

    if (authMode === 'login') {
        try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists() && docSnap.data().password === password) {
                const userData = docSnap.data();
                currentUser.coins = userData.coins !== undefined ? userData.coins : 1000; 
                currentUser.unlockedPhotos = userData.unlockedPhotos || [];
                loginSuccess(username, userData.name);
            } else {
                alert('帳號不存在或密碼錯誤！');
            }
        } catch (error) {
            console.error("登入錯誤:", error);
            alert("登入失敗，請檢查網路連線。");
        }
    } else {
        // 註冊模式
        const nickname = document.getElementById('nickname-input').value.trim();
        const desc = document.getElementById('photo-desc-input').value.trim();
        if (!nickname || !tempPhotoDataUrl || !desc) return alert('請完整填寫暱稱、上傳照片並附上敘述！');
        
        try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) return alert('此帳號 ID 已被註冊！請換一個。');

            alert("正在建立雲端分身，照片上傳中...");
            const photoId = 'p_' + Date.now();
            const storageRef = ref(storage, `photos/${username}_${photoId}`);
            
            await uploadString(storageRef, tempPhotoDataUrl, 'data_url');
            const downloadURL = await getDownloadURL(storageRef);

            const newPhotoObj = { id: photoId, url: downloadURL, desc: desc };
            await setDoc(userDocRef, {
                password: password,
                name: nickname,
                coins: 1000, 
                unlockedPhotos: [],
                photos: [newPhotoObj] 
            });

            loginSuccess(username, nickname);
            alert(`🎉 建立成功！你的專屬 ID 為：${username}`);
        } catch (error) {
            console.error("註冊錯誤:", error);
            alert("註冊失敗，請確認 Firebase 測試模式是否開啟。");
        }
    }
});

function loginSuccess(uid, name) {
    currentUser.uid = uid;
    currentUser.name = name;
    document.getElementById('coin-count').innerText = currentUser.coins;
    document.getElementById('my-uid-display').innerText = `我的 ID: ${currentUser.uid}`;
    document.getElementById('app-header').classList.remove('hidden');
    switchScreen('screen-tasks');
    renderTimeline();
}

// ==========================================
// 4. 任務建立、修改與時間軸
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

document.getElementById('task-complete-btn').addEventListener('click', async (e) => {
    const btnRect = e.target.getBoundingClientRect();
    const coinIcon = document.querySelector('.coin-display').getBoundingClientRect();
    const coin = document.createElement('div');
    coin.className = 'flying-coin';
    coin.innerText = '🪙';
    coin.style.left = `${btnRect.left + btnRect.width/2}px`;
    coin.style.top = `${btnRect.top}px`;
    document.body.appendChild(coin);
    
    setTimeout(() => { coin.style.left = `${coinIcon.left}px`; coin.style.top = `${coinIcon.top}px`; coin.style.transform = 'scale(0.5)'; }, 50);
    
    coin.addEventListener('transitionend', async () => {
        coin.remove();
        currentUser.coins++;
        document.getElementById('coin-count').innerText = currentUser.coins;
        
        // 任務完成，把硬幣數量同步到雲端
        try {
            const myDocRef = doc(db, "users", currentUser.uid);
            await updateDoc(myDocRef, { coins: currentUser.coins });
        } catch(e) { console.error("硬幣同步失敗", e); }
    });

    document.getElementById('info-panel').style.display = 'none';
    tasks = tasks.filter(t => t.id !== activeTask.id);
    renderTimeline();
});

// ==========================================
// 5. 商店系統 (全雲端化)
// ==========================================
document.getElementById('btn-go-store').addEventListener('click', () => switchScreen('screen-store'));

document.getElementById('btn-search-friend').addEventListener('click', async () => {
    const targetId = document.getElementById('friend-id-input').value.trim();
    if (!targetId) return alert('請輸入朋友 ID！');
    if (targetId === currentUser.uid) return alert('不能搜尋自己啦！');

    try {
        const friendDocRef = doc(db, "users", targetId);
        const docSnap = await getDoc(friendDocRef);

        if (docSnap.exists()) {
            const friendData = docSnap.data();
            if (friendData.photos && friendData.photos.length > 0) {
                document.getElementById('store-gallery').classList.remove('hidden');
                document.getElementById('store-friend-name').innerText = `✨ ${friendData.name} 的珍藏相簿`;
                renderCloudStoreGrid(friendData.photos, targetId); 
            } else {
                alert('這個用戶還沒有上傳任何照片！');
            }
        } else {
            alert('找不到這個 ID！請確認輸入是否正確。');
        }
    } catch (error) {
        console.error("搜尋失敗:", error);
    }
});

function renderCloudStoreGrid(photos, friendUid) {
    const grid = document.getElementById('store-grid');
    grid.innerHTML = ''; 

    photos.forEach(photoObj => {
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

        if (!isUnlocked) {
            item.addEventListener('click', () => buyCloudPhoto(photoObj, item, friendUid));
        }
        grid.appendChild(item);
    });
}

async function buyCloudPhoto(photoObj, itemElement, friendUid) {
    if (currentUser.coins < STORE_PRICE) return alert(`硬幣不足！需要 ${STORE_PRICE} 枚。`);

    if (confirm(`花費 ${STORE_PRICE} 🪙 解鎖這張照片？\n(敘述：${photoObj.desc})`)) {
        try {
            currentUser.coins -= STORE_PRICE;
            currentUser.unlockedPhotos.push(photoObj.id);

            const myDocRef = doc(db, "users", currentUser.uid);
            await updateDoc(myDocRef, {
                coins: currentUser.coins,
                unlockedPhotos: currentUser.unlockedPhotos
            });

            // 分潤機制：錢給朋友
            const friendDocRef = doc(db, "users", friendUid);
            const friendSnap = await getDoc(friendDocRef);
            if (friendSnap.exists()) {
                await updateDoc(friendDocRef, { coins: (friendSnap.data().coins || 0) + STORE_PRICE });
            }

            document.getElementById('coin-count').innerText = currentUser.coins;
            const img = itemElement.querySelector('img');
            const overlay = itemElement.querySelector('.buy-overlay');
            const priceText = itemElement.querySelector('.price');
            
            img.classList.remove('blurred');
            if (overlay) overlay.remove();
            priceText.innerText = '🪙 已解鎖';

            const newItem = itemElement.cloneNode(true);
            itemElement.parentNode.replaceChild(newItem, itemElement);
            
            alert("解鎖成功！");
        } catch (error) {
            console.error("扣款失敗:", error);
        }
    }
}

// ==========================================
// 6. 設定頁面 (全雲端化)
// ==========================================
async function loadSettings() {
    try {
        const myDocRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(myDocRef);
        
        if (docSnap.exists()) {
            const myPhotos = docSnap.data().photos || [];
            const gallery = document.getElementById('photo-gallery');
            gallery.innerHTML = '';
            
            myPhotos.forEach(obj => {
                const img = document.createElement('img');
                img.src = obj.url;
                img.className = 'photo-thumb';
                img.title = obj.desc; 
                gallery.appendChild(img);
            });
        }
    } catch (error) {
        console.error("載入圖庫失敗:", error);
    }
}

document.getElementById('btn-save-colors').addEventListener('click', () => {
    const root = document.documentElement;
    root.style.setProperty('--q1-color', document.getElementById('color-q1').value);
    root.style.setProperty('--q2-color', document.getElementById('color-q2').value);
    root.style.setProperty('--q3-color', document.getElementById('color-q3').value);
    root.style.setProperty('--q4-color', document.getElementById('color-q4').value);
    alert('顏色儲存成功！時間軸將套用新色。');
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

document.getElementById('btn-add-extra-photo').addEventListener('click', async () => {
    const desc = document.getElementById('extra-photo-desc').value.trim();
    if (!extraTempDataUrl || !desc) return alert("請選擇照片並輸入敘述！");

    try {
        alert("照片上傳雲端中...");
        const photoId = 'p_' + Date.now();
        const storageRef = ref(storage, `photos/${currentUser.uid}_${photoId}`);
        
        await uploadString(storageRef, extraTempDataUrl, 'data_url');
        const downloadURL = await getDownloadURL(storageRef);

        const myDocRef = doc(db, "users", currentUser.uid);
        const newPhotoObj = { id: photoId, url: downloadURL, desc: desc };

        await updateDoc(myDocRef, {
            photos: arrayUnion(newPhotoObj)
        });

        extraTempDataUrl = "";
        document.getElementById('extra-upload-preview').innerHTML = "預覽區";
        document.getElementById('extra-photo-desc').value = "";
        
        await loadSettings(); 
        alert('新照片擴充成功！');
    } catch (error) {
        console.error("擴充相簿失敗:", error);
    }
});