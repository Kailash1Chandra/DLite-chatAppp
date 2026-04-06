import { getMessagesByChatId } from '../services/messageService.js'

export const getMessages = async (req, res, next) => {
  try {
    const { chatId } = req.params

    const messages = await getMessagesByChatId(chatId)

    res.json({
      success: true,
      chatId,
      messages,
    })
  } catch (error) {
    next(error)
  }
}
