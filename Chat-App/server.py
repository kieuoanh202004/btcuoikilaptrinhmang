import asyncio
import websockets
import json
import time
import random
import string

clients = {}   # ws -> {username, room}
rooms = {}     # room -> {admin, clients:set()}
typing_status = {}
banned_users = {}


# ================== UTILS ==================
def gen_room_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def is_admin(ws):
    info = clients.get(ws)
    if not info:
        return False
    room = info["room"]
    return rooms.get(room, {}).get("admin") == info["username"]


# ================== BROADCAST ==================
async def broadcast_room(room, message, except_ws=None):
    if room not in rooms:
        return

    dead = []
    for w in list(rooms[room]["clients"]):
        if w == except_ws:
            continue
        try:
            await w.send(message)
        except:
            dead.append(w)

    for w in dead:
        rooms[room]["clients"].discard(w)
        clients.pop(w, None)


async def update_online(room):
    if room not in rooms:
        return

    users = [
        clients[w]["username"]
        for w in rooms[room]["clients"]
        if w in clients
    ]

    admin = rooms[room]["admin"]

    msg = json.dumps({
        "type": "online_list",
        "users": users,
        "admin": admin
    })

    for w in list(rooms[room]["clients"]):
        try:
            await w.send(msg)
        except:
            pass


# ================== TYPING CLEANER ==================
async def clear_typing():
    while True:
        now = time.time()
        for (room, user), t in list(typing_status.items()):
            if now - t > 3:
                del typing_status[(room, user)]
                await broadcast_room(room, json.dumps({
                    "type": "stop_typing",
                    "user": user
                }))
        await asyncio.sleep(1)


# ================== HANDLER ==================
async def handler(ws):
    try:
        async for msg in ws:
            data = json.loads(msg)

            # ===== JOIN =====
            if data["type"] == "join":
                username = data["username"]
                room = data.get("room")

                # tạo phòng nếu trống
                if not room:
                    room = gen_room_code()
                    rooms[room] = {
                        "admin": username,
                        "clients": set()
                    }

                if room not in rooms:
                    await ws.send(json.dumps({
                        "type": "error",
                        "message": "Phòng không tồn tại"
                    }))
                    continue

                if room in banned_users and username in banned_users[room]:
                    await ws.send(json.dumps({
                        "type": "error",
                        "message": "Bạn đã bị cấm khỏi phòng"
                    }))
                    await ws.close()
                    return

                clients[ws] = {"username": username, "room": room}
                rooms[room]["clients"].add(ws)

                await ws.send(json.dumps({
                    "type": "room_joined",
                    "room": room,
                    "admin": rooms[room]["admin"]
                }))

                await broadcast_room(room, json.dumps({
                    "type": "notification",
                    "text": f"{username} đã tham gia phòng"
                }))

                await update_online(room)

            # ===== MESSAGE (✔ thêm time) =====
            elif data["type"] == "message":
                info = clients.get(ws)
                if not info:
                    continue

                await broadcast_room(info["room"], json.dumps({
                    "type": "message",
                    "from": info["username"],
                    "text": data["text"],
                    "time": time.time()   # 🔥 timestamp
                }))

            # ===== TYPING =====
            elif data["type"] == "typing":
                info = clients.get(ws)
                if not info:
                    continue

                typing_status[(info["room"], info["username"])] = time.time()
                await broadcast_room(
                    info["room"],
                    json.dumps({
                        "type": "typing",
                        "user": info["username"]
                    }),
                    except_ws=ws
                )

            # ===== KICK =====
            elif data["type"] == "kick":
                if not is_admin(ws):
                    continue

                target = data.get("user")
                room = clients[ws]["room"]

                for w in list(rooms[room]["clients"]):
                    if clients.get(w, {}).get("username") == target:
                        await w.send(json.dumps({
                            "type": "notification",
                            "text": "Bạn đã bị kick khỏi phòng"
                        }))
                        await w.close()
                        break

                await update_online(room)

    except Exception as e:
        print("❌ Lỗi:", e)

    finally:
        if ws in clients:
            info = clients[ws]
            room = info["room"]
            name = info["username"]

            rooms[room]["clients"].discard(ws)
            clients.pop(ws, None)
            typing_status.pop((room, name), None)

            await broadcast_room(room, json.dumps({
                "type": "notification",
                "text": f"{name} đã rời phòng"
            }))

            await update_online(room)


# ================== MAIN ==================
async def main():
    async with websockets.serve(handler, "localhost", 8765):
        print("✅ Server chạy tại ws://localhost:8765")
        asyncio.create_task(clear_typing())
        await asyncio.Future()

asyncio.run(main())
