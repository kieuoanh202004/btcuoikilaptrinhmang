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

let typingTimeout;
let lastTyping = 0;

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
    text.innerText = data.text;

    div.appendChild(sender);
    div.appendChild(text);

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

