# PostgreSQL Chat Schema

The SQL schema for the chat application is in [chat_schema.sql](/run/media/vks/Projects/D-Lite%20different%20microservices/database/chat_schema.sql).

## Relationships

- `users` stores the profile record for each app user.
- `chats` stores one chat thread.
- `messages` belongs to one chat and one sender.
- `group_members` links users to chats.

## How the tables connect

- `chats.created_by` -> `users.id`
- `group_members.chat_id` -> `chats.id`
- `group_members.user_id` -> `users.id`
- `messages.chat_id` -> `chats.id`
- `messages.sender_id` -> `users.id`

## Direct vs group chat

- A direct chat is a row in `chats` where `type = 'direct'`
- A group chat is a row in `chats` where `type = 'group'`
- Both direct chats and group chats use `group_members` to store participants
- A direct chat normally has 2 member rows
- A group chat can have many member rows

## Why the indexes matter

- `idx_messages_chat_id_created_at` makes chat history queries fast
- `idx_group_members_user_id` helps fetch all chats for a user
- `idx_group_members_chat_id` helps fetch all members in a chat
- `idx_messages_sender_id` helps filter messages by sender

## Suggested usage

- Use `GET /messages/:chatId` to read messages for one chat
- Insert one row in `chats` when a new conversation starts
- Insert rows in `group_members` for every participant
- Insert one row in `messages` for every new message
