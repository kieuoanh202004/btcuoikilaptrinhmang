const ws = new WebSocket("ws://localhost:8765");
const nameColors = {};
const palette = [
  "#22c55e", "#38bdf8", "#f59e0b",
  "#ec4899", "#a855f7", "#f97316"
];

function getNameColor(name) {
  if (!nameColors[name]) {
    nameColors[name] = palette[
      Object.keys(nameColors).length % palette.length
    ];
  }
  return nameColors[name];
}


let username = prompt("Nhập tên của bạn:");
while (!username) {
  username = prompt("Tên không được để trống. Nhập lại:");
}

ws.onopen = () => {
  ws.send(JSON.stringify({ type: "join", username }));
};

const msgInput = document.getElementById("msg");
const messages = document.getElementById("messages");
const typingDiv = document.getElementById("typing");
const onlineUsers = document.getElementById("onlineUsers");
const notifications = document.getElementById("notifications");
const imgBtn = document.getElementById("imgBtn");
const imgInput = document.getElementById("imgInput");

let typingTimeout;
let lastTyping = 0;

// Helper: convert URLs in text to anchor tags
function linkify(text) {
  const urlRegex = /((https?:\/\/|www\.)[^\s]+)/gi;
  return text.replace(urlRegex, function(url) {
    let href = url;
    if (!href.match(/^https?:\/\//i)) {
      href = 'http://' + href;
    }
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

ws.onmessage = e => {
  const data = JSON.parse(e.data);

  if (data.type === "message") {
    const div = document.createElement("div");
    div.className = "message " + (data.from === username ? "me" : "other");

    const sender = document.createElement("div");
    sender.className = "sender";
    sender.innerText = data.from;

    if (data.from !== username) {
      sender.style.color = getNameColor(data.from);
    } else {
      sender.style.color = "white";
    }
    const text = document.createElement("div");

    text.className = "text";
    text.dataset.raw = data.text;

    text.innerHTML = linkify(data.text);

    div.appendChild(sender);
    div.appendChild(text);

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  if (data.type === "image") {
    const div = document.createElement("div");
    div.className = "message " + (data.from === username ? "me" : "other");

    const sender = document.createElement("div");
    sender.className = "sender";
    sender.innerText = data.from;

    if (data.from !== username) {
      sender.style.color = getNameColor(data.from);
    } else {
      sender.style.color = "white";
    }

    const img = document.createElement("img");
    img.src = data.data; // data is a DataURL
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

  if (data.type === "typing" && data.user !== username) {
    typingDiv.innerText = `${data.user} đang nhập...`;
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      typingDiv.innerText = "";
    }, 2000);
  }

  if (data.type === "online_list") {
    onlineUsers.innerHTML = "";
    data.users.forEach(u => {
      const d = document.createElement("div");
      d.className = "online";
      d.innerHTML = `<div class="dot"></div>${u}`;
      onlineUsers.appendChild(d);
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
  if (e.key === "Enter") send();
});

msgInput.addEventListener("input", () => {
  const now = Date.now();
  if (now - lastTyping > 500) {
    ws.send(JSON.stringify({ type: "typing" }));
    lastTyping = now;
  }
});

// Image send logic
imgBtn.onclick = () => {
  imgInput.click();
};

imgInput.addEventListener("change", () => {
  const file = imgInput.files && imgInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result; // base64 DataURL
    ws.send(JSON.stringify({
      type: "image",
      filename: file.name,
      data: dataUrl
    }));
  };
  reader.readAsDataURL(file);

  // reset input so same file can be picked again if needed
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

document.getElementById("logout").onclick = () => {
  ws.close();
  location.reload();
};

const toggleBtn = document.getElementById("themeToggle");
const body = document.body;

let isDark = true;

toggleBtn.onclick = () => {
  isDark = !isDark;

  if (isDark) {
    body.classList.add("dark");
    body.classList.remove("light");
    toggleBtn.innerText = "🌙";
  } else {
    body.classList.add("light");
    body.classList.remove("dark");
    toggleBtn.innerText = "☀️";
  }
};

const searchInput = document.getElementById("searchInput");

searchInput.addEventListener("input", () => {
  const keyword = searchInput.value.toLowerCase().trim();
  const allMessages = document.querySelectorAll("#messages .message .text");

  allMessages.forEach(msgTag => {
    const originalText = msgTag.dataset.raw; // Lấy nội dung gốc đã lưu trong data-raw

    if (!keyword) {
      msgTag.innerText = originalText;
      return;
    }

    if (originalText.toLowerCase().includes(keyword)) {
      const regex = new RegExp(`(${keyword})`, "gi");
      const highlightedText = originalText.replace(regex, `<span class="highlight">$1</span>`);
      msgTag.innerHTML = highlightedText;
    } else {
      msgTag.innerText = originalText;
    }
  });
});

