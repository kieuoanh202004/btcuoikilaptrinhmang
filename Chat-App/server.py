import asyncio
import websockets
import json
import time
import random
import string
import uuid

clients = {}        # ws -> {username, room}
rooms = {}          # room -> {admin, clients:set()}
messages = {}       # msg_id -> username (owner)
typing_status = {}  # (room, username) -> timestamp
banned_users = {}   # room -> set(username)
clients = {}
rooms = {}
typing_status = {}
banned_users = {}


def gen_room_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def is_admin(ws):
    info = clients.get(ws)
    if not info:
        return False
    room = info["room"]
    return rooms.get(room, {}).get("admin") == info["username"]


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

    msg = json.dumps({
        "type": "online_list",
        "users": users,
        "admin": rooms[room]["admin"]
    })

    for w in list(rooms[room]["clients"]):
        try:
            await w.send(msg)
        except:
            pass


async def clear_typing():
    while True:
        now = time.time()
        for (room, user), t in list(typing_status.items()):
            if now - t > 1:
                del typing_status[(room, user)]
            if now - t > 3:
                typing_status.pop((room, user), None)
                await broadcast_room(room, json.dumps({
                    "type": "stop_typing",
                    "user": user
                }))
        await asyncio.sleep(0.2)


async def handler(ws):
    try:
        async for msg in ws:
            data = json.loads(msg)

            if data["type"] == "join":
                username = data["username"]
                room = data.get("room")

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
                    break

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
                }), except_ws=ws)

                await update_online(room)

            # ===== TEXT MESSAGE =====
            elif data["type"] == "message":
                info = clients.get(ws)
                if not info:
                    continue

                msg_id = "msg-" + uuid.uuid4().hex
                owner = info["username"]
                messages[msg_id] = owner

                await broadcast_room(info["room"], json.dumps({
                    "type": "message",
                    "from": owner,
                    "text": data["text"],
                    "replyTo": data.get("replyTo"),
                    "msg_id": msg_id,
                    "time": int(time.time())
                }))

            # ===== IMAGE =====
            elif data["type"] == "image":
                info = clients.get(ws)
                if not info:
                    continue

                msg_id = "msg-" + uuid.uuid4().hex
                owner = info["username"]
                messages[msg_id] = owner

                await broadcast_room(info["room"], json.dumps({
                    "type": "image",
                    "from": owner,
                    "filename": data.get("filename"),
                    "data": data.get("data"),
                    "msg_id": msg_id,
                    "time": int(time.time())
                }))
                if info:
                    await broadcast_room(info["room"], json.dumps({
                        "type": "message",
                        "from": info["username"],
                        "text": data["text"],
                        "time": time.time()
                    }))

            elif data["type"] == "typing":
                info = clients.get(ws)
                if info:
                    typing_status[(info["room"], info["username"])] = time.time()
                    await broadcast_room(
                        info["room"],
                        json.dumps({
                            "type": "typing",
                            "user": info["username"]
                        }),
                        except_ws=ws
                    )

            elif data["type"] == "kick":
                if not is_admin(ws):
                    continue

                info = clients.get(ws)
                if not info:
                    continue

                room = info["room"]
                target_name = data.get("user")

                target_ws = None
                for w in list(rooms[room]["clients"]):
                    i = clients.get(w)
                    if i and i["username"] == target_name:
                        target_ws = w
                        break

                if not target_ws:
                    continue

                rooms[room]["clients"].discard(target_ws)
                clients.pop(target_ws, None)
                typing_status.pop((room, target_name), None)

                try:
                    await target_ws.send(json.dumps({
                        "type": "kicked",
                        "room": room
                    }))
                except:
                    pass

                await broadcast_room(room, json.dumps({
                    "type": "notification",
                    "text": f"{target_name} đã bị kick khỏi phòng"
                }))

                await update_online(room)

            # ===== DELETE MESSAGE =====
            elif data["type"] == "delete_message":
                info = clients.get(ws)
                if not info:
                    continue

                msg_id = data.get("msg_id")
                owner = messages.get(msg_id)

                if owner and owner == info["username"]:
                    messages.pop(msg_id, None)
                    await broadcast_room(info["room"], json.dumps({
                        "type": "delete_message",
                        "msg_id": msg_id
                    }))

                try:
                    await target_ws.close()
                except:
                    pass

    except Exception as e:
        print("❌ Lỗi:", e)

    finally:
        info = clients.get(ws)

        if info:
            room = info["room"]
            name = info["username"]

            was_admin = rooms.get(room, {}).get("admin") == name

            if room in rooms:
                rooms[room]["clients"].discard(ws)

            clients.pop(ws, None)
            typing_status.pop((room, name), None)

            for mid, owner in list(messages.items()):
                if owner == name:
                    messages.pop(mid, None)

            await broadcast_room(room, json.dumps({
                "type": "notification",
                "text": f"{name} đã rời phòng"
            }))
            if room in rooms:
                if not rooms[room]["clients"]:
                    rooms.pop(room, None)
                else:
                    if was_admin:
                        new_ws = random.choice(list(rooms[room]["clients"]))
                        new_admin = clients[new_ws]["username"]
                        rooms[room]["admin"] = new_admin

                        await broadcast_room(room, json.dumps({
                            "type": "notification",
                            "text": f"{new_admin} đã trở thành chủ phòng mới 👑"
                        }))

                    await broadcast_room(room, json.dumps({
                        "type": "notification",
                        "text": f"{name} đã rời phòng"
                    }))

                    await update_online(room)


async def main():
    async with websockets.serve(handler, "localhost", 8765):
        print("✅ Server chạy tại ws://localhost:8765")
        asyncio.create_task(clear_typing())
        await asyncio.Future()

asyncio.run(main())
