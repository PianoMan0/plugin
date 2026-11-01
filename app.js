const TIME_KEY = 'mySiteTotalTime';
const AVATAR_KEY = 'myAvatar';
const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/identicon/svg?seed=pianoman0';
const MAX_AVATAR_SIZE = 2.5 * 1024 * 1024;
let storageWarningShown = false;

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    if (!storageWarningShown) {
      console.error('Browser storage is unavailable; changes will not persist.', error);
      storageWarningShown = true;
    }
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (!storageWarningShown) {
      console.error('Browser storage is unavailable; changes will not persist.', error);
      storageWarningShown = true;
    }
    return false;
  }
}

function getMyTotalTime() {
  const seconds = Number(readStorage(TIME_KEY));
  return Number.isSafeInteger(seconds) && seconds >= 0 ? seconds : 0;
}

let mySeconds = getMyTotalTime();

function fmtTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  let result = '';
  if (hours) result += `${hours}h `;
  if (hours || minutes) result += `${minutes}m `;
  return `${result}${remainder}s`;
}

function updateTimeDisplay() {
  const description = document.querySelector('.desc');
  if (!description) return;

  const strong = document.createElement('strong');
  strong.textContent = fmtTime(mySeconds);
  description.replaceChildren(
    document.createTextNode("You've spent "),
    strong,
    document.createTextNode(' on this site in this browser.')
  );
}

function updateUtcClock() {
  const clock = document.getElementById('ct-utc');
  if (!clock) return;

  const now = new Date();
  clock.dateTime = now.toISOString();
  clock.textContent = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).format(now);
}

function getAvatarSource(avatar) {
  if (typeof avatar !== 'string' || !avatar) return DEFAULT_AVATAR;

  if (/^data:image\/(?:png|jpeg|gif|webp|avif);base64,[a-z0-9+/]+=*$/i.test(avatar)) {
    return avatar;
  }

  try {
    const url = new URL(avatar);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch {
    // Non-URL avatar names are used as identicon seeds below.
  }

  return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(avatar)}`;
}

function setSidebarAvatar(source) {
  const image = document.getElementById('my-avatar');
  if (image) image.src = getAvatarSource(source);
}

const leaderboardData = [
  { name: 'BetterClient', time: 34010, flames: 3, avatar: 'Reza1290' },
  { name: 'Lucas11', time: 31811, flames: 8, avatar: 'neon443', flag: '🇬🇧' },
  { name: 'Neon', time: 30120, flames: 7, avatar: 'mr125-mr' },
  { name: 'Obay', time: 534, flames: 0, avatar: 'MrPigeon16' }
];

function createLeaderboardEntry(user, position) {
  const row = document.createElement('div');
  row.className = 'row board-entry';
  row.setAttribute('role', 'listitem');

  const medal = document.createElement('div');
  medal.className = 'medal';
  medal.textContent = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : String(position);

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  const image = document.createElement('img');
  image.src = getAvatarSource(user.avatar);
  image.alt = `${user.name}'s profile picture`;
  image.loading = 'lazy';
  avatar.appendChild(image);

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = user.name;
  if (user.flag) {
    const flag = document.createElement('span');
    flag.className = 'flag';
    flag.textContent = ` ${user.flag}`;
    name.appendChild(flag);
  }

  const flames = document.createElement('div');
  flames.className = `flames${user.flames >= 8 ? ' danger' : user.flames >= 7 ? ' warn' : ''}`;
  flames.textContent = user.flames ? `🔥 ${user.flames}` : '';

  const time = document.createElement('div');
  time.className = 'time';
  time.textContent = fmtTime(user.time);

  row.append(medal, avatar, name, flames, time);
  return row;
}

function updateLeaderboard() {
  const parent = document.querySelector('.leaderboard');
  if (!parent) return;

  const entries = [
    ...leaderboardData,
    {
      name: 'You',
      time: mySeconds,
      flames: Math.floor(mySeconds / 8000),
      avatar: readStorage(AVATAR_KEY) || 'pianoman0'
    }
  ].sort((first, second) => second.time - first.time);

  parent.replaceChildren();
  const visibleEntries = entries.slice(0, 7);
  if (!visibleEntries.some(user => user.name === 'You')) {
    visibleEntries.push(entries.find(user => user.name === 'You'));
  }
  visibleEntries.forEach((user, index) => {
    parent.appendChild(createLeaderboardEntry(user, entries.indexOf(user) + 1));
  });
}

function initAvatarPicker() {
  const picker = document.getElementById('avatar-picker');
  if (!picker) return;

  picker.addEventListener('change', () => {
    const file = picker.files && picker.files[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please choose a PNG, JPEG, GIF, WebP, or AVIF image.');
      picker.value = '';
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      alert('Please choose an image smaller than 2.5 MB.');
      picker.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      console.error('Could not read the selected profile picture.', reader.error);
      alert('Reading your profile picture failed. Please try another image.');
      picker.value = '';
    };
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        alert('Reading your profile picture failed. Please try another image.');
        picker.value = '';
        return;
      }

      if (writeStorage(AVATAR_KEY, reader.result)) {
        setSidebarAvatar(reader.result);
        updateLeaderboard();
      } else {
        alert('Saving your profile picture failed. Check your browser storage settings.');
      }
      picker.value = '';
    };
    reader.readAsDataURL(file);
  });
}

function renderContributionGrid() {
  const grid = document.getElementById('contrib-grid');
  if (!grid) return;

  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 37 * 7; index += 1) {
    const cell = document.createElement('div');
    const random = Math.random();
    const level = random > 0.93 ? 4 : random > 0.8 ? 3 : random > 0.5 ? 2 : random > 0.32 ? 1 : 0;
    cell.className = `contrib-cell${level ? ` level-${level}` : ''}`;
    fragment.appendChild(cell);
  }
  grid.replaceChildren(fragment);
}

const savedAvatar = readStorage(AVATAR_KEY);
if (savedAvatar) setSidebarAvatar(savedAvatar);

initAvatarPicker();
updateTimeDisplay();
updateUtcClock();
updateLeaderboard();
renderContributionGrid();

setInterval(() => {
  if (mySeconds < Number.MAX_SAFE_INTEGER) mySeconds += 1;
  writeStorage(TIME_KEY, mySeconds);
  updateTimeDisplay();
  updateLeaderboard();
  updateUtcClock();
}, 1000);
