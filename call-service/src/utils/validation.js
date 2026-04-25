const { z } = require("zod");

const roomIDSchema = z
  .string()
  .trim()
  .min(1, "roomID is required")
  .max(128, "roomID too long")
  .regex(/^[a-zA-Z0-9._:-]+$/, "roomID contains invalid characters");

const createRoomSchema = z.object({ roomID: roomIDSchema });
const joinRoomSchema = z.object({ roomID: roomIDSchema });
const leaveRoomSchema = z.object({ roomID: roomIDSchema });
const inviteSchema = z.object({
  roomID: roomIDSchema,
  inviteeUserID: z.string().trim().min(1, "inviteeUserID is required").max(128),
});

function parse(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const msg = result.error.issues?.[0]?.message || "Invalid input";
    const err = new Error(msg);
    err.status = 400;
    throw err;
  }
  return result.data;
}

module.exports = { createRoomSchema, joinRoomSchema, leaveRoomSchema, inviteSchema, parse };

