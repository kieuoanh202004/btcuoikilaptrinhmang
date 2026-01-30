import asyncio
import websockets
import json
import time
import uuid

clients = {}

# map msg_id -> username (owner) so we can authorize deletes
messages = {}

typing_status = {}


async def broadcast(message):
    dead = []
    for ws in list(clients):
        try:
            await ws.send(message)
        except:
            dead.append(ws)

    for ws in dead:
        clients.pop(ws, None)


async def broadcast_except(sender, message):
    for ws in list(clients):
        if ws != sender:
            try:
                await ws.send(message)
            except:
                pass


async def clear_typing():
    while True:
        now = time.time()
        for user, t in list(typing_status.items()):
            if now - t > 3:
                del typing_status[user]
                await broadcast(json.dumps({
                    "type": "stop_typing",
                    "user": user
                }))
        await asyncio.sleep(1)


async def handler(websocket):
    try:
        async for msg in websocket:
            data = json.loads(msg)

            if data["type"] == "join":
                username = data["username"]
                clients[websocket] = username

                await broadcast(json.dumps({
                    "type": "online_list",
                    "users": list(clients.values())
                }))

                await broadcast(json.dumps({
                    "type": "notification",
                    "text": f"{username} đã tham gia chat"
                }))

            elif data["type"] == "message":
                # generate a stable msg_id and record the owner
                msg_id = "msg-" + uuid.uuid4().hex
                owner = clients.get(websocket, "Unknown")
                messages[msg_id] = owner

                await broadcast(json.dumps({
                    "type": "message",
                    "from": owner,
                    "text": data["text"],
                    "replyTo": data.get("replyTo"),
                    "msg_id": msg_id,
                    "time": int(time.time() * 1000)
                }))

            elif data["type"] == "image":
                msg_id = "msg-" + uuid.uuid4().hex
                owner = clients.get(websocket, "Unknown")
                messages[msg_id] = owner

                await broadcast(json.dumps({
                    "type": "image",
                    "from": owner,
                    "filename": data.get("filename"),
                    "data": data.get("data"),
                    "msg_id": msg_id,
                    "time": int(time.time() * 1000)
                }))

            elif data["type"] == "typing":
                user = clients.get(websocket)
                if user:
                    typing_status[user] = time.time()
                    await broadcast_except(websocket, json.dumps({
                        "type": "typing",
                        "user": user
                    }))

            elif data["type"] == "delete_message":
                msg_id = data.get("msg_id")
                requester = clients.get(websocket)
                if not msg_id or not requester:
                    continue

                # only the owner can delete their message
                owner = messages.get(msg_id)
                if owner and owner == requester:
                    # remove stored message and notify all clients to delete it
                    messages.pop(msg_id, None)
                    await broadcast(json.dumps({
                        "type": "delete_message",
                        "msg_id": msg_id
                    }))
                else:
                    # ignore or optionally send an error back to requester
                    pass


    except Exception as e:
        print("❌ Lỗi WebSocket:", e)

    finally:
        if websocket in clients:
            name = clients[websocket]
            del clients[websocket]
            typing_status.pop(name, None)

            # cleanup any messages owned by this websocket's username
            for mid, owner in list(messages.items()):
                if owner == name:
                    messages.pop(mid, None)

            await broadcast(json.dumps({
                "type": "notification",
                "text": f"{name} đã thoát"
            }))

            await broadcast(json.dumps({
                "type": "online_list",
                "users": list(clients.values())
            }))


async def main():
    async with websockets.serve(handler, "localhost", 8765):
        print("✅ Server chạy tại ws://localhost:8765")
        asyncio.create_task(clear_typing())
        await asyncio.Future()


asyncio.run(main())
