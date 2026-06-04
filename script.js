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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// ==========================================
// 2. 全域變數
// ==========================================
let currentUser = { uid: null, name: "", coins: 1000, unlockedPhotos: [], friends: [], tasks: [] }; 
let tempPhotoDataUrl = ""; 
let extraTempDataUrl = "";
let tasks = [];
let activeTask = null; 
let editingTaskId = null; 
let authMode = 'login'; 
const STORE_PRICE = 300; 

const quadrantVarMap = {
    "重要且緊急": "--q1-color", "重要不緊急": "--q2-color",
    "不重要且緊急": "--q3-color", "不重要不緊急": "--q4-color"
};
const PX_PER_DAY = 100; // 擴大每日像素，讓時間錯開更明顯
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
document.getElementById('back-to-store-from-collection').addEventListener('click', () => switchScreen('screen-store'));

// ==========================================
// 3. 登入與註冊
// ==========================================
document.getElementById('tab-login').addEventListener('click', function() {
    authMode = 'login';
    this.classList.add('active');
    document.getElementById('tab-register').classList.remove('active');
    document.getElementById('register-fields').classList.add('hidden');
});

document.getElementById('tab-register').addEventListener('click', function() {
    authMode = 'register';
    this.classList.add('active');
    document.getElementById('tab-login').classList.remove('active');
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
                currentUser.friends = userData.friends || [];
                tasks = userData.tasks || [];
                loginSuccess(username, userData.name);
            } else {
                alert('帳號不存在或密碼錯誤！');
            }
        } catch (error) {
            console.error("登入錯誤:", error);
            alert("登入失敗，請檢查網路連線。");
        }
    } else {
        const nickname = document.getElementById('nickname-input').value.trim();
        const desc = document.getElementById('photo-desc-input').value.trim();
        if (!nickname || !tempPhotoDataUrl || !desc) return alert('請完整填寫並上傳照片！');
        
        try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) return alert('此帳號已註冊！');

            alert("正在建立雲端分身，請稍候...");
            const photoId = 'p_' + Date.now();
            const storageRef = ref(storage, `photos/${username}_${photoId}`);
            await uploadString(storageRef, tempPhotoDataUrl, 'data_url');
            const downloadURL = await getDownloadURL(storageRef);

            const newPhotoObj = { id: photoId, url: downloadURL, desc: desc };
            await setDoc(userDocRef, {
                password: password, name: nickname, coins: 1000, 
                unlockedPhotos: [], friends: [], tasks: [],
                photos: [newPhotoObj] 
            });

            tasks = [];
            loginSuccess(username, nickname);
            alert(`🎉 建立成功！你的 ID 為：${username}`);
        } catch (error) {
            console.error("註冊錯誤:", error);
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
    renderFriendsList();
}

// ==========================================
// 4. 任務建立與時間軸 (完美強制左右排序版)
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

async function saveTasksToCloud() {
    try {
        await updateDoc(doc(db, "users", currentUser.uid), { tasks: tasks });
    } catch(e) { console.error("任務同步失敗", e); }
}

document.getElementById('submit-btn').addEventListener('click', async () => {
    const name = document.getElementById('task-name').value.trim();
    const startStr = document.getElementById('task-start').value;
    const endStr = document.getElementById('task-end').value;
    const notesStr = document.getElementById('task-notes').value;
    
    if (!name || !startStr || !endStr) return alert("請填寫名稱、開始與結束時間！");
    if (new Date(startStr) >= new Date(endStr)) return alert("結束時間必須晚於開始時間！");

    const taskData = { name, startStr, endStr, type: selectedType, quadrant: selectedQuadrant, notes: notesStr };

    if (editingTaskId) {
        const index = tasks.findIndex(t => t.id === editingTaskId);
        tasks[index] = { ...tasks[index], ...taskData };
        exitEditMode();
    } else {
        taskData.id = Date.now();
        tasks.push(taskData);
    }
    
    await saveTasksToCloud(); 
    document.getElementById('task-name').value = '';
    document.getElementById('task-notes').value = '';
    renderTimeline();
    
    document.getElementById('details-area').style.display = 'none';
    document.getElementById('toggle-btn').innerText = '▼ 詳細設定';
});

// 核心時間軸渲染邏輯
function renderTimeline() {
    const track = document.getElementById('timeline-track');
    const arrowHead = document.getElementById('arrow-head');
    track.querySelectorAll('.task-card, .month-marker').forEach(el => el.remove());

    const today = new Date();
    today.setHours(0,0,0,0);

    let maxDays = 30; 
    if (tasks.length > 0) {
        tasks.forEach(t => { 
            const tDate = new Date(t.startStr);
            const diff = (tDate.getTime() - today.getTime()) / (1000 * 3600 * 24);
            if(diff > maxDays) maxDays = diff; 
        });
    }
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

    if(tasks.length === 0) return;

    // 1. 嚴格依據精確時間進行先後排序
    tasks.sort((a, b) => new Date(a.startStr) - new Date(b.startStr));

    const timeCounts = {};
    tasks.forEach(task => {
        // 只以「完整的年月日時分」做堆疊計數，不再以「天」做堆疊
        if (!timeCounts[task.startStr]) timeCounts[task.startStr] = 0;
        timeCounts[task.startStr]++;
    });

    let currentLeft = TIMELINE_START_OFFSET;
    let lastTime = null;
    let currentStackIndex = 0;

    tasks.forEach(task => {
        const tDate = new Date(task.startStr);
        const diffDaysFloat = (tDate.getTime() - today.getTime()) / (1000 * 3600 * 24);
        let calculatedLeft = TIMELINE_START_OFFSET + (diffDaysFloat * PX_PER_DAY);

        if (task.startStr === lastTime) {
            // 只有當時間「完全一模一樣(連分鐘都相同)」時，才會在同一個X軸上下堆疊
            currentStackIndex++;
            task.leftPos = currentLeft; 
        } else {
            // 時間不同，強制往右移！即使只差1分鐘，也強制確保至少有 16px 的左右間距
            if (lastTime !== null && calculatedLeft < currentLeft + 16) {
                calculatedLeft = currentLeft + 16;
            }
            currentLeft = calculatedLeft;
            task.leftPos = calculatedLeft;
            currentStackIndex = 0; // 重置高度
        }
        
        task.stackIndex = currentStackIndex;
        lastTime = task.startStr;
    });

    const maxLeft = tasks[tasks.length - 1].leftPos;
    const requiredWidth = Math.max(
        TIMELINE_START_OFFSET + (maxMonths * 30 * PX_PER_DAY) + 60,
        maxLeft + 100
    );
    track.style.width = `${requiredWidth}px`;
    arrowHead.style.left = `${requiredWidth - 10}px`;

    tasks.forEach(task => {
        const totalOnTime = timeCounts[task.startStr];
        const topPos = 50 + (task.stackIndex - (totalOnTime - 1) / 2) * 18;
        
        const card = document.createElement('div');
        card.className = 'task-card';
        card.style.background = `var(${quadrantVarMap[task.quadrant]})`;
        card.style.left = `${task.leftPos}px`;
        card.title = `${task.name}\n開始: ${task.startStr.replace('T', ' ')}`; 
        
        track.appendChild(card);
        setTimeout(() => { card.style.top = `${topPos}%`; card.style.opacity = '1'; }, 50);
        card.addEventListener('click', () => openPanel(task));
    });
}

function openPanel(task) {
    activeTask = task;
    document.getElementById('panel-title').innerText = task.name;
    document.getElementById('panel-title').style.borderColor = `var(${quadrantVarMap[task.quadrant]})`; 
    document.getElementById('panel-quadrant').innerText = task.quadrant;
    document.getElementById('panel-type').innerText = `#${task.type}`;
    document.getElementById('panel-start').innerText = task.startStr.replace('T', ' ');
    document.getElementById('panel-end').innerText = task.endStr.replace('T', ' ');
    document.getElementById('panel-notes-content').innerText = task.notes ? task.notes : "無";
    document.getElementById('info-panel').style.display = 'block';
}

document.getElementById('close-panel').addEventListener('click', () => { document.getElementById('info-panel').style.display = 'none'; });

document.getElementById('task-delete-btn').addEventListener('click', async () => {
    if(confirm('確定要刪除這個任務嗎？')) {
        tasks = tasks.filter(t => t.id !== activeTask.id);
        await saveTasksToCloud(); 
        document.getElementById('info-panel').style.display = 'none';
        renderTimeline();
    }
});

document.getElementById('task-edit-btn').addEventListener('click', () => {
    editingTaskId = activeTask.id;
    document.getElementById('task-name').value = activeTask.name;
    document.getElementById('task-start').value = activeTask.startStr;
    document.getElementById('task-end').value = activeTask.endStr;
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

function exitEditMode() {
    editingTaskId = null;
    document.querySelector('.input-container').classList.remove('editing-mode');
    document.getElementById('submit-btn').innerText = '確定飛入';
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    document.getElementById('task-name').value = ''; document.getElementById('task-notes').value = '';
}
document.getElementById('cancel-edit-btn').addEventListener('click', exitEditMode);

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
        currentUser.coins+=1; 
        document.getElementById('coin-count').innerText = currentUser.coins;
        try {
            await updateDoc(doc(db, "users", currentUser.uid), { coins: currentUser.coins });
        } catch(e) { console.error("硬幣同步失敗", e); }
    }, { once: true });

    document.getElementById('info-panel').style.display = 'none';
    tasks = tasks.filter(t => t.id !== activeTask.id);
    await saveTasksToCloud(); 
    renderTimeline();
});

// ==========================================
// 5. 加入好友與戰利品收集櫃
// ==========================================
document.getElementById('btn-go-store').addEventListener('click', () => switchScreen('screen-store'));
document.getElementById('btn-collection').addEventListener('click', () => {
    renderCollectionGrid();
    switchScreen('screen-collection');
});

document.getElementById('btn-add-friend').addEventListener('click', async () => {
    const targetId = document.getElementById('friend-id-input').value.trim();
    if (!targetId) return alert('請輸入朋友 ID！');
    if (targetId === currentUser.uid) return alert('不能加自己啦！');
    if (currentUser.friends.some(f => f.uid === targetId)) return alert('這個人已經在你的好友名單囉！');

    try {
        const friendDocRef = doc(db, "users", targetId);
        const docSnap = await getDoc(friendDocRef);

        if (docSnap.exists()) {
            const friendName = docSnap.data().name;
            currentUser.friends.push({ uid: targetId, name: friendName });
            await updateDoc(doc(db, "users", currentUser.uid), { friends: currentUser.friends });
            
            document.getElementById('friend-id-input').value = '';
            renderFriendsList();
            alert(`成功加入好友：${friendName}！`);
        } else {
            alert('找不到這個 ID！');
        }
    } catch (error) { console.error(error); }
});

function renderFriendsList() {
    const list = document.getElementById('friends-list');
    list.innerHTML = '';
    
    if (currentUser.friends.length === 0) {
        list.innerHTML = '<span style="font-size:12px; color:gray;">目前還沒有好友，趕快輸入 ID 加入吧！</span>';
        return;
    }

    currentUser.friends.forEach(f => {
        const btn = document.createElement('button');
        btn.className = 'friend-pill';
        btn.innerText = `👤 ${f.name}`;
        btn.addEventListener('click', () => openFriendStore(f.uid, f.name));
        list.appendChild(btn);
    });
}

async function openFriendStore(friendUid, friendName) {
    try {
        const docSnap = await getDoc(doc(db, "users", friendUid));
        if (docSnap.exists()) {
            const friendData = docSnap.data();
            if (friendData.photos && friendData.photos.length > 0) {
                document.getElementById('store-gallery').classList.remove('hidden');
                document.getElementById('store-friend-name').innerText = `✨ ${friendName} 的珍藏相簿`;
                renderCloudStoreGrid(friendData.photos, friendUid); 
            } else {
                document.getElementById('store-gallery').classList.add('hidden');
                alert(`${friendName} 還沒有上傳任何照片！`);
            }
        }
    } catch (e) { console.error(e); }
}

function renderCloudStoreGrid(photos, friendUid) {
    const grid = document.getElementById('store-grid');
    grid.innerHTML = ''; 

    photos.forEach(photoObj => {
        const isUnlocked = currentUser.unlockedPhotos.some(p => {
            if (typeof p === 'string') return p === photoObj.id;
            return p.id === photoObj.id;
        });

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
            currentUser.unlockedPhotos.push(photoObj);

            const myDocRef = doc(db, "users", currentUser.uid);
            await updateDoc(myDocRef, {
                coins: currentUser.coins,
                unlockedPhotos: currentUser.unlockedPhotos
            });

            document.getElementById('coin-count').innerText = currentUser.coins;
            const img = itemElement.querySelector('img');
            const overlay = itemElement.querySelector('.buy-overlay');
            const priceText = itemElement.querySelector('.price');
            img.classList.remove('blurred');
            if (overlay) overlay.remove();
            priceText.innerText = '🪙 已解鎖';

            const newItem = itemElement.cloneNode(true);
            itemElement.parentNode.replaceChild(newItem, itemElement);
            alert("解鎖成功！照片已放入收集櫃。");
        } catch (error) { console.error("扣款失敗:", error); }
    }
}

function renderCollectionGrid() {
    const grid = document.getElementById('collection-grid');
    grid.innerHTML = '';
    
    const validPhotos = currentUser.unlockedPhotos.filter(p => typeof p === 'object' && p.url);

    if (validPhotos.length === 0) {
        grid.innerHTML = '<span style="grid-column: span 3; font-size: 13px; color: gray;">你還沒有解鎖任何照片喔！（舊版解鎖的無法顯示）</span>';
        return;
    }

    validPhotos.forEach(photoObj => {
        const item = document.createElement('div');
        item.className = 'store-item';
        
        item.innerHTML = `
            <div class="store-item-img-wrap" style="border-color: var(--primary);">
                <img src="${photoObj.url}" alt="photo">
            </div>
            <div class="desc">${photoObj.desc}</div>
            <button class="download-btn">⬇️ 下載</button>
        `;

        item.querySelector('.download-btn').addEventListener('click', (e) => {
            forceDownload(photoObj.url, `醜照戰利品_${photoObj.id}.png`);
        });
        grid.appendChild(item);
    });
}

async function forceDownload(url, filename) {
    try {
        alert("圖片下載中...");
        const response = await fetch(url);
        const blob = await response.blob(); 
        const blobUrl = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        a.remove();
    } catch (error) { window.open(url, '_blank'); }
}

// ==========================================
// 6. 設定頁面與登出
// ==========================================
async function loadSettings() {
    try {
        const docSnap = await getDoc(doc(db, "users", currentUser.uid));
        if (docSnap.exists()) {
            const gallery = document.getElementById('photo-gallery');
            gallery.innerHTML = '';
            (docSnap.data().photos || []).forEach(obj => {
                const img = document.createElement('img');
                img.src = obj.url;
                img.className = 'photo-thumb';
                img.title = obj.desc; 
                gallery.appendChild(img);
            });
        }
    } catch (error) { console.error(error); }
}

document.getElementById('btn-save-colors').addEventListener('click', () => {
    const root = document.documentElement;
    root.style.setProperty('--q1-color', document.getElementById('color-q1').value);
    root.style.setProperty('--q2-color', document.getElementById('color-q2').value);
    root.style.setProperty('--q3-color', document.getElementById('color-q3').value);
    root.style.setProperty('--q4-color', document.getElementById('color-q4').value);
    alert('顏色套用成功！');
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
    if (!extraTempDataUrl || !desc) return alert("請上傳照片並輸入敘述！");

    try {
        alert("照片上傳中...");
        const photoId = 'p_' + Date.now();
        const storageRef = ref(storage, `photos/${currentUser.uid}_${photoId}`);
        await uploadString(storageRef, extraTempDataUrl, 'data_url');
        const downloadURL = await getDownloadURL(storageRef);

        const newPhotoObj = { id: photoId, url: downloadURL, desc: desc };
        await updateDoc(doc(db, "users", currentUser.uid), { photos: arrayUnion(newPhotoObj) });

        extraTempDataUrl = "";
        document.getElementById('extra-upload-preview').innerHTML = "預覽區";
        document.getElementById('extra-photo-desc').value = "";
        
        await loadSettings(); 
        alert('照片擴充成功！');
    } catch (error) { console.error(error); }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    if (confirm('確定要登出這個帳號嗎？')) {
        currentUser = { uid: null, name: "", coins: 0, unlockedPhotos: [], friends: [], tasks: [] };
        document.getElementById('app-header').classList.add('hidden');
        tasks = [];
        document.getElementById('timeline-track').innerHTML = '<div class="arrow-line"></div><div class="arrow-head" id="arrow-head"></div>';
        document.getElementById('password-input').value = '';
        switchScreen('screen-login');
    }
});