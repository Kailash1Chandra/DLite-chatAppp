import { saveMessage } from '../services/messageService.js'

const onlineUsers = new Map()

const increaseUserConnection = (userId) => {
  const currentCount = onlineUsers.get(userId) || 0
  onlineUsers.set(userId, currentCount + 1)
}

const decreaseUserConnection = (userId) => {
  const currentCount = onlineUsers.get(userId) || 0

  if (currentCount <= 1) {
    onlineUsers.delete(userId)
    return false
  }

  onlineUsers.set(userId, currentCount - 1)
  return true
}

export const registerChatHandlers = (io) => {
  io.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId

    // A user id lets us track presence and send personal events if needed.
    if (userId) {
      increaseUserConnection(String(userId))
      socket.join(`user:${userId}`)

      io.emit('user_status', {
        userId: String(userId),
        status: 'online',
      })
    }

    socket.on('join_chat', ({ chatId }) => {
      if (!chatId) {
        return
      }

      // A chat room can represent a 1-to-1 conversation or a group chat.
      socket.join(`chat:${chatId}`)
    })

    socket.on('send_message', async (payload) => {
      try {
        const chatId = payload?.chatId
        const senderId = payload?.senderId || userId
        const content = payload?.content
        const type = payload?.type || 'text'

        if (!chatId || !senderId || !content) {
          socket.emit('socket_error', {
            message: 'chatId, senderId, and content are required',
          })
          return
        }

        const message = await saveMessage({
          chatId,
          senderId,
          content,
          type,
        })

        io.to(`chat:${chatId}`).emit('receive_message', message)
      } catch (error) {
        socket.emit('socket_error', {
          message: error.message || 'Failed to send message',
        })
      }
    })

    socket.on('typing', ({ chatId, senderId }) => {
      if (!chatId) {
        return
      }

      socket.to(`chat:${chatId}`).emit('typing', {
        chatId,
        senderId: senderId || userId || null,
      })
    })

    socket.on('stop_typing', ({ chatId, senderId }) => {
      if (!chatId) {
        return
      }

      socket.to(`chat:${chatId}`).emit('stop_typing', {
        chatId,
        senderId: senderId || userId || null,
      })
    })

    socket.on('disconnect', () => {
      if (!userId) {
        return
      }

      const stillOnline = decreaseUserConnection(String(userId))

      if (!stillOnline) {
        io.emit('user_status', {
          userId: String(userId),
          status: 'offline',
        })
      }
    })
  })
}
