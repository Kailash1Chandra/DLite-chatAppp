import { handleConnection } from '../controllers/callController.js'

export const registerCallHandlers = (io) => {
  io.on('connection', (socket) => {
    handleConnection(io, socket)
  })
}
