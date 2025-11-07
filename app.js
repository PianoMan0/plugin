// ========== TIME TRACKING LOGIC ==========

// Load or initialize total time in seconds from localStorage
function getMyTotalTime() {
  return Number(localStorage.getItem('mySiteTotalTime') || 0);
}
function setMyTotalTime(secs) {
  localStorage.setItem('mySiteTotalTime', secs);
}

// Per-second timer
let mySeconds = getMyTotalTime();
setInterval(() => {
  mySeconds++;
  setMyTotalTime(mySeconds);
  updateTimeDisplay();
  updateLeaderboard();
}, 1000);

// ========== AVATAR UPLOAD & PERSISTENCE ==========

// Key in localStorage where we keep the user's avatar data URL or remote URL
const AVATAR_KEY = 'myAvatar';

// Try to load saved avatar (data URL or remote URL) from localStorage
function loadSavedAvatar() {
  const saved = localStorage.getItem(AVATAR_KEY);
  if (!saved) return null;
  return saved;
}

// Helper that always reads the current saved avatar (in case it changed this session)
function getSavedAvatar() {
  try {
    return localStorage.getItem(AVATAR_KEY) || null;
  } catch (err) {
    return null;
  }
}

// Set the sidebar avatar image element
function setSidebarAvatar(src) {
  const el = document.getElementById('my-avatar');
  if (!el) return;
  el.src = src;
}

// Wire file input for picking avatar files
function initAvatarPicker() {
  const picker = document.getElementById('avatar-picker');
  if (!picker) return;

  picker.addEventListener('change', async (e) => {
    const file = picker.files && picker.files[0];
    if (!file) return;

    // Basic validation: image type and size (limit ~2.5MB)
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      picker.value = '';
      return;
    }
    const maxSize = 2.5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Please choose an image smaller than 2.5 MB.');
      picker.value = '';
      return;
    }

    // Read file as data URL and persist
    const reader = new FileReader();
    reader.onload = function(ev) {
      const dataUrl = ev.target.result;
      try {
        localStorage.setItem(AVATAR_KEY, dataUrl);
        setSidebarAvatar(dataUrl);
        updateLeaderboard();
      } catch (err) {
        console.error('Could not save avatar to localStorage', err);
        alert('Saving your avatar failed (storage quota?).');
      }
    };
    reader.readAsDataURL(file);
  });
}

// Initialize avatar on startup
const SAVED_AVATAR = loadSavedAvatar();
if (SAVED_AVATAR) {
  setSidebarAvatar(SAVED_AVATAR);
}
initAvatarPicker();

// Format seconds as (e.g.) "2h 3m 45s" or similar
function fmtTime(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  let str = "";
  if (h) str += `${h}h `;
  if (h || m) str += `${m}m `;
  str += `${s}s`;
  return str.trim();
}

// Set user-specific coding string
function updateTimeDisplay() {
  const el = document.querySelector('.desc');
  if (el)
    el.innerHTML = `<center>You've logged <b>${fmtTime(mySeconds)}</b> on this site!</center>`;
}

// ========== LEADERBOARD ==========
let LEADERBOARD_DATA = [
  { name: "BetterClient", time: 34010, flames: 3, avatar: "Reza1290", medal: "🥇" },
  { name: "Lucas11", time: 31811, flames: 8, avatar: "neon443", flag: "🇬🇧", medal: "🥈" },
  { name: "Shadowlight", time: 30120, flames: 7, avatar: "mr125-mr", medal: "🥉" },
  { name: "Obay", time: 534, flames: 0, avatar: "MrPigeon16" },
];

// Insert self into leaderboard, re-sort by time
function updateLeaderboard() {
  // Fetch your user
  // Use the saved avatar (data URL or remote URL) if available, otherwise fall back to seed
  let mine = {
    name: "You",
    time: mySeconds,
    flames: Math.floor(mySeconds / 8000), // fun: 1 per 8000s == 2h
    avatar: getSavedAvatar() || "pianoman0",
    medal: "",
  };
  let lb = [...LEADERBOARD_DATA];
  const idx = lb.findIndex(x => x.name === 'You');
  if (idx !== -1) lb[idx] = mine;
  else lb.push(mine);

  // Sort by time descending
  lb.sort((a, b) => b.time - a.time);

  lb.forEach((u,i) => {
    u.medal = (i===0?"🥇":i===1?"🥈":i===2?"🥉":"");
    u.place = i+1;
  });

  // Update leaderboard
  const parent = document.querySelector(".leaderboard");
  if (!parent) return;
  parent.innerHTML = '';

  let head = document.createElement('div');
  head.className = 'row board-head';
  for (let i = 0; i < 5; ++i) head.appendChild(document.createElement('div'));
  parent.appendChild(head);

  // Show up to 7 top, must show YOU
  let shown = 0, meIn = false;
  for (let i = 0; i < lb.length && shown < 7; ++i) {
    let u = lb[i];
    if (u.name === "You") meIn = true;
    let row = document.createElement('div');
    row.className = 'row board-entry';
    let avatarSrc;
    if (u.avatar && (u.avatar.startsWith('http') || u.avatar.includes('/') || /\.(png|jpe?g|svg|gif)$/i.test(u.avatar))) {
      avatarSrc = u.avatar;
    } else if (u.avatar) {
      avatarSrc = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(u.avatar)}`;
    } else {
      avatarSrc = 'https://hc-cdn.hel1.your-objectstorage.com/s/v3/9daf6379eac254429942bc5ab300d58305a68065_image__18_.png';
    }

    row.innerHTML = `
      <div class="medal">${u.medal||(u.place>3?u.place:"")}</div>
      <div class="avatar"><img src="${avatarSrc}" alt="${u.name}" /></div>
      <div class="name">${u.name}${u.flag?` <span class="flag">${u.flag}</span>`:""}</div>
      <div class="flames${u.flames>=8?' danger':u.flames>=7?' warn':''}">${u.flames?`🔥 ${u.flames}`:""}</div>
      <div class="time">${fmtTime(u.time)}</div>
    `;
    parent.appendChild(row);
    shown++;
  }
  if (!meIn) {
    let mine = lb.find(x=>x.name=="You");
    let row = document.createElement('div');
    row.className = 'row board-entry';
    let mineAvatarSrc = mine.avatar && (mine.avatar.startsWith('http') || mine.avatar.includes('/') || /\.(png|jpe?g|svg|gif)$/i.test(mine.avatar))
      ? mine.avatar
      : (mine.avatar ? `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(mine.avatar)}` : 'https://hc-cdn.hel1.your-objectstorage.com/s/v3/9daf6379eac254429942bc5ab300d58305a68065_image__18_.png');

    row.innerHTML = `
      <div class="position">${mine.place}</div>
      <div class="avatar"><img src="${mineAvatarSrc}" /></div>
      <div class="name">${mine.name}</div>
      <div class="flames${mine.flames>=8?' danger':mine.flames>=7?' warn':''}">${mine.flames?`🔥 ${mine.flames}`:""}</div>
      <div class="time">${fmtTime(mine.time)}</div>
    `;
    parent.appendChild(row);
  }
}

// ========== BAR CHART ==========
const barData = {
  labels: [
    'Meow',
    'Your Project here',
    'Code code code',
    'LAST PROJECT',
    'Code Dont Sleep Repeat',
    'Grind',
    'Lock innnnn',
    'Hack the time',
    'Fraud',
    'Wheeeee'
  ],
  datasets: [{
    label: "Hours",
    data: [12.12, 9.1, 8.68, 8.02, 6.83, 5.73, 5.17, 4.25, 3.17, 3.17],
    backgroundColor: [
      '#80ffb1','#80ffb1','#80ffb1','#80ffb1','#80ffb1','#80ffb1','#80ffb1','#80ffb1','#80ffb1','#80ffb1'
    ]
  }]
};

const ctxBar = document.getElementById('barchart').getContext('2d');
new Chart(ctxBar, {
  type: 'horizontalBar' in Chart.defaults ? 'horizontalBar' : 'bar',
  data: barData,
  options: {
    indexAxis: 'y',
    scales: {
      x: {
        grid: { color: "#252530" },
        ticks: { color: "#89fcb2", font: { family: 'Outfit', size: 16 } },
      },
      y: {
        grid: { color: "#252530" },
        ticks: { color: "#fff", font: { family: 'Outfit', size: 16 } }
      }
    },
    plugins: {
      legend: { display: false }
    },
    responsive: true,
    maintainAspectRatio: false,
  }
});

// ========== PIE CHART ==========
const pieData = {
  labels: ["JavaScript", "Html", "Php", "Python", "Css", "Markdown", "Unknown", "JSON", "Meow", "Ini"],
  datasets: [{
    data: [26, 24, 17, 11, 6, 5, 4, 3, 2, 2],
    backgroundColor: [
      "#59aefc", "#f252a1", "#ffd365", "#ffe47f", "#5dfa92",
      "#7d7de9", "#72728d", "#c2e7f2", "#e67b8b", "#ffd38c"
    ],
    borderWidth: 1.5,
    borderColor: "#181820",
  }]
};

const ctxPie = document.getElementById('piechart').getContext('2d');
new Chart(ctxPie, {
  type: 'pie',
  data: pieData,
  options: {
    plugins: {
      legend: { display: false }
    }
  }
});

// Custom legend for pie chart
const pieLegendData = pieData.labels.map((lab,i)=>({
  color: pieData.datasets[0].backgroundColor[i],
  name: lab
}));
const legend = document.getElementById('pie-legend');
pieLegendData.forEach(i=>{
  const li = document.createElement('li');
  li.innerHTML = `<span class="legend-color" style="background:${i.color};"></span>${i.name}`;
  legend.appendChild(li);
});

// ========== PIE Editors ==========
const editorsData = {
  labels: ["VS Code", "Vim", "Sublime", "Atom"],
  datasets: [{
    data: [82, 10, 5, 3],
    backgroundColor: ["#50a7fc", "#4fc76a", "#f6cf41", "#ef81be"],
    borderWidth: 1.5, borderColor: "#181820"
  }]
};
const ctxE = document.getElementById('pie_editors').getContext('2d');
new Chart(ctxE, {
  type: 'pie',
  data: editorsData,
  options: { plugins: { legend: { display: false } } }
});

// ========== PIE OS ==========
const osData = {
  labels: ["Windows", "Linux", "macOS"],
  datasets: [{
    data: [52, 26, 22],
    backgroundColor: ["#64a1f4", "#7be54f", "#f687bd"],
    borderWidth: 1.5, borderColor: "#181820"
  }]
};
const ctxOS = document.getElementById('pie_os').getContext('2d');
new Chart(ctxOS, {
  type: 'pie',
  data: osData,
  options: { plugins: { legend: { display: false } } }
});

// ========== STACKED BAR (Activity by date/project) ==========
const stackedbarData = {
  labels: ["May 11", "May 25", "Jun 6", "Jun 22", "Jul 6", "Aug 17", "Sep 14", "Sep 28", "Oct 26"],
  datasets: [
    {
      label: "Meow", data: [2,4,1,6,3,2,8,5,3], backgroundColor: "#ffd365"
    },
    {
      label: "Your project here", data: [1,0,2,1,1,2,1,2,2], backgroundColor: "#7d7de9"
    },
    {
      label: "Code code code", data: [2,2,1,2,0,3,2,2,3], backgroundColor: "#5dfa92"
    },
    {
      label: "LAST PROJECT", data: [0,2,1,2,2,2,2,2,0], backgroundColor: "#ef81be"
    },
    {
      label: "Code Dont Sleep Repeat", data: [1,2,0,1,2,2,2,0,1], backgroundColor: "#f687bd"
    },
    {
      label: "Grind", data: [1,1,2,2,1,0,2,2,1], backgroundColor: "#ffd38c"
    }
  ]
};
const ctxStacked = document.getElementById('stackedbar').getContext('2d');
new Chart(ctxStacked, {
  type: 'bar',
  data: stackedbarData,
  options: {
    plugins: { legend: { labels: { color: "#fff" } } },
    scales: {
      x: { stacked: true, grid: { color:'#252530'}, ticks: {color:'#fff'} },
      y: { stacked: true, grid: { color:'#252530'}, ticks: {color:'#fff'} }
    },
    responsive: true,
    maintainAspectRatio: false,
  }
});

// ========== Contribution Grid ==========
function randomLevel() {
  const r = Math.random();
  if (r > 0.93) return 4;
  if (r > 0.8) return 3;
  if (r > 0.5) return 2;
  if (r > 0.32) return 1;
  return 0;
}
const grid = document.getElementById("contrib-grid");
for (let i = 0; i < 37 * 7; ++i) {
  const div = document.createElement("div");
  let level = randomLevel();
  div.className = "contrib-cell" + (level ? ` level-${level}` : "");
  grid.appendChild(div);
}