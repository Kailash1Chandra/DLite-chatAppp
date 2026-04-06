import { MongoClient } from 'mongodb'
import env from '../config/env.js'

let client
let db

export const connectToMongo = async () => {
  if (db) {
    return db
  }

  if (!env.mongoUri) {
    throw new Error('MONGODB_URI is not configured')
  }

  client = new MongoClient(env.mongoUri)
  await client.connect()
  db = client.db(env.mongoDbName)

  return db
}

export const getBackupCollection = async () => {
  const database = await connectToMongo()
  const collection = database.collection(env.mongoCollectionName)

  await collection.createIndex({ messageId: 1 }, { unique: true })
  await collection.createIndex({ createdAt: -1 })

  return collection
}

export const closeMongoConnection = async () => {
  if (client) {
    await client.close()
  }
}
