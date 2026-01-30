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

let username = prompt("Nhập tên của bạn:");
while (!username) {
  username = prompt("Tên không được để trống:");
}

let room = prompt("Nhập mã phòng (để trống để tạo phòng mới):");

/* ===== STATE ===== */
let isAdmin = false;

/* ===== DOM ===== */
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

/* ===== STATE ===== */
/* ===== TYPING ===== */
let typingTimeout;
let lastTyping = 0;
let replyMessage = null;

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
/* ===== UTILS ===== */
function linkify(text) {
  const urlRegex = /((https?:\/\/|www\.)[^\s]+)/gi;
  return text.replace(urlRegex, url => {
    let href = url;
    if (!href.match(/^https?:\/\//i)) {
      href = "http://" + href;
    }
    return `<a href="${href}" target="_blank">${url}</a>`;
  });
}

/* ===== RECEIVE MESSAGE ===== */
ws.onmessage = e => {
  const data = JSON.parse(e.data);

  /* ===== ROOM JOINED ===== */
  if (data.type === "room_joined") {
    roomCodeEl.innerText = "🔑 " + data.room;
    isAdmin = data.admin === username;
    return;
  }

  /* ===== CHAT MESSAGE ===== */
  /* ----- TEXT MESSAGE ----- */
  if (data.type === "message") {
    const div = document.createElement("div");
    div.className =
      "message " + (data.from === username ? "me" : "other");

    // use server-provided msg_id when available so deletions are consistent
    const msgId = data.msg_id || ("msg-" + (data.time || Date.now()));
    div.id = msgId;

    /* Reply preview */
    if (data.replyTo) {
      const replyPreview = document.createElement("div");
      replyPreview.className = "reply-preview";
      replyPreview.innerText =
        `↪ ${data.replyTo.from}: ${data.replyTo.text}`;
      div.appendChild(replyPreview);
    }

    /* Sender */
    const senderRow = document.createElement("div");
    senderRow.className = "sender-row";

    const sender = document.createElement("span");
    sender.innerText = data.from;
    sender.style.color =
      data.from === username ? "#fff" : getNameColor(data.from);

    senderRow.appendChild(sender);

    /* Delete button (chỉ mình) */
    if (data.from === username) {
      const deleteBtn = document.createElement("span");
      deleteBtn.innerText = " 🗑️";
      deleteBtn.style.cursor = "pointer";
      deleteBtn.onclick = () => {
        if (confirm("Thu hồi tin nhắn?")) {
          ws.send(JSON.stringify({
            type: "delete_message",
            msg_id: msgId
          }));
        }
      };
      senderRow.appendChild(deleteBtn);
    }

    /* Text */
    const text = document.createElement("div");
    text.className = "text";
    text.dataset.raw = data.text;
    text.innerHTML = linkify(data.text);

    /* Reply button */
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

    div.appendChild(senderRow);
    div.appendChild(text);
    div.appendChild(replyBtn);

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  /* ----- IMAGE ----- */
  if (data.type === "image") {
    const div = document.createElement("div");
    div.className = "message " + (data.from === username ? "me" : "other");

    // use server-provided msg_id when available
    const msgId = data.msg_id || ("msg-" + (data.time || Date.now()));
    div.id = msgId;

    const sender = document.createElement("div");
    sender.className = "sender";
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
    sender.style.color =
      data.from === username ? "#fff" : getNameColor(data.from);

    senderRow.appendChild(sender);
    senderRow.appendChild(time);

    const text = document.createElement("div");
    text.innerText = data.text;
    const img = document.createElement("img");
    img.src = data.data;

    div.appendChild(sender);
    div.appendChild(img);

    // allow owner to delete images as well
    if (data.from === username) {
      const deleteBtn = document.createElement("span");
      deleteBtn.innerText = " 🗑️";
      deleteBtn.style.cursor = "pointer";
      deleteBtn.onclick = () => {
        if (confirm("Thu hồi hình ảnh?")) {
          ws.send(JSON.stringify({ type: "delete_message", msg_id: msgId }));
        }
      };
      // place delete button after sender
      sender.appendChild(deleteBtn);
    }

    div.appendChild(senderRow);
    div.appendChild(text);
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  /* ===== TYPING ===== */
  /* ----- DELETE ----- */
  if (data.type === "delete_message") {
    const target = document.getElementById(data.msg_id);
    if (target) {
      // mark the message as deleted and replace its content with a placeholder
      target.classList.add('deleted');

      // Remove any interactive controls (reply/delete buttons, images, etc.)
      // and show a consistent placeholder text for recalled messages.
      target.innerHTML = '';
      const notice = document.createElement('div');
      notice.className = 'text';
      notice.innerText = 'Tin nhắn đã được thu hồi';
      target.appendChild(notice);
    }
  }

  /* ----- TYPING ----- */
  if (data.type === "typing" && data.user !== username) {
    typingDiv.innerText = `${data.user} đang nhập...`;
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => typingDiv.innerText = "", 2000);
  }

  /* ===== ONLINE LIST ===== */
  /* ----- ONLINE LIST ----- */
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
      const d = document.createElement("div");
      d.innerHTML = `<div class="dot"></div>${u}`;
      onlineUsers.appendChild(d);
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
    text,
    replyTo: replyMessage
  }));

  msgInput.value = "";
  replyMessage = null;
  replyBox.classList.add("hidden");
  replyBox.style.display = "none";
}

document.getElementById("send").onclick = send;
msgInput.addEventListener("keydown", e => e.key === "Enter" && send());

/* ===== TYPING EVENT ===== */
msgInput.addEventListener("input", () => {
  const now = Date.now();
  if (now - lastTyping > 500) {
    ws.send(JSON.stringify({ type: "typing" }));
    lastTyping = now;
  }
});

/* ===== IMAGE SEND ===== */
imgBtn.onclick = () => imgInput.click();
imgInput.onchange = () => {
  const file = imgInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    ws.send(JSON.stringify({
      type: "image",
      filename: file.name,
      data: reader.result
    }));
  };
  reader.readAsDataURL(file);
};

/* ===== EMOJI ===== */
/* ===== EMOJI ===== */
const emojis = ["😀","😂","😍","😎","😭","👍","🔥"];
const picker = document.getElementById("emojiPicker");

emojis.forEach(e => {
  const s = document.createElement("span");
  s.innerText = e;
  s.onclick = () => msgInput.value += e;
  picker.appendChild(s);
});

document.getElementById("emojiBtn").onclick = () =>
  picker.classList.toggle("hidden");

/* ===== CANCEL REPLY ===== */
cancelReply.onclick = () => {
  replyMessage = null;
  replyBox.classList.add("hidden");
  replyBox.style.display = "none";
};

/* ===== LOGOUT ===== */
/* ===== SEARCH ===== */
const searchInput = document.getElementById("searchInput");
searchInput.oninput = () => {
  const k = searchInput.value.toLowerCase();
  document.querySelectorAll(".text").forEach(t => {
    const raw = t.dataset.raw;
    if (!k) {
      t.innerText = raw;
    } else if (raw.toLowerCase().includes(k)) {
      t.innerHTML = raw.replace(
        new RegExp(`(${k})`, "gi"),
        `<span class="highlight">$1</span>`
      );
    }
  });
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
