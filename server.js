onst express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 存放待匹配的用户队列
let waitingQueue = [];
// 记录每个 socket 配对的对方 socket.id
const partners = new Map();

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);

  // 匹配逻辑：从队列里取一个等待者，没有则入队
  if (waitingQueue.length > 0) {
    const partner = waitingQueue.shift();
    partners.set(socket.id, partner.id);
    partners.set(partner.id, socket.id);
    socket.emit('matched');
    partner.emit('matched');
    console.log(`匹配成功: ${partner.id} <-> ${socket.id}`);
  } else {
    waitingQueue.push(socket);
    socket.emit('waiting');
  }

  // 转发消息给对方
  socket.on('message', (msg) => {
    const partnerId = partners.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('message', { from: 'partner', text: msg });
    }
  });

  // 对方断开时通知
  socket.on('disconnect', () => {
    console.log('用户断开:', socket.id);
    // 从队列里移除
    waitingQueue = waitingQueue.filter(s => s.id !== socket.id);
    // 通知对方
    const partnerId = partners.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('partner-left');
      partners.delete(partnerId);
    }
    partners.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器已启动: http://localhost:${PORT}`);
  console.log('打开两个浏览器窗口即可测试 2 人聊天');
});
