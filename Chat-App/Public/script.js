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
let replyMessage = null;
let typingTimeout;
let lastTyping = 0;
let currentAdmin = null;

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

function joinRoom() {
  if (ws.readyState !== WebSocket.OPEN) return;

  ws.send(JSON.stringify({
    type: "join",
    username,
    room
  }));
}

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

  /* ===== TEXT MESSAGE ===== */
  if (data.type === "message") {
    const div = document.createElement("div");
    div.className = "message " + (data.from === username ? "me" : "other");
    // const msgId = data.msg_id || ("msg-" + Date.now());
    const msgId = data.msg_id;
    div.id = msgId;

    const senderRow = document.createElement("div");
    senderRow.className = "sender-row";

    const sender = document.createElement("span");
    sender.innerText = data.from;
    sender.style.color =
      data.from === username ? "#fff" : getNameColor(data.from);
    senderRow.appendChild(sender);

    if (data.replyTo) {
      const rp = document.createElement("div");
      rp.className = "reply-preview";
      rp.innerText = `↪ ${data.replyTo.from}: ${data.replyTo.text}`;
      div.appendChild(rp);
    }

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
      msgInput.focus();
    };

    div.append(senderRow, text, replyBtn);
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  /* ===== IMAGE ===== */
  /* ===== IMAGE ===== */
  if (data.type === "image") {
    const div = document.createElement("div");
    div.className = "message " + (data.from === username ? "me" : "other");
    // div.id = data.msg_id || ("img-" + Date.now());
    div.id = data.msg_id;
    const senderRow = document.createElement("div");
    senderRow.className = "sender-row";

    const sender = document.createElement("span");
    sender.innerText = data.from;
    sender.style.color =
      data.from === username ? "#fff" : getNameColor(data.from);
    senderRow.appendChild(sender);

    // Hiển thị Reply Preview nếu ảnh này là tin trả lời (nếu sau này bạn nâng cấp)
    if (data.replyTo) {
      const rp = document.createElement("div");
      rp.className = "reply-preview";
      rp.innerText = `↪ ${data.replyTo.from}: ${data.replyTo.text}`;
      div.appendChild(rp);
    }

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

    // --- BỔ SUNG: NÚT REPLY CHO ẢNH ---
    const replyBtn = document.createElement("button");
    replyBtn.className = "reply-btn";
    replyBtn.innerText = "↪";
    replyBtn.onclick = () => {
      // Khi reply ảnh, ta đặt text hiển thị là [Hình ảnh]
      replyMessage = { from: data.from, text: "[Hình ảnh]" };
      replyText.innerText = `↪ ${data.from}: [Hình ảnh]`;
      replyBox.classList.remove("hidden");
      msgInput.focus();
    };

    div.append(senderRow, img, replyBtn); // Nhớ append replyBtn vào div
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
  }
  if (data.type === "stop_typing") {
    typingDiv.innerText = "";
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => typingDiv.innerText = "", 2000);
  }
  /* ===== ONLINE ===== */
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
      name.innerText = u;

      row.appendChild(dot);
      row.appendChild(name);

      if (u === currentAdmin) {
        const crown = document.createElement("span");
        crown.innerText = " 👑";
        row.appendChild(crown);
      }

      if (isAdmin && u !== username) {
        const kickBtn = document.createElement("button");
        kickBtn.innerText = "Kick";
        kickBtn.className = "kick-btn";
        kickBtn.onclick = () =>
          ws.send(JSON.stringify({ type: "kick", user: u }));
        row.appendChild(kickBtn);
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
  if (!msgInput.value.trim() && !replyMessage) return;

  ws.send(JSON.stringify({
    type: "message",
    text: msgInput.value || "",
    replyTo: replyMessage
  }));

  msgInput.value = "";
  replyMessage = null;
  replyBox.classList.add("hidden");
}

document.getElementById("send").onclick = send;
msgInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    send();
  }
});

/* ===== TYPING SEND ===== */
msgInput.addEventListener("input", () => {
  const now = Date.now();
  if (now - lastTyping > 500) {
    ws.send(JSON.stringify({ type: "typing" }));
    lastTyping = Date.now();
  }
});

/* ===== IMAGE SEND ===== */
if (imgBtn && imgInput) {
  imgBtn.onclick = () => imgInput.click();
  imgInput.onchange = () => {
    const file = imgInput.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () =>
      ws.send(JSON.stringify({ type: "image", data: r.result }));
    r.readAsDataURL(file);
  };
}

/* ===== EMOJI ===== */
const picker = document.getElementById("emojiPicker");
if (picker) {
  const emojis = ["😀","😂","😍","😎","😭","👍","🔥"];
  emojis.forEach(e => {
    const s = document.createElement("span");
    s.innerText = e;
    s.onclick = () => {
      msgInput.value += e;
      msgInput.focus();
    };
    picker.appendChild(s);
  });

  document.getElementById("emojiBtn").onclick = () => {
    picker.classList.toggle("show");
  };
}

/* ===== CANCEL REPLY ===== */
cancelReply.onclick = () => {
  replyMessage = null;
  replyBox.classList.add("hidden");
};

/* ===== SEARCH ===== */
document.getElementById("searchInput").addEventListener("input", e => {
  const k = e.target.value.toLowerCase();
  document.querySelectorAll(".text").forEach(t => {
    const raw = t.dataset.raw || "";
    if (!k) {
      t.innerHTML = linkify(raw);
    } else {
      const highlighted = raw.replace(
        new RegExp(k, "gi"),
        m => `<span class="highlight">${m}</span>`
      );
      t.innerHTML = linkify(highlighted);
    }
  });
});

/* ===== LOGOUT ===== */
document.getElementById("logout").onclick = () => {
  ws.close();
  location.reload();
};

/* ===== THEME ===== */
const toggleBtn = document.getElementById("themeToggle");
if (toggleBtn) {
  const body = document.body;
  let isDark = true;

  toggleBtn.onclick = () => {
    isDark = !isDark;
    body.classList.toggle("dark", isDark);
    body.classList.toggle("light", !isDark);
    toggleBtn.innerText = isDark ? "🌙" : "☀️";
  };
}