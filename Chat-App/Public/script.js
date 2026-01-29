const ws = new WebSocket("ws://localhost:8765");

/* ===== NAME COLOR ===== */
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

/* ===== USERNAME ===== */
let username = prompt("Nhập tên của bạn:");
while (!username) {
  username = prompt("Tên không được để trống. Nhập lại:");
}

ws.onopen = () => {
  ws.send(JSON.stringify({ type: "join", username }));
};

/* ===== DOM ===== */
const msgInput = document.getElementById("msg");
const messages = document.getElementById("messages");
const typingDiv = document.getElementById("typing");
const onlineUsers = document.getElementById("onlineUsers");
const notifications = document.getElementById("notifications");
const imgBtn = document.getElementById("imgBtn");
const imgInput = document.getElementById("imgInput");

const replyBox = document.getElementById("replyBox");
const replyText = document.getElementById("replyText");
const cancelReply = document.getElementById("cancelReply");
replyBox.classList.add("hidden");
replyBox.style.display = "none";

let typingTimeout;
let lastTyping = 0;
let replyMessage = null; // { from, text }

function linkify(text) {
  const urlRegex = /((https?:\/\/|www\.)[^\s]+)/gi;
  return text.replace(urlRegex, url => {
    let href = url;
    if (!href.match(/^https?:\/\//i)) {
      href = "http://" + href;
    }
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

ws.onmessage = e => {
  const data = JSON.parse(e.data);

  /* ----- TEXT MESSAGE ----- */
  if (data.type === "message") {
    const div = document.createElement("div");
    div.className =
      "message " + (data.from === username ? "me" : "other");
    div.style.position = "relative"; // needed cho nút reply vị trí tuyệt đối

    const replyBtn = document.createElement("button");
    replyBtn.className = "reply-btn";
    replyBtn.title = "Trả lời";
    replyBtn.innerText = "↪";
    replyBtn.onclick = (ev) => {
      ev.stopPropagation();

      replyMessage = {
        from: data.from,
        text: data.text
      };

      replyText.innerText = `↪ ${data.from}: ${data.text}`;
      replyBox.classList.remove("hidden");
      replyBox.style.display = "flex"; // ensure visible
      msgInput.focus();
    };


    /* SENDER */
    const sender = document.createElement("div");
    sender.className = "sender";
    sender.innerText = data.from;
    sender.style.color =
      data.from === username ? "white" : getNameColor(data.from);
    if (data.replyTo) {
      const replyPreview = document.createElement("div");
      replyPreview.className = "reply-preview";
      replyPreview.innerText =
        `↪ ${data.replyTo.from}: ${data.replyTo.text}`;
      div.appendChild(replyPreview);
    }
    const text = document.createElement("div");
    text.className = "text";
    text.dataset.raw = data.text;
    text.innerHTML = linkify(data.text);

    div.appendChild(sender);
    div.appendChild(text);
    div.appendChild(replyBtn);

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  if (data.type === "image") {
    const div = document.createElement("div");
    div.className =
      "message " + (data.from === username ? "me" : "other");

    const sender = document.createElement("div");
    sender.className = "sender";
    sender.innerText = data.from;
    sender.style.color =
      data.from === username ? "white" : getNameColor(data.from);

    const img = document.createElement("img");
    img.src = data.data;
    img.alt = data.filename || "image";

    const caption = document.createElement("div");
    caption.className = "image-caption";
    caption.innerText = data.filename || "";

    div.appendChild(sender);
    div.appendChild(img);
    if (caption.innerText) div.appendChild(caption);

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  /* ----- TYPING ----- */
  if (data.type === "typing" && data.user !== username) {
    typingDiv.innerText = `${data.user} đang nhập...`;
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      typingDiv.innerText = "";
    }, 2000);
  }

  /* ----- ONLINE LIST ----- */
  if (data.type === "online_list") {
    onlineUsers.innerHTML = "";
    data.users.forEach(u => {
      const d = document.createElement("div");
      d.className = "online";
      d.innerHTML = `<div class="dot"></div>${u}`;
      onlineUsers.appendChild(d);
    });
  }

  /* ----- NOTIFICATION ----- */
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
    text,
    replyTo: replyMessage
  }));

  msgInput.value = "";
  replyMessage = null;
  replyBox.classList.add("hidden");
  replyBox.style.display = "none";
}


document.getElementById("send").onclick = send;

msgInput.addEventListener("keydown", e => {
  if (e.key === "Enter") send();
});

/* ===== TYPING EVENT ===== */
msgInput.addEventListener("input", () => {
  const now = Date.now();
  if (now - lastTyping > 500) {
    ws.send(JSON.stringify({ type: "typing" }));
    lastTyping = now;
  }
});

imgBtn.onclick = () => imgInput.click();

imgInput.addEventListener("change", () => {
  const file = imgInput.files && imgInput.files[0];
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
  imgInput.value = "";
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
  picker.classList.toggle("hidden");
};

cancelReply.onclick = () => {
  replyMessage = null;
  replyBox.classList.add("hidden");
  replyBox.style.display = "none";
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

const searchInput = document.getElementById("searchInput");

searchInput.addEventListener("input", () => {
  const keyword = searchInput.value.toLowerCase().trim();
  const allMessages =
    document.querySelectorAll("#messages .message .text");

  allMessages.forEach(msg => {
    const raw = msg.dataset.raw;
    if (!keyword) {
      msg.innerText = raw;
      return;
    }
    if (raw.toLowerCase().includes(keyword)) {
      msg.innerHTML = raw.replace(
        new RegExp(`(${keyword})`, "gi"),
        `<span class="highlight">$1</span>`
      );
    } else {
      msg.innerText = raw;
    }
  });
});
