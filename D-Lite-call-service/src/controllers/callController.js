import { randomUUID } from 'node:crypto'
import {
  addUserSocket,
  getActiveCall,
  getUserSocketRoom,
  removeActiveCall,
  removeUserSocket,
  setActiveCall,
} from '../services/callStateService.js'

const emitSocketError = (socket, message) => {
  socket.emit('socket_error', { message })
}

export const handleConnection = (io, socket) => {
  const userId = String(socket.handshake.auth?.userId || socket.handshake.query?.userId || '')

  if (!userId) {
    emitSocketError(socket, 'userId is required in the socket handshake')
    socket.disconnect()
    return
  }

  addUserSocket(userId, socket.id)
  socket.join(getUserSocketRoom(userId))

  socket.emit('connected', {
    userId,
    socketId: socket.id,
  })

  socket.on('call_user', (payload = {}) => {
    const toUserId = String(payload.toUserId || '')
    const callType = payload.callType === 'video' ? 'video' : 'audio'
    const offer = payload.offer || null
    const callId = payload.callId || randomUUID()

    if (!toUserId) {
      emitSocketError(socket, 'toUserId is required')
      return
    }

    // We store only lightweight signaling state. WebRTC still carries the actual media.
    setActiveCall(callId, {
      callId,
      callerId: userId,
      calleeId: toUserId,
      callType,
      status: 'ringing',
    })

    io.to(getUserSocketRoom(toUserId)).emit('call_user', {
      callId,
      fromUserId: userId,
      callType,
      offer,
    })
  })

  socket.on('accept_call', (payload = {}) => {
    const callId = String(payload.callId || '')
    const answer = payload.answer || null
    const activeCall = getActiveCall(callId)

    if (!activeCall) {
      emitSocketError(socket, 'Call not found')
      return
    }

    activeCall.status = 'accepted'

    io.to(getUserSocketRoom(activeCall.callerId)).emit('accept_call', {
      callId,
      fromUserId: userId,
      answer,
      callType: activeCall.callType,
    })
  })

  socket.on('reject_call', (payload = {}) => {
    const callId = String(payload.callId || '')
    const reason = payload.reason || 'rejected'
    const activeCall = getActiveCall(callId)

    if (!activeCall) {
      emitSocketError(socket, 'Call not found')
      return
    }

    io.to(getUserSocketRoom(activeCall.callerId)).emit('reject_call', {
      callId,
      fromUserId: userId,
      reason,
    })

    removeActiveCall(callId)
  })

  socket.on('ice_candidate', (payload = {}) => {
    const callId = String(payload.callId || '')
    const toUserId = String(payload.toUserId || '')
    const candidate = payload.candidate || null

    if (!callId || !toUserId || !candidate) {
      emitSocketError(socket, 'callId, toUserId, and candidate are required')
      return
    }

    io.to(getUserSocketRoom(toUserId)).emit('ice_candidate', {
      callId,
      fromUserId: userId,
      candidate,
    })
  })

  socket.on('end_call', (payload = {}) => {
    const callId = String(payload.callId || '')
    const reason = payload.reason || 'ended'
    const activeCall = getActiveCall(callId)

    if (!activeCall) {
      emitSocketError(socket, 'Call not found')
      return
    }

    const targetUserId = activeCall.callerId === userId ? activeCall.calleeId : activeCall.callerId

    io.to(getUserSocketRoom(targetUserId)).emit('end_call', {
      callId,
      fromUserId: userId,
      reason,
    })

    removeActiveCall(callId)
  })

  socket.on('disconnect', () => {
    removeUserSocket(userId, socket.id)
  })
}
