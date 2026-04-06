const connectedUsers = new Map()
const activeCalls = new Map()

export const addUserSocket = (userId, socketId) => {
  const sockets = connectedUsers.get(userId) || new Set()
  sockets.add(socketId)
  connectedUsers.set(userId, sockets)
}

export const removeUserSocket = (userId, socketId) => {
  const sockets = connectedUsers.get(userId)

  if (!sockets) {
    return false
  }

  sockets.delete(socketId)

  if (sockets.size === 0) {
    connectedUsers.delete(userId)
    return false
  }

  return true
}

export const getUserSocketRoom = (userId) => `user:${userId}`

export const setActiveCall = (callId, callData) => {
  activeCalls.set(callId, callData)
}

export const getActiveCall = (callId) => activeCalls.get(callId)

export const removeActiveCall = (callId) => {
  activeCalls.delete(callId)
}
