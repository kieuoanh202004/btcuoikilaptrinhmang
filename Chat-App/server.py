import asyncio
import websockets
import json
import time

clients = {}

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
                await broadcast(json.dumps({
                    "type": "message",
                    "from": clients.get(websocket, "Unknown"),
                    "text": data["text"]
                }))

            elif data["type"] == "typing":
                user = clients.get(websocket)
                if user:
                    typing_status[user] = time.time()
                    await broadcast_except(websocket, json.dumps({
                        "type": "typing",
                        "user": user
                    }))

    except Exception as e:
        print("❌ Lỗi WebSocket:", e)

    finally:
        if websocket in clients:
            name = clients[websocket]
            del clients[websocket]
            typing_status.pop(name, None)

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
