const ws = new WebSocket("ws://localhost:8765");

/* ===== COLOR NAME ===== */
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

/* ===== USER INPUT ===== */
let username = prompt("Nhập tên của bạn:");
while (!username) {
  username = prompt("Tên không được để trống:");
}

let room = prompt("Nhập mã phòng (để trống để tạo phòng mới):");

/* ===== STATE ===== */
let isAdmin = false;

/* ===== DOM ===== */
const msgInput = document.getElementById("msg");
const messages = document.getElementById("messages");
const typingDiv = document.getElementById("typing");
const onlineUsers = document.getElementById("onlineUsers");
const notifications = document.getElementById("notifications");
const roomCodeEl = document.getElementById("roomCode");

/* ===== TYPING ===== */
let typingTimeout;
let lastTyping = 0;

/* ===== CONNECT ===== */
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "join",
    username,
    room: room || null
  }));
};

/* ===== TIME FORMAT ===== */
function formatTime(ts) {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

/* ===== RECEIVE ===== */
ws.onmessage = e => {
  const data = JSON.parse(e.data);

  /* ===== ROOM JOINED ===== */
  if (data.type === "room_joined") {
    roomCodeEl.innerText = "🔑 " + data.room;
    isAdmin = data.admin === username;
    return;
  }

  /* ===== CHAT MESSAGE ===== */
  if (data.type === "message") {
    const div = document.createElement("div");
    div.className =
      "message " + (data.from === username ? "me" : "other");

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

  /* ===== TYPING ===== */
  if (data.type === "typing" && data.user !== username) {
    typingDiv.innerText = `${data.user} đang nhập...`;
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      typingDiv.innerText = "";
    }, 2000);
  }

  /* ===== ONLINE LIST ===== */
  if (data.type === "online_list") {
    onlineUsers.innerHTML = "";

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

      // 👑 ADMIN ICON
      if (u === data.admin) {
        const crown = document.createElement("span");
        crown.innerText = " 👑";
        crown.className = "admin";
        row.appendChild(crown);
      }

      // KICK (chỉ admin, không kick chính mình)
      if (isAdmin && u !== username) {
        const kickBtn = document.createElement("button");
        kickBtn.innerText = "Kick";
        kickBtn.className = "kick-btn";
        kickBtn.onclick = () => {
          if (confirm(`Kick ${u}?`)) {
            ws.send(JSON.stringify({
              type: "kick",
              user: u
            }));
          }
        };
        row.appendChild(kickBtn);
      }

      onlineUsers.appendChild(row);
    });
  }

  /* ===== NOTIFICATION ===== */
  if (data.type === "notification") {
    const n = document.createElement("div");
    n.innerText = data.text;
    notifications.appendChild(n);
  }
};

/* ===== SEND MESSAGE ===== */
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
  if (e.key === "Enter") send();
});

msgInput.addEventListener("input", () => {
  const now = Date.now();
  if (now - lastTyping > 500) {
    ws.send(JSON.stringify({ type: "typing" }));
    lastTyping = now;
  }
});

/* ===== EMOJI ===== */
const emojis = ["😀","😂","😍","😎","😭","👍","🔥"];
const picker = document.getElementById("emojiPicker");

emojis.forEach(e => {
  const s = document.createElement("span");
  s.innerText = e;
  s.onclick = () => msgInput.value += e;
  picker.appendChild(s);
});

document.getElementById("emojiBtn").onclick = () => {
  picker.classList.toggle("hidden");
};

/* ===== LOGOUT ===== */
document.getElementById("logout").onclick = () => {
  ws.close();
  location.reload();
};

/* ===== THEME ===== */
const toggleBtn = document.getElementById("themeToggle");
const body = document.body;
let isDark = true;

toggleBtn.onclick = () => {
  isDark = !isDark;
  body.classList.toggle("dark", isDark);
  body.classList.toggle("light", !isDark);
  toggleBtn.innerText = isDark ? "🌙" : "☀️";
};
