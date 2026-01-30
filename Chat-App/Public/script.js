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

/* ===== USER ===== */
let username = prompt("Nhập tên của bạn:");
while (!username) username = prompt("Tên không được để trống:");
let room = prompt("Nhập mã phòng (để trống để tạo phòng mới):");

/* ===== STATE ===== */
let isAdmin = false;
let replyMessage = null;
let typingTimeout;
let lastTyping = 0;

/* ===== DOM ===== */
const msgInput = document.getElementById("msg");
const messages = document.getElementById("messages");
const typingDiv = document.getElementById("typing");
const onlineUsers = document.getElementById("onlineUsers");
const notifications = document.getElementById("notifications");
const roomCodeEl = document.getElementById("roomCode");

const imgBtn = document.getElementById("imgBtn");
const imgInput = document.getElementById("imgInput");

const replyBox = document.getElementById("replyBox");
const replyText = document.getElementById("replyText");
const cancelReply = document.getElementById("cancelReply");

replyBox.classList.add("hidden");
replyBox.style.display = "none";

/* ===== CONNECT ===== */
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "join",
    username,
    room: room || null
  }));
};

/* ===== TIME ===== */
function formatTime(ts) {
  return new Date(ts * 1000).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

/* ===== LINKIFY ===== */
function linkify(text) {
  return text.replace(/((https?:\/\/|www\.)[^\s]+)/gi, url => {
    const href = url.startsWith("http") ? url : "http://" + url;
    return `<a href="${href}" target="_blank">${url}</a>`;
  });
}

/* ===== RECEIVE ===== */
ws.onmessage = e => {
  const data = JSON.parse(e.data);

  /* ROOM */
  if (data.type === "room_joined") {
    roomCodeEl.innerText = "🔑 " + data.room;
    isAdmin = data.admin === username;
    return;
  }

  /* ===== TEXT MESSAGE ===== */
  if (data.type === "message") {
    const div = document.createElement("div");
    div.className = "message " + (data.from === username ? "me" : "other");
    const msgId = data.msg_id || ("msg-" + Date.now());
    div.id = msgId;

    if (data.replyTo) {
      const rp = document.createElement("div");
      rp.className = "reply-preview";
      rp.innerText = `↪ ${data.replyTo.from}: ${data.replyTo.text}`;
      div.appendChild(rp);
    }

    const senderRow = document.createElement("div");
    senderRow.className = "sender-row";

    const sender = document.createElement("span");
    sender.innerText = data.from;
    sender.style.color =
      data.from === username ? "#fff" : getNameColor(data.from);
    senderRow.appendChild(sender);

    if (data.from === username) {
      const del = document.createElement("span");
      del.innerText = " 🗑️";
      del.style.cursor = "pointer";
      del.onclick = () =>
        ws.send(JSON.stringify({ type: "delete_message", msg_id: msgId }));
      senderRow.appendChild(del);
    }

    const text = document.createElement("div");
    text.className = "text";
    text.dataset.raw = data.text;
    text.innerHTML = linkify(data.text);

    const replyBtn = document.createElement("button");
    replyBtn.className = "reply-btn";
    replyBtn.innerText = "↪";
    replyBtn.onclick = () => {
      replyMessage = { from: data.from, text: data.text };
      replyText.innerText = `↪ ${data.from}: ${data.text}`;
      replyBox.classList.remove("hidden");
      replyBox.style.display = "flex";
      msgInput.focus();
    };

    div.append(senderRow, text, replyBtn);
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  /* ===== IMAGE ===== */
  if (data.type === "image") {
    const div = document.createElement("div");
    div.className = "message " + (data.from === username ? "me" : "other");
    div.id = data.msg_id || ("img-" + Date.now());

    const senderRow = document.createElement("div");
    senderRow.className = "sender-row";

    const sender = document.createElement("span");
    sender.innerText = data.from;
    sender.style.color =
      data.from === username ? "#fff" : getNameColor(data.from);

    senderRow.appendChild(sender);

    if (data.from === username) {
      const del = document.createElement("span");
      del.innerText = " 🗑️";
      del.style.cursor = "pointer";
      del.onclick = () =>
        ws.send(JSON.stringify({ type: "delete_message", msg_id: div.id }));
      senderRow.appendChild(del);
    }

    const img = document.createElement("img");
    img.src = data.data;

    div.append(senderRow, img);
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  /* ===== DELETE ===== */
  if (data.type === "delete_message") {
    const target = document.getElementById(data.msg_id);
    if (target) {
      target.innerHTML = `<div class="text">Tin nhắn đã được thu hồi</div>`;
      target.classList.add("deleted");
    }
  }

  /* ===== TYPING ===== */
  if (data.type === "typing" && data.user !== username) {
    typingDiv.innerText = `${data.user} đang nhập...`;
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => typingDiv.innerText = "", 2000);
  }

  /* ===== ONLINE ===== */
  if (data.type === "online_list") {
    onlineUsers.innerHTML = "";
    data.users.forEach(u => {
      const row = document.createElement("div");
      row.className = "online";
      row.innerHTML = `<span class="dot"></span><span>${u}</span>`;

      if (u === data.admin) row.innerHTML += " 👑";

      if (isAdmin && u !== username) {
        const k = document.createElement("button");
        k.innerText = "Kick";
        k.onclick = () =>
          ws.send(JSON.stringify({ type: "kick", user: u }));
        row.appendChild(k);
      }
      onlineUsers.appendChild(row);
    });
  }

  /* ===== NOTIFY ===== */
  if (data.type === "notification") {
    const n = document.createElement("div");
    n.innerText = data.text;
    notifications.appendChild(n);
  }
};

/* ===== SEND ===== */
function send() {
  if (!msgInput.value.trim()) return;
  ws.send(JSON.stringify({
    type: "message",
    text: msgInput.value,
    replyTo: replyMessage
  }));
  msgInput.value = "";
  replyMessage = null;
  replyBox.classList.add("hidden");
  replyBox.style.display = "none";
}

document.getElementById("send").onclick = send;
msgInput.onkeydown = e => e.key === "Enter" && send();

/* ===== TYPING SEND ===== */
msgInput.oninput = () => {
  if (Date.now() - lastTyping > 500) {
    ws.send(JSON.stringify({ type: "typing" }));
    lastTyping = Date.now();
  }
};

/* ===== IMAGE SEND ===== */
imgBtn.onclick = () => imgInput.click();
imgInput.onchange = () => {
  const file = imgInput.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = () =>
    ws.send(JSON.stringify({ type: "image", data: r.result }));
  r.readAsDataURL(file);
};

/* ===== EMOJI ===== */
const picker = document.getElementById("emojiPicker");
["😀","😂","😍","😎","😭","👍","🔥"].forEach(e => {
  const s = document.createElement("span");
  s.innerText = e;
  s.onclick = () => msgInput.value += e;
  picker.appendChild(s);
});
document.getElementById("emojiBtn").onclick =
  () => picker.classList.toggle("hidden");

/* ===== CANCEL REPLY ===== */
cancelReply.onclick = () => {
  replyMessage = null;
  replyBox.classList.add("hidden");
  replyBox.style.display = "none";
};

/* ===== SEARCH ===== */
document.getElementById("searchInput").oninput = e => {
  const k = e.target.value.toLowerCase();
  document.querySelectorAll(".text").forEach(t => {
    const raw = t.dataset.raw || "";
    t.innerHTML = !k ? raw :
      raw.replace(new RegExp(k, "gi"), m => `<span class="highlight">${m}</span>`);
  });
};

/* ===== LOGOUT ===== */
document.getElementById("logout").onclick = () => {
  ws.close();
  location.reload();
};

/* ===== THEME ===== */
let isDark = true;
document.getElementById("themeToggle").onclick = () => {
  isDark = !isDark;
  document.body.className = isDark ? "dark" : "light";
};
