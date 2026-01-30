const ws = new WebSocket("ws://localhost:8765");

const nameColors = {};
const palette = [
  "#22c55e", "#38bdf8", "#f59e0b",
  "#ec4899", "#a855f7", "#f97316"
];

function getNameColor(name) {
  if (!nameColors[name]) {
    nameColors[name] =
      palette[Object.keys(nameColors).length % palette.length];
  }
  return nameColors[name];
}

const modal = document.getElementById("modal");
const modalInput = document.getElementById("modalInput");
const modalTitle = document.getElementById("modalTitle");
const modalOk = document.getElementById("modalOk");

let username = "";
let room = "";

modalInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    modalOk.click();
  }
});

function ask(text, callback) {
  modalTitle.innerText = text;
  modalInput.value = "";
  modal.classList.remove("hidden");
  modalInput.focus();

  modalOk.onclick = () => {
    const v = modalInput.value.trim();
    if (!v && text.includes("tên")) return;
    modal.classList.add("hidden");
    callback(v);
  };
}

ask("Nhập tên của bạn", name => {
  username = name;

  ask("Nhập mã phòng (để trống để tạo phòng mới)", r => {
    room = r || null;
    if (ws.readyState === WebSocket.OPEN) joinRoom();
  });
});

ws.onopen = () => {
  if (username) joinRoom();
};

let isAdmin = false;
let currentAdmin = null;

const msgInput = document.getElementById("msg");
const messages = document.getElementById("messages");
const typingDiv = document.getElementById("typing");
const onlineUsers = document.getElementById("onlineUsers");
const notifications = document.getElementById("notifications");
const roomCodeEl = document.getElementById("roomCode");

function joinRoom() {
  if (ws.readyState !== WebSocket.OPEN) return;

  ws.send(JSON.stringify({
    type: "join",
    username,
    room
  }));
}

function formatTime(ts) {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

ws.onmessage = e => {
  const data = JSON.parse(e.data);

  if (data.type === "room_joined") {
    roomCodeEl.innerText = "🔑 " + data.room;

    currentAdmin = data.admin;
    isAdmin = currentAdmin === username;

    messages.innerHTML = "";
    notifications.innerHTML = "";
    typingDiv.innerText = "";
    return;
  }

  if (data.type === "kicked") {
    alert("Bạn đã bị kick khỏi phòng!");
    messages.innerHTML = "";
    onlineUsers.innerHTML = "";
    notifications.innerHTML = "";
    typingDiv.innerText = "";
    roomCodeEl.innerText = "";

    try { ws.close(); } catch(e) {}
    setTimeout(() => location.reload(), 100);
    return;
  }

  if (data.type === "message") {
    const div = document.createElement("div");
    div.className = "message " + (data.from === username ? "me" : "other");

    const senderRow = document.createElement("div");
    senderRow.className = "sender";

    const sender = document.createElement("span");
    sender.innerText = data.from;
    sender.style.color =
      data.from === username ? "white" : getNameColor(data.from);

    const time = document.createElement("span");
    time.style.marginLeft = "8px";
    time.style.fontSize = "0.8rem";
    time.style.opacity = "0.7";
    time.innerText = formatTime(data.time);

    senderRow.appendChild(sender);
    senderRow.appendChild(time);

    const text = document.createElement("div");
    text.innerText = data.text;

    div.appendChild(senderRow);
    div.appendChild(text);
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  if (data.type === "typing" && data.user !== username) {
    typingDiv.innerText = `${data.user} đang nhập...`;
  }

  if (data.type === "stop_typing") {
    typingDiv.innerText = "";
  }

  if (data.type === "online_list") {
    onlineUsers.innerHTML = "";

    currentAdmin = data.admin;
    isAdmin = currentAdmin === username;

    data.users.forEach(u => {
      const row = document.createElement("div");
      row.className = "online";

      const dot = document.createElement("span");
      dot.className = "dot";

      const name = document.createElement("span");
      name.className = "username";
      name.innerText = u;

      row.appendChild(dot);
      row.appendChild(name);

      if (u === currentAdmin) {
        const crown = document.createElement("span");
        crown.innerText = " 👑";
        crown.className = "admin";
        row.appendChild(crown);
      }

      if (isAdmin && u !== username) {
        const kickBtn = document.createElement("button");
        kickBtn.innerText = "Kick";
        kickBtn.className = "kick-btn";
        kickBtn.onclick = () => showKickModal(u);
        row.appendChild(kickBtn);
      }

      onlineUsers.appendChild(row);
    });
  }

  if (data.type === "notification") {
    const n = document.createElement("div");
    n.innerText = data.text;
    notifications.appendChild(n);
  }
};

function send() {
  const text = msgInput.value.trim();
  if (!text) return;

  ws.send(JSON.stringify({
    type: "message",
    text
  }));

  msgInput.value = "";
}

document.getElementById("send").onclick = send;

msgInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    send();
  }
});

let lastTyping = 0;
msgInput.addEventListener("input", () => {
  const now = Date.now();
  if (now - lastTyping > 500) {
    ws.send(JSON.stringify({ type: "typing" }));
    lastTyping = now;
  }
});

const emojis = ["😀","😂","😍","😎","😭","👍","🔥"];
const picker = document.getElementById("emojiPicker");

emojis.forEach(e => {
  const s = document.createElement("span");
  s.innerText = e;
  s.onclick = () => msgInput.value += e;
  picker.appendChild(s);
});

document.getElementById("emojiBtn").onclick = () => {
  picker.classList.toggle("show");
};

document.getElementById("logout").onclick = () => {
  try { ws.close(); } catch(e) {}
  location.reload();
};

const toggleBtn = document.getElementById("themeToggle");
const body = document.body;
let isDark = true;

toggleBtn.onclick = () => {
  isDark = !isDark;
  body.classList.toggle("dark", isDark);
  body.classList.toggle("light", !isDark);
  toggleBtn.innerText = isDark ? "🌙" : "☀️";
};
body.classList.add("dark");

const kickModal = document.getElementById("kickModal");
const kickTitle = document.getElementById("kickTitle");
const kickConfirm = document.getElementById("kickConfirm");
const kickCancel = document.getElementById("kickCancel");

let kickTargetUser = null;

function showKickModal(u) {
  kickTargetUser = u;
  kickTitle.innerText = "Kick " + u + " ?";
  kickModal.classList.remove("hidden");
}

function hideKickModal() {
  kickModal.classList.add("hidden");
  kickTargetUser = null;
}

kickCancel.onclick = hideKickModal;

kickConfirm.onclick = () => {
  if (kickTargetUser) {
    ws.send(JSON.stringify({
      type: "kick",
      user: kickTargetUser
    }));
  }
  hideKickModal();
};
